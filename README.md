# 🛡️ Enterprise Accessibility (AODA/WCAG) Quality Gate

> An automated, multi-engine Continuous Integration (CI/CD) quality gate designed to proactively block non-compliant code and mitigate legal liability under the **AODA** and **WCAG 2.2 AA** standards.

**Zero third-party API tokens required. Runs entirely locally or headlessly in CI/CD pipelines.**

---

## 🛑 The CI/CD Quality Gate (Shift-Left)

This framework is not just for local auditing; it is an **infrastructure-level deployment guardrail**.

By running `TARGET_URL=https://your-app.com npx playwright test tests/accessibility-module.spec.ts` inside GitHub Actions, Jenkins, or GitLab CI, the pipeline will **exit non-zero and block the Pull Request** if any Critical or Serious WCAG violations are detected. That automates discovery of ~57% of total accessibility issue volume, freeing QA for complex manual screen-reader testing.

---

## 📊 Executive Reporting & Jira Integration

Raw JSON means nothing to a product manager. This framework translates technical DOM violations into **executive-ready HTML dashboards** and **developer-ready Jira tickets**.

*(Add a screenshot of your HTML report by adding an image to `docs/dashboard-preview.png`.)*

![Dashboard Preview](./docs/dashboard-preview.png)

Every failing finding uses a **unified 8-section card**:

| Section | Content |
|---------|---------|
| **Title** | Audit rule name |
| **Description** | What the rule checks |
| **Element(s)** | Actual DOM snippet (exact failing HTML) |
| **Where located** | CSS selector |
| **WCAG number** | e.g., *WCAG 4.1.2 Name, Role, Value — Level A* |
| **WCAG cause of failure** | Why it violates the standard |
| **Actual** | Current failing state |
| **Expected + proposed fix** | What compliance looks like + remediation |

Each card has a **Copy for Jira** button that copies the full issue text.

---

## 🏗️ Why Scripts, Not a Page Object Model (POM)?

This is an **infrastructure tool**, not an E2E test suite. There is no page-specific interaction — no login flows, no form filling, no element clicking. It takes **any URL** and audits it.

Enterprise accessibility tools (Deque axe-monitor, Lighthouse CI, Pa11y) are CLI/script-based. A POM models specific pages; this framework is **page-agnostic**. The project uses a **hybrid approach**: TypeScript scripts for deep reporting, and a [Playwright test spec](tests/accessibility-module.spec.ts) for CI/CD pipeline enforcement.

---

## ⚙️ The Scan Engines

| Engine | Command | What It Does |
|--------|---------|--------------|
| **Axe-core** | `npm run a11y:axe` | Playwright + axe-core. WCAG 2.2 AA rules, custom 2.5.8 target-size check (24×24px). Two reports: all issues + actionable only. |
| **A11y Tree** | `npm run a11y:tree` | Chrome DevTools Protocol. Walks the accessibility tree (what screen readers see). Component inventory + nameless control detection + media review flags. |
| **Lighthouse** | `npm run a11y:lighthouse` | chrome-launcher + Lighthouse API. Extracts WCAG tags from internal Axe-core artifacts. Same audit as Chrome DevTools. |
| **WCAG Audit** | `npm run a11y:wcag` | Strict WCAG 2.2 AA / AODA compliance audit. Segregates into Pass/Fail/Manual/N-A with JSON output. |

**Optional (token or manual):**

| Engine | Command | Token? |
|--------|---------|--------|
| **WAVE API** | `npm run a11y:wave` | `WAVE_API_KEY` (paid) |
| **WAVE Browser** | `npm run a11y:wave-browser` + `a11y:wave-to-jira` | None — manual capture, then parse to Jira. |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install
npx playwright install chromium

# Scan a URL (runs Axe-core + A11y Tree)
npm run a11y -- --url https://your-site.com

# Scan multiple URLs from a CSV (batch audit)
npm run a11y -- --csv urls.csv

# Run strict WCAG 2.2 AA audit for legal compliance JSON
npm run a11y:wcag -- https://your-site.com
```

Reports are written to `a11y-reports/` as HTML + CSV. **Multiple URLs** are supported via repeated `--url` or a **CSV file** (one URL per line or column).

---

## Usage

### Default: Axe + A11y Tree (no API key)

```bash
# Single URL
npm run a11y -- --url https://your-site.com/page

# Multiple URLs (repeated flag or space-separated)
npm run a11y -- --url https://site-a.com --url https://site-b.com

