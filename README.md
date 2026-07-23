# last30days Archive

Static GitHub Pages archive for [last30days](https://github.com/mvanhorn/last30days-skill) research reports — a searchable catalog and per-report detail view (hero infographic, synthesis, key patterns, stats).

**Public URL:** https://dong-xuyong.github.io/last30days-archive/

## What’s here

| Path | Role |
| --- | --- |
| `index.html` / `app.js` / `styles.css` | SPA shell (hash routes `#/` and `#/report/<slug>`) |
| `data/index.json` | Catalog index |
| `data/reports/<slug>.json` | Full report payloads |
| `assets/` | Hero images (`assets/<slug>.png`) |
| `reports/` | Optional static HTML mirrors (populated by sync) |

The SPA loads `data/index.json` for the home list and `data/reports/<slug>.json` for detail pages. All asset paths are **relative**, so the app works at `/last30days-archive/` on GitHub Pages.

## Local preview

From this folder (or any static server at the site root):

```bash
# Python
python -m http.server 8080

# Node
npx --yes serve -l 8080
```

Open http://localhost:8080/ (or the URL your server prints). Use `#/` for the catalog and `#/report/<slug>` for a report.

## Sync reports into the archive

From the Second Brain repo root:

```bash
python scripts/sync_last30days_archive.py
```

That script rebuilds `data/index.json`, writes per-report JSON under `data/reports/`, copies hero images into `assets/`, and prepares the site for deploy.

## Expected data shapes

**`data/index.json`**

```json
{
  "generated": "ISO date",
  "reportCount": 0,
  "reports": [
    {
      "slug": "...",
      "title": "...",
      "topic": "...",
      "date": "YYYY-MM-DD",
      "status": "full",
      "summary": "...",
      "image": "assets/<slug>.png"
    }
  ]
}
```

**`data/reports/<slug>.json`**

```json
{
  "slug": "...",
  "title": "...",
  "topic": "...",
  "date": "YYYY-MM-DD",
  "status": "full",
  "summary": "...",
  "image": "assets/<slug>.png",
  "synthesisHtml": "...",
  "keyPatterns": ["..."],
  "footerHtml": "...",
  "badge": "🌐 last30days v3.8.2 · synced YYYY-MM-DD"
}
```

`status` is `"full"` or `"provisional"`.
