/**
 * last30days Archive — static SPA shell
 * Hash routes: #/  |  #/recent  |  #/report/<slug>
 * Data: data/index.json, data/reports/<slug>.json
 */

(function () {
  "use strict";

  const RECENT_DAYS = 13;

  const root = document.getElementById("view-root");
  const headerMeta = document.getElementById("header-meta");

  let catalogCache = null;
  let routeSeq = 0;
  const bodyTextCache = new Map();

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
    if (parts.length === 1 && parts[0] === "recent") {
      return { name: "recent" };
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

  function setDetailMode(on) {
    root.classList.toggle("is-detail", Boolean(on));
  }

  function setLoading(msg) {
    setDetailMode(false);
    root.innerHTML = `<div class="state-panel">${escapeHtml(msg || "Loading…")}</div>`;
  }

  function setError(msg) {
    setDetailMode(false);
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

  function reportDay(iso) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso || ""));
    return match ? match[1] : "";
  }

  function formatDay(iso) {
    const day = reportDay(iso);
    if (!day) return "";
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function localTodayISO(now = new Date()) {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${m}-${d}`;
  }

  function shiftISODate(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function recentWindow(now = new Date()) {
    const today = localTodayISO(now);
    return { today, start: shiftISODate(today, -(RECENT_DAYS - 1)) };
  }

  function inRecentWindow(date, win) {
    const day = reportDay(date);
    return Boolean(day) && day >= win.start && day <= win.today;
  }

  function daysBetween(earlier, later) {
    if (!earlier || !later) return null;
    const [y1, m1, d1] = earlier.split("-").map(Number);
    const [y2, m2, d2] = later.split("-").map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }

  function newestReportDate(reports) {
    let newest = "";
    for (const report of reports) {
      const day = reportDay(report.date);
      if (day && day > newest) newest = day;
    }
    return newest;
  }

  function htmlToText(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  async function loadBodyText(slug) {
    if (bodyTextCache.has(slug)) return bodyTextCache.get(slug);
    try {
      const report = await fetchJson(`data/reports/${encodeURIComponent(slug)}.json`);
      const patterns = Array.isArray(report.keyPatterns) ? report.keyPatterns : [];
      const text = [htmlToText(report.synthesisHtml), ...patterns, htmlToText(report.footerHtml)]
        .filter(Boolean)
        .join(" ");
      bodyTextCache.set(slug, text);
      return text;
    } catch (err) {
      console.error(err);
      bodyTextCache.set(slug, "");
      return "";
    }
  }

  function viewNav(active) {
    const item = (name, href, label) => {
      const current = name === active;
      return `<a class="filter-chip${current ? " is-active" : ""}" href="${href}"${
        current ? ' aria-current="page"' : ""
      }>${label}</a>`;
    };
    return `<nav class="view-nav" aria-label="Archive views">${item("home", "#/", "All reports")}${item(
      "recent",
      "#/recent",
      "Last 13 days"
    )}</nav>`;
  }

  function reportCardHtml(report) {
    const thumb = report.image
      ? `<img class="video-card-thumb" src="${escapeHtml(report.image)}" alt="" loading="lazy" />`
      : `<div class="video-card-thumb video-card-thumb-empty" aria-hidden="true"></div>`;
    return `
        <li>
          <a class="video-card report-card" href="#/report/${encodeURIComponent(report.slug)}">
            <div class="video-card-top">
              <div class="video-card-thumb-wrap">${thumb}</div>
              <div class="video-card-body">
                <p class="video-card-title">${escapeHtml(report.title || report.slug)}</p>
                <div class="video-card-meta">
                  <span>${escapeHtml(formatDate(report.date))}</span>
                  ${report.topic ? `<span>${escapeHtml(report.topic)}</span>` : ""}
                </div>
                <div class="video-card-labels">
                  ${statusBadge(report.status)}
                </div>
              </div>
            </div>
            ${report.summary ? `<p class="summary">${escapeHtml(report.summary)}</p>` : ""}
          </a>
        </li>`;
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

    const fullCount = reports.filter((r) => String(r.status || "full").toLowerCase() !== "provisional").length;
    const provisionalCount = reports.length - fullCount;
    const updated = catalog.generated ? formatDate(catalog.generated) : "—";

    const hero = `
      <section class="learning-hero" aria-labelledby="learning-title">
        <div class="hero-topline">
          <span class="eyebrow">Last 30 days</span>
          <span class="hero-xp">Updated ${escapeHtml(updated)}</span>
        </div>
        <h2 id="learning-title">Research archive</h2>
        <p>What people actually said in the last 30 days — distilled into durable reports.</p>
        <div class="status-stats">
          <div>
            <strong>${reports.length}</strong>
            <span>Reports</span>
          </div>
          <div>
            <strong>${fullCount}</strong>
            <span>Full</span>
          </div>
          <div>
            <strong>${provisionalCount}</strong>
            <span>Provisional</span>
          </div>
        </div>
      </section>`;

    if (reports.length === 0) {
      setDetailMode(false);
      root.innerHTML = `
        ${viewNav("home")}
        ${hero}
        <div class="empty-archive empty-state">
          <h2>No reports yet</h2>
          <p>Run <code>python scripts/sync_last30days_archive.py</code> to populate this archive.</p>
        </div>
      `;
      return;
    }

    const cards = sorted.map((r) => reportCardHtml(r)).join("");

    setDetailMode(false);
    root.innerHTML = `
      ${viewNav("home")}
      ${hero}
      <section class="home-section">
        <div class="section-heading">
          <h2>Reports</h2>
        </div>
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
            : `<ul class="video-grid report-list">${cards}</ul>`
        }
      </section>
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

  function renderRecent(catalog, query) {
    const reports = Array.isArray(catalog.reports) ? catalog.reports : [];
    const win = recentWindow();
    const windowed = reports.filter((r) => inRecentWindow(r.date, win));
    const q = (query || "").trim().toLowerCase();
    const filtered = q
      ? windowed.filter((r) => {
          const hay = [r.title, r.topic, r.summary, r.slug, bodyTextCache.get(r.slug) || ""]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : windowed;
    const sorted = [...filtered].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );

    updateHeaderMeta(catalog);

    const newest = newestReportDate(reports);
    const age = newest ? daysBetween(newest, win.today) : null;
    const ageNote =
      age === 0 ? " (today)" : age > 0 ? ` (${age} day${age === 1 ? "" : "s"} before today)` : "";
    const updated = catalog.generated ? formatDate(catalog.generated) : "—";
    const newestLabel = newest ? `${formatDay(newest)}${ageNote}` : "none";

    const hero = `
      <section class="learning-hero" aria-labelledby="recent-title">
        <div class="hero-topline">
          <span class="eyebrow">Last 13 days</span>
          <span class="hero-xp">${escapeHtml(formatDay(win.start))} – ${escapeHtml(formatDay(win.today))}</span>
        </div>
        <h2 id="recent-title">Recent reports</h2>
        <p>Reports dated in the last 13 days, through today on this device.</p>
        <p class="window-note">Newest report: <strong>${escapeHtml(newestLabel)}</strong>. Index regenerated <strong>${escapeHtml(updated)}</strong>.</p>
        <div class="status-stats">
          <div>
            <strong>${windowed.length}</strong>
            <span>In window</span>
          </div>
          <div>
            <strong>${reports.length}</strong>
            <span>All reports</span>
          </div>
          <div>
            <strong>${age === null ? "—" : age}</strong>
            <span>Days since newest</span>
          </div>
        </div>
      </section>`;

    const emptyWindow = `
      <div class="empty-archive empty-state">
        <h2>No reports in the last 13 days</h2>
        <p>Nothing is dated from ${escapeHtml(formatDay(win.start))} through ${escapeHtml(formatDay(win.today))}.</p>
        <p class="staleness">Newest report: ${escapeHtml(newestLabel)}. Index regenerated ${escapeHtml(updated)}.</p>
      </div>`;

    const list =
      windowed.length === 0
        ? emptyWindow
        : sorted.length === 0
          ? `<p class="no-results">No reports in this window match “${escapeHtml(query)}”.</p>`
          : `<ul class="video-grid report-list">${sorted.map((r) => reportCardHtml(r)).join("")}</ul>`;

    setDetailMode(false);
    root.innerHTML = `
      ${viewNav("recent")}
      ${hero}
      <section class="home-section">
        <div class="section-heading">
          <h2>In the last 13 days</h2>
        </div>
        <div class="search-row">
          <input
            type="search"
            class="search-input"
            id="recent-search"
            placeholder="Search title, topic, summary, body…"
            value="${escapeHtml(query || "")}"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="filter-chip" id="result-count">${sorted.length} / ${windowed.length}</span>
        </div>
        ${list}
      </section>
    `;

    const input = document.getElementById("recent-search");
    if (input) {
      input.focus({ preventScroll: true });
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
      input.addEventListener("input", () => {
        renderRecent(catalog, input.value);
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

    setDetailMode(true);
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

  async function showHome(seq) {
    setLoading("Loading archive…");
    try {
      const catalog = await loadCatalog();
      if (seq !== routeSeq) return;
      renderCatalog(catalog, "");
    } catch (err) {
      if (seq !== routeSeq) return;
      console.error(err);
      setError("Could not load data/index.json. Is the archive synced?");
      headerMeta.textContent = "";
    }
  }

  async function showRecent(seq) {
    setLoading("Loading recent reports…");
    try {
      const catalog = await loadCatalog();
      if (seq !== routeSeq) return;
      const win = recentWindow();
      const reports = Array.isArray(catalog.reports) ? catalog.reports : [];
      const windowed = reports.filter((r) => inRecentWindow(r.date, win));
      await Promise.all(windowed.map((r) => loadBodyText(r.slug)));
      if (seq !== routeSeq) return;
      renderRecent(catalog, "");
    } catch (err) {
      if (seq !== routeSeq) return;
      console.error(err);
      setError("Could not load data/index.json. Is the archive synced?");
      headerMeta.textContent = "";
    }
  }

  async function showReport(slug, seq) {
    setLoading("Loading report…");
    try {
      const report = await fetchJson(`data/reports/${encodeURIComponent(slug)}.json`);
      if (seq !== routeSeq) return;
      renderReport(report);
    } catch (err) {
      if (seq !== routeSeq) return;
      console.error(err);
      setError(`Report “${slug}” not found.`);
      headerMeta.textContent = "";
    }
  }

  async function route() {
    const seq = ++routeSeq;
    const r = parseRoute();
    document.title =
      r.name === "report"
        ? `${r.slug} · last30days Archive`
        : r.name === "recent"
          ? "Last 13 days · last30days Archive"
          : "last30days Archive";

    if (r.name === "report") {
      await showReport(r.slug, seq);
    } else if (r.name === "recent") {
      await showRecent(seq);
    } else {
      await showHome(seq);
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
