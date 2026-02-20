# Accessibility Testing Suite (WCAG 2.2 AA / AODA)

Modular a11y testing with **Axe-core**, **A11y Tree**, and **WAVE** (browser capture). Reports are written to `a11y-reports/`.

---

## Report engines — what they do

| Engine | What it checks | Output |
|--------|----------------|--------|
| **Axe-core** | **Rule-based.** WCAG violations: missing alt, labels, target size &lt; 24×24 (2.5.8), **button-name**, **link-name**, **color-contrast**, **aria-allowed-attr** (aligned with Lighthouse-style checks). | Violations (fail/pass), incomplete (manual review). Two reports: **all** and **actionable only**. |
| **A11y Tree** | **Tree-based inventory.** Uses the browser’s accessibility tree (what screen readers see). **Inventory:** counts links, buttons, images, videos, audio, iframes. **Issues:** nameless links/buttons/inputs (no accessible name), and media (video/audio/iframe) that need manual verification (captions, audio description). Does *not* run WCAG rules. | One report: inventory counts + list of issues (actionable vs informational). |
| **Lighthouse** | **Same as DevTools.** Lighthouse accessibility only (button/link names, contrast, ARIA). | One report: score + failed audits; CSV + Copy for JIRA. |
| **WAVE (browser)** | **Visual overlay.** You run the WAVE extension in a launched browser; it injects icons into the page. The script captures the page HTML (and screenshot) so you can turn it into JIRA issues with `a11y:wave-to-jira`. No API key. | Capture file; then CSV/MD/HTML via `a11y:wave-to-jira`. |

**Summary:** Axe = “Does this break WCAG rules?”. A11y Tree = “What’s on the page and what’s obviously missing (no name, media)?”. WAVE browser = “See issues on the page, then export to JIRA.”

---

## Quick start

```bash
npm install
npx playwright install chromium
```

---

## How to run

### Axe + A11y Tree (default; no API key)

```bash
# One URL — runs Axe and A11y Tree
npm run a11y -- --url https://your-site.com/page

# Multiple URLs (positional or repeated --url)
npm run a11y -- --url https://qa.mfsg.com/ https://other.com/
npm run a11y -- --url https://a.com --url https://b.com

# CSV of URLs
npm run a11y -- --csv urls.csv

# Interactive prompt (no flags)
npm run a11y
```

### Axe only (two reports: all issues + actionable only)

```bash
npm run a11y:axe -- --url https://qa.mfsg.com/
# Writes: report-axe-core-<slug>-<ts>-all.html, report-axe-core-<slug>-<ts>-actionable.html (+ .csv)
```

### A11y Tree only (inventory + nameless/media issues)

```bash
npm run a11y:tree -- --url https://qa.mfsg.com/
# Writes: report-a11y-tree-<slug>-<ts>.html (+ .csv)
```

### Lighthouse only (same as DevTools Lighthouse accessibility)

```bash
npm run a11y:lighthouse -- --url https://d3o8to3d6h0ajp.cloudfront.net/en/bc
# Launches headless Chrome, runs Lighthouse a11y only, writes report-lighthouse-<slug>-<ts>.html (+ .csv)
```

### WAVE API (requires API key)

```bash
WAVE_API_KEY=your_key npm run a11y:wave -- --url https://your-site.com
```

### WAVE — browser capture (no API key)

```bash
# 1) Capture: open URL in browser with WAVE; you click Evaluate, then Enter
npm run a11y:wave-browser -- --url https://qa.mfsg.com/

# 2) Turn latest capture into JIRA-ready reports
npm run a11y:wave-to-jira
npm run a11y:wave-to-jira -- --actionable-only   # Only Errors, Contrast, Alerts

# Specific file
npx tsx scripts/wave-capture-to-jira.ts --file a11y-reports/wave-browser-capture-qa.mfsg.com--2026-02-19T21-01-16.html --url https://qa.mfsg.com/
```

