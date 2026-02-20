# Enterprise Accessibility Quality Gate

> A modular, multi-engine WCAG 2.2 AA / AODA accessibility testing framework that scans any URL and produces executive-ready HTML reports with Jira-ready issue cards.

**Zero AI. Zero tokens. Runs locally or in CI/CD.**

---

## What This Is

I built a modular, multi-engine accessibility testing framework in TypeScript. It runs four different scan engines — **Axe-core**, **Lighthouse**, **WAVE**, and a custom **Accessibility Tree walker** — against any URL, and produces unified HTML reports with WCAG 2.2 AA compliance mappings.

Every finding includes:
- The **DOM snippet** (exact failing element)
- **Where it's located** (CSS selector)
- **WCAG criterion** (e.g., WCAG 4.1.2 Name, Role, Value — Level A)
- **Cause of failure** (why it violates the standard)
- **Actual state** vs **Expected + proposed fix**

Reports include **Copy to Jira** buttons on every issue card. The strict WCAG audit script segregates findings into **Pass / Fail / Manual Check / Not Applicable** — the four categories a legal compliance audit requires.

---

## Why Scripts, Not Page Object Model

This is an **infrastructure tool**, not an E2E test suite. There is no page-specific interaction — no login flows, no form filling, no element clicking. It takes any URL and audits it.

Enterprise accessibility tools (Deque axe-monitor, Lighthouse CI, Pa11y) are all CLI/script-based. POM models specific pages; this framework is **page-agnostic**.

The project does include a [Playwright test spec](tests/accessibility-module.spec.ts) for CI/CD pass/fail gating — that's the correct hybrid: scripts for reporting, test spec for pipeline enforcement.

---

## Engines

| Engine | Command | Token? | What It Does |
|--------|---------|--------|-------------|
| **Axe-core** | `npm run a11y:axe` | None | Playwright + axe-core. WCAG 2.2 AA rules, custom 2.5.8 target-size check (24×24px). Two reports: all issues + actionable only. |
| **A11y Tree** | `npm run a11y:tree` | None | Chrome DevTools Protocol. Walks the accessibility tree (what screen readers see). Component inventory + nameless control detection + media review flags. |
| **Lighthouse** | `npm run a11y:lighthouse` | None | chrome-launcher + Lighthouse API. Extracts WCAG tags from internal Axe-core artifacts. Same audit as Chrome DevTools. |
| **WAVE API** | `npm run a11y:wave` | `WAVE_API_KEY` | WebAIM's paid WAVE API. The only engine requiring an external service. |
| **WAVE Browser** | `npm run a11y:wave-browser` | None | Launches Chromium with WAVE extension sideloaded. Manual capture → parse to Jira issues. |
| **WCAG Audit** | `npm run a11y:wcag` | None | Strict WCAG 2.2 AA / AODA compliance audit. Segregates into Pass/Fail/Manual/N-A with JSON output. |

---

## Quick Start

```bash
# Install dependencies
npm install
npx playwright install chromium

# Scan a URL (runs Axe-core + A11y Tree)
npm run a11y -- --url https://your-site.com

# Run all four free engines
npm run a11y:axe -- --url https://your-site.com
npm run a11y:tree -- --url https://your-site.com
npm run a11y:lighthouse -- --url https://your-site.com
```

Reports are written to `a11y-reports/` as HTML + CSV.

---

## Usage

### Default: Axe + A11y Tree (no API key)

```bash
# Single URL
npm run a11y -- --url https://your-site.com/page

# Multiple URLs
npm run a11y -- --url https://site-a.com --url https://site-b.com

# From CSV
npm run a11y -- --csv urls.csv
```

### Engine-specific

```bash
npm run a11y:axe -- --url https://your-site.com
npm run a11y:tree -- --url https://your-site.com
npm run a11y:lighthouse -- --url https://your-site.com
npm run a11y:wcag -- https://your-site.com       # strict WCAG 2.2 AA audit → JSON
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

## Report Format

Every issue across all engines uses a unified 8-section card:

| Section | Content |
|---------|---------|
| **Title** | Audit rule name |
| **Description** | What the rule checks |
| **Element(s)** | Actual DOM snippet / HTML |
| **Where located** | CSS selector or page region |
| **WCAG number** | e.g., WCAG 4.1.2 Name, Role, Value (Level A) |
| **WCAG cause of failure** | Why the current implementation violates the criterion |
| **Actual** | Current failing state |
| **Expected + proposed fix** | What compliance looks like + remediation guidance |

Each card has a **Copy for Jira** button that copies the full issue text.

### Report Files

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
│
├── engines/                    # Scan engines — the core workers
│   ├── axe-engine.ts           #   Axe-core via Playwright (WCAG 2.2 AA + 2.5.8 target size)
│   ├── a11y-tree-engine.ts     #   CDP Accessibility Tree walker (inventory + nameless detection)
│   ├── lighthouse-engine.ts    #   Lighthouse API via chrome-launcher (artifact WCAG extraction)
│   └── wave-engine.ts          #   WebAIM WAVE API client
│
├── scripts/                    # CLI entry points
│   ├── run-a11y.ts             #   Main CLI: --engine axe|tree|lighthouse|wave --url <url>
│   ├── run-wcag-audit.ts       #   Strict WCAG 2.2 AA / AODA compliance audit → JSON
│   ├── run-wave-browser.ts     #   Launch browser with WAVE extension for manual capture
│   └── wave-capture-to-jira.ts #   Parse WAVE capture → Jira-ready HTML/CSV/MD
│
├── utils/                      # Shared logic
│   ├── reporter.ts             #   Unified HTML + CSV report generator (all engines)
│   ├── wcag-dictionary.ts      #   WCAG tag translator + Lighthouse audit → WCAG mapping
│   ├── wave-capture-parser.ts  #   WAVE browser capture HTML → structured data
│   └── wave-wcag-reference.ts  #   WAVE finding type → WCAG criterion reference
│
├── types/                      # TypeScript interfaces
│   ├── a11y.types.ts           #   Axe, WAVE, report config types
│   ├── a11y-tree.types.ts      #   A11y Tree result types
│   └── lighthouse.types.ts     #   Lighthouse result types (with wcagTags)
│
├── tests/                      # CI/CD pipeline tests
│   └── accessibility-module.spec.ts  # Playwright test: fail pipeline on violations
│
├── docs/                       # Reference documentation
│   ├── wcag22aa-wave-reference.md
│   └── wave-report-comparison.md
│
├── a11y-reports/               # Generated reports (gitignored)
├── package.json
├── tsconfig.json
├── playwright.config.ts
└── .github/
    └── workflows/
        └── a11y-gate.yml       # GitHub Actions CI workflow
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