# Batch from CSV — one URL per line or column; any cell containing http(s) is used
npm run a11y -- --csv urls.csv
```

**Batch scanning (CSV)** — Use a CSV file to audit many URLs in one run. The parser accepts any CSV where URLs appear (one per line, or in columns). Duplicates are removed. Example `urls.csv`:

```
https://www.example.com
https://www.example.com/about
https://staging.example.com/login
```

Same command works for Axe, Tree, Lighthouse: e.g. `npm run a11y:axe -- --csv urls.csv`. Reports are generated per URL in `a11y-reports/`.

### Engine-specific

```bash
npm run a11y:axe -- --url https://your-site.com
npm run a11y:tree -- --url https://your-site.com
npm run a11y:lighthouse -- --url https://your-site.com
npm run a11y:wcag -- https://your-site.com
```

### WAVE API (paid key)

```bash
WAVE_API_KEY=your_key npm run a11y:wave -- --url https://your-site.com
```

### WAVE Browser (free, manual)

```bash
# 1. Capture: browser opens, you click WAVE → Evaluate → press Enter
npm run a11y:wave-browser -- --url https://your-site.com

# 2. Convert capture to Jira-ready report
npm run a11y:wave-to-jira
npm run a11y:wave-to-jira -- --actionable-only
```

### CI/CD Pipeline Gate

```bash
TARGET_URL=https://staging.example.com npx playwright test tests/accessibility-module.spec.ts
```

Exits non-zero if any WCAG violations are found. Use in GitHub Actions, Jenkins, GitLab CI, etc.

### SPA / Slow Pages

The framework waits for `networkidle` + 8s settle + up to 30s for meaningful DOM content. Override if needed:

```bash
A11Y_SETTLE_MS=15000 A11Y_CONTENT_WAIT_MS=45000 npm run a11y -- --url https://your-spa.com
```

---

## Report Files

| Engine | HTML | CSV |
|--------|------|-----|
| Axe (all) | `report-axe-core-<slug>-<ts>-all.html` | `.csv` |
| Axe (actionable) | `report-axe-core-<slug>-<ts>-actionable.html` | `.csv` |
| A11y Tree | `report-a11y-tree-<slug>-<ts>.html` | `.csv` |
| Lighthouse | `report-lighthouse-<slug>-<ts>.html` | `.csv` |
| WAVE → Jira | `wave-jira-<slug>-<ts>.html` | `.csv` + `.md` |
| WCAG Audit | `wcag-audit-report.json` | — |

---

## Architecture

```
enterprise-a11y-quality-gate/
├── engines/                    # Scan engines
│   ├── axe-engine.ts           #   Axe-core via Playwright (WCAG 2.2 AA + 2.5.8 target size)
│   ├── a11y-tree-engine.ts     #   CDP Accessibility Tree walker
│   ├── lighthouse-engine.ts    #   Lighthouse API via chrome-launcher
│   └── wave-engine.ts          #   WebAIM WAVE API client
├── scripts/                     # CLI entry points
│   ├── run-a11y.ts             #   Main CLI: --engine axe|tree|lighthouse|wave --url <url>
│   ├── run-wcag-audit.ts       #   Strict WCAG 2.2 AA / AODA audit → JSON
│   ├── run-wave-browser.ts     #   Launch browser with WAVE extension
│   └── wave-capture-to-jira.ts #   Parse WAVE capture → Jira-ready HTML/CSV/MD
├── utils/                       # Shared logic
│   ├── reporter.ts             #   Unified HTML + CSV report generator
│   ├── wcag-dictionary.ts      #   WCAG tag translator + Lighthouse audit mapping
│   ├── wave-capture-parser.ts  #   WAVE browser capture → structured data
│   └── wave-wcag-reference.ts  #   WAVE finding type → WCAG reference
├── types/                       # TypeScript interfaces
├── tests/
│   └── accessibility-module.spec.ts   # Playwright test: fail pipeline on violations
├── docs/
├── a11y-reports/               # Generated reports (gitignored)
└── .github/workflows/a11y-gate.yml     # GitHub Actions CI workflow
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `A11Y_SETTLE_MS` | `8000` | Post-navigation settle time (ms) for SPA rendering |
| `A11Y_CONTENT_WAIT_MS` | `30000` | Max wait for meaningful DOM content before scanning |
| `WAVE_API_KEY` | — | WebAIM WAVE API key (only for `a11y:wave` engine) |
| `TARGET_URL` | `https://example.com` | URL for Playwright CI test spec |

---

## Tech Stack

- **TypeScript** — strict mode, ES2022, NodeNext modules
- **Playwright** — browser automation for Axe-core and A11y Tree
- **@axe-core/playwright** — Deque's axe-core integration
- **Lighthouse** — Google's accessibility audit (via npm API)
- **chrome-launcher** — headless Chrome for Lighthouse
- **Commander** — CLI argument parsing
- **csv-parse** — CSV URL list ingestion

---

## License

MIT