**First-time WAVE browser:** Install the [WAVE extension](https://chromewebstore.google.com/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh) in your normal Chrome. The script copies it into `.wave-extension` and loads it in the automation browser. If not found, use `--extension-path <folder>` with an unpacked extension folder.

### SPA / slow pages: settle delay

Axe and A11y Tree run after `networkidle` plus a **settle delay** (default **3 seconds**) so client-rendered content has time to appear. If a page still shows **0 issues / 0 inventory** but WAVE or a manual check finds problems, the DOM may be rendering later. Increase the delay:

```bash
A11Y_SETTLE_MS=8000 npm run a11y -- --url https://your-spa.com/
```

(Values in milliseconds; use `0` to disable.) The CLI also waits up to **15s** for at least 2 interactive elements (`A11Y_CONTENT_WAIT_MS`, default 15000) before running Axe/Tree, and uses a **desktop viewport** (1280×720).

### Comparing Axe/Tree vs WAVE vs Lighthouse

- **Axe + Tree** run automatically after load (`load` + settle + optional content wait). They see the DOM at that moment. For **SPAs or very slow pages**, you can get **0 violations / 0 inventory** even when the page has real issues (Lighthouse or WAVE find them).
- **WAVE (browser)** runs when **you** click Evaluate, so it often sees the full page.
- **Lighthouse** runs in DevTools (often with a full browser, after you load the page). It can report **button/link names, contrast, ARIA** that Axe would also flag **if** Axe saw the same DOM.
- If **Lighthouse or WAVE find issues** but **Axe/Tree do not**, treat it as **timing or environment**: the page in headless Playwright may not have the same content yet (or at all). Use **WAVE + wave-to-jira** or **Lighthouse** for that URL, and optionally run with a longer `A11Y_SETTLE_MS` / `A11Y_CONTENT_WAIT_MS` or in **headed** mode to compare.

---

## Where reports go and how to check them

All reports are written to **`a11y-reports/`** in the project root.

### Filename patterns

| Source | HTML | CSV |
|--------|------|-----|
| Axe (all) | `report-axe-core-<url-slug>-<timestamp>-all.html` | same base `.csv` |
| Axe (actionable) | `report-axe-core-<url-slug>-<timestamp>-actionable.html` | same base `.csv` |
| A11y Tree | `report-a11y-tree-<url-slug>-<timestamp>.html` | same base `.csv` |
| Lighthouse | `report-lighthouse-<url-slug>-<timestamp>.html` | same base `.csv` |
| WAVE → JIRA | `wave-jira-<url-slug>-<timestamp>.html` | `wave-jira-<url-slug>-<timestamp>.csv` (+ `.md`) |
| WAVE capture | `wave-browser-capture-<url-slug>-<timestamp>.html` (+ `.png`) | — |

The CLI prints the full path after each run, e.g.  
`Axe-core: ... Report: /path/to/a11y-reports/report-axe-core-qa.mfsg.com--2026-02-19T21-53-10-all.html`

### How to open and use reports

1. **From terminal:** Copy the path from the “Report:” line and open it:
   ```bash
   open a11y-reports/report-axe-core-qa.mfsg.com--2026-02-19T21-53-10-all.html
   ```
2. **From the repo:** In your editor or Finder, go to `a11y-reports/` and open the latest `report-*` or `wave-jira-*` file. Double-click the `.html` to open in your default browser.
3. **In reports:** Use “Copy for JIRA” buttons to paste issue text into JIRA. Axe reports show severity and WCAG tags; WAVE JIRA report shows actionable vs informational pills.

---

## CI (Playwright test)

```bash
TARGET_URL=https://staging.example.com npx playwright test tests/accessibility-module.spec.ts
```

Or: `npm run test:a11y` (uses `TARGET_URL` from env, default `https://example.com`).

---

## Layout

- `types/a11y.types.ts` — WAVE + Axe + ReportConfig types  
- `types/a11y-tree.types.ts` — A11y Tree result types  
- `engines/axe-engine.ts` — Axe scan (wcag22aa, 24×24 target size, AODA rules)  
- `engines/wave-engine.ts` — WAVE API client  
- `engines/a11y-tree-engine.ts` — Accessibility tree audit (CDP; Chromium only)  
- `engines/lighthouse-engine.ts` — Lighthouse accessibility (same as DevTools)  
- `utils/reporter.ts` — HTML + CSV reports, engine-tagged, “Copy for JIRA”  
- `scripts/run-a11y.ts` — CLI: `--url`, `--csv`, `--engine axe|wave|tree|lighthouse|both`  
- `scripts/run-wave-browser.ts` — Launch browser with WAVE; capture HTML + screenshot  
- `scripts/wave-capture-to-jira.ts` — Parse WAVE capture → CSV/MD/HTML JIRA issues  
- `tests/accessibility-module.spec.ts` — Axe test + manual checklist comments  
- `docs/wcag22aa-wave-reference.md` — WCAG 2.2 ↔ WAVE reference for JIRA text  

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  ENGINE            │  COMMAND(S)             │  TOKEN?  │  MECHANISM                        │
├────────────────────┼─────────────────────────┼──────────┼───────────────────────────────────┤
│  Axe-core          │  npm run a11y:axe       │  None    │  Local Playwright + axe-core      │
│  A11y Tree         │  npm run a11y:tree      │  None    │  Local Playwright CDP             │
│  Lighthouse        │  npm run a11y:lighthouse│  None    │  Local Chrome + Lighthouse NPM    │
│  WAVE Browser      │  npm run a11y:wave-ext  │  None    │  Local Extension + Manual Capture │
│  WAVE API          │  npm run a11y:wave      │  Required│  WebAIM Paid API (External Call)  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
The only thing that needs a token is a11y:wave (the WAVE API engine), which hits WebAIM's external service. Everything else — Axe, Tree, Lighthouse, and the WAVE browser capture parser — runs 100% locally with just Node.js, Playwright, and Chrome. Fully CI/CD-friendly without any secrets for those four.