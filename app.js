/**
 * last30days Archive — static SPA shell
 * Hash routes: #/  |  #/report/<slug>
 * Data: data/index.json, data/reports/<slug>.json
 */

(function () {
  "use strict";

  const root = document.getElementById("view-root");
  const headerMeta = document.getElementById("header-meta");

  let catalogCache = null;

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseRoute() {
    const hash = (location.hash || "#/").replace(/^#/, "") || "/";
    const parts = hash.split("/").filter(Boolean);

    if (parts.length === 0) {
      return { name: "home" };
    }
    if (parts[0] === "report" && parts[1]) {
      return { name: "report", slug: decodeURIComponent(parts[1]) };
    }
    return { name: "home" };
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`Failed to load ${path} (${res.status})`);
    }
    return res.json();
  }

  async function loadCatalog() {
    if (catalogCache) return catalogCache;
    catalogCache = await fetchJson("data/index.json");
    return catalogCache;
  }

  function setLoading(msg) {
    root.innerHTML = `<div class="state-panel">${escapeHtml(msg || "Loading…")}</div>`;
  }

  function setError(msg) {
    root.innerHTML = `<div class="state-panel error">${escapeHtml(msg)}</div>`;
  }

  function statusBadge(status) {
    const s = (status || "full").toLowerCase();
    const label = s === "provisional" ? "provisional" : "full";
    return `<span class="badge ${label}">${escapeHtml(label)}</span>`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return escapeHtml(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function updateHeaderMeta(catalog) {
    if (!catalog) {
      headerMeta.textContent = "";
      return;
    }
    const count = catalog.reportCount ?? (catalog.reports || []).length;
    const gen = catalog.generated ? formatDate(catalog.generated) : "—";
    headerMeta.innerHTML = `${count} report${count === 1 ? "" : "s"} · updated ${gen}`;
  }

  function renderCatalog(catalog, query) {
    const reports = Array.isArray(catalog.reports) ? catalog.reports : [];
    updateHeaderMeta(catalog);

    const q = (query || "").trim().toLowerCase();
    const filtered = q
      ? reports.filter((r) => {
          const hay = [r.title, r.topic, r.summary, r.slug, r.date, r.status]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : reports;

    const sorted = [...filtered].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );

    if (reports.length === 0) {
      root.innerHTML = `
        <section class="catalog-hero">
          <h1>Research archive</h1>
          <p>Synthesized last30days reports — searchable, linkable, and ready for GitHub Pages.</p>
        </section>
        <div class="empty-archive">
          <h2>No reports yet</h2>
          <p>Run <code>python scripts/sync_last30days_archive.py</code> to populate this archive.</p>
        </div>
      `;
      return;
    }

    const cards = sorted
      .map((r, i) => {
        const delay = Math.min(i * 0.03, 0.35);
        return `
        <li>
          <a class="report-card" href="#/report/${encodeURIComponent(r.slug)}" style="animation-delay:${delay}s">
            <div class="report-card-top">
              <span class="report-card-meta">${escapeHtml(formatDate(r.date))}</span>
              ${statusBadge(r.status)}
            </div>
            <h2>${escapeHtml(r.title || r.slug)}</h2>
            ${r.topic ? `<p class="topic">${escapeHtml(r.topic)}</p>` : ""}
            ${r.summary ? `<p class="summary">${escapeHtml(r.summary)}</p>` : ""}
          </a>
        </li>`;
      })
      .join("");

    root.innerHTML = `
      <section class="catalog-hero">
        <h1>Research archive</h1>
        <p>What people actually said in the last 30 days — distilled into durable reports.</p>
      </section>
      <div class="search-row">
        <input
          type="search"
          class="search-input"
          id="catalog-search"
          placeholder="Search title, topic, summary…"
          value="${escapeHtml(query || "")}"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="filter-chip" id="result-count">${sorted.length} / ${reports.length}</span>
      </div>
      ${
        sorted.length === 0
          ? `<p class="no-results">No reports match “${escapeHtml(query)}”.</p>`
          : `<ul class="report-list">${cards}</ul>`
      }
    `;

    const input = document.getElementById("catalog-search");
    if (input) {
      input.focus({ preventScroll: true });
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
      input.addEventListener("input", () => {
        renderCatalog(catalog, input.value);
      });
    }
  }

  function renderReport(report) {
    headerMeta.textContent = report.badge || report.date || "";

    const img = report.image
      ? `<div class="report-hero-img-wrap"><img src="${escapeHtml(report.image)}" alt="${escapeHtml(report.title || report.slug)}" loading="eager" /></div>`
      : "";

    const patterns = Array.isArray(report.keyPatterns) ? report.keyPatterns : [];
    const patternHtml =
      patterns.length > 0
        ? `
      <section class="patterns">
        <p class="section-label">Key patterns</p>
        <h2>What kept showing up</h2>
        <ol class="pattern-list">
          ${patterns.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
        </ol>
      </section>`
        : "";

    root.innerHTML = `
      <a class="back-link" href="#/">← All reports</a>
      <article class="report-view">
        <header class="report-hero">
          ${img}
          <div class="report-kicker">
            ${statusBadge(report.status)}
            <span class="date">${escapeHtml(formatDate(report.date))}</span>
            ${report.topic ? `<span class="topic-label">${escapeHtml(report.topic)}</span>` : ""}
          </div>
          <h1>${escapeHtml(report.title || report.slug)}</h1>
          ${report.summary ? `<p class="report-lede">${escapeHtml(report.summary)}</p>` : ""}
        </header>

        <section class="synthesis">
          <p class="section-label">Synthesis</p>
          <div class="synthesis-body">${report.synthesisHtml || "<p>No synthesis available.</p>"}</div>
        </section>

        ${patternHtml}

        <section class="stats-footer">
          <p class="section-label">Stats</p>
          <div class="stats-footer-body">${report.footerHtml || ""}</div>
        </section>

        ${report.badge ? `<p class="report-badge">${escapeHtml(report.badge)}</p>` : ""}
      </article>
    `;
  }

  async function showHome() {
    setLoading("Loading archive…");
    try {
      const catalog = await loadCatalog();
      renderCatalog(catalog, "");
    } catch (err) {
      console.error(err);
      setError("Could not load data/index.json. Is the archive synced?");
      headerMeta.textContent = "";
    }
  }

  async function showReport(slug) {
    setLoading("Loading report…");
    try {
      const report = await fetchJson(`data/reports/${encodeURIComponent(slug)}.json`);
      renderReport(report);
    } catch (err) {
      console.error(err);
      setError(`Report “${slug}” not found.`);
      headerMeta.textContent = "";
    }
  }

  async function route() {
    const r = parseRoute();
    document.title =
      r.name === "report"
        ? `${r.slug} · last30days Archive`
        : "last30days Archive";

    if (r.name === "report") {
      await showReport(r.slug);
    } else {
      await showHome();
    }
  }

  window.addEventListener("hashchange", () => {
    route();
  });

  if (!location.hash || location.hash === "#") {
    location.replace("#/");
  }

  route();
})();
