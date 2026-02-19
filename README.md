# Accessibility Testing Suite (WCAG 2.2 AA / AODA)

Modular a11y testing with **Axe-core** and **WAVE API**. Reports are segregated by engine and written to `a11y-reports/`.

## Quick start

```bash
# Install
npm install
npx playwright install chromium

# Single URL, both engines
npm run a11y -- --url https://your-site.com/page

# Axe only
npm run a11y:axe -- --url http://localhost:3000

# WAVE only (requires WAVE_API_KEY)
WAVE_API_KEY=your_key npm run a11y:wave -- --url http://localhost:3000

# CSV of URLs, both engines
npm run a11y -- --csv urls.csv

# Interactive prompt (no flags)
npm run a11y
```

## WAVE script against localhost

```bash
WAVE_API_KEY=your_key npx tsx scripts/run-a11y.ts --url http://localhost:3000 --engine wave
```

## CI (Playwright test)

```bash
TARGET_URL=https://staging.example.com npx playwright test tests/accessibility-module.spec.ts
```

## Layout

- `types/a11y.types.ts` — WAVE + Axe + ReportConfig types
- `engines/axe-engine.ts` — Axe scan (wcag22aa, 24×24 target size, AODA rules)
- `engines/wave-engine.ts` — WAVE API client (exits fail if errors or contrast > 0)
- `utils/reporter.ts` — HTML + CSV reports with engine tag and “Copy for JIRA”
- `scripts/run-a11y.ts` — CLI: `--url`, `--csv`, `--engine axe|wave|both`
- `tests/accessibility-module.spec.ts` — Parameterized Axe test + manual checklist comments
