import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  ReportConfig,
  AxeResults,
  AxeResult,
  WaveApiResponse,
  WaveApiCategories,
  TestingEngine,
} from '../types/a11y.types.js';

const REPORT_DIR = join(process.cwd(), 'a11y-reports');

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EMBEDDED_CSS = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #1a1a2e; color: #eee; line-height: 1.5; }
  .header { margin-bottom: 1.5rem; padding: 1rem; background: #16213e; border-radius: 8px; }
  .header h1 { margin: 0 0 0.5rem 0; font-size: 1.25rem; }
  .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.875rem; }
  .badge-axe { background: #0f3460; color: #e94560; }
  .badge-wave { background: #0f3460; color: #0f9; }
  .meta { color: #888; font-size: 0.875rem; margin-top: 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border: 1px solid #333; }
  th { background: #16213e; }
  tr:nth-child(even) { background: #1a1a2e; }
  .copy-cell { width: 120px; }
  button.copy-jira { padding: 0.35rem 0.75rem; cursor: pointer; background: #e94560; color: #fff; border: none; border-radius: 4px; font-size: 0.8rem; }
  button.copy-jira:hover { background: #c73e54; }
  .pass { color: #0f9; }
  .fail { color: #e94560; }
`;

export function generateReport(config: ReportConfig): { htmlPath: string; csvPath: string } {
  const { url, engineName, timestamp, data } = config;
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '-').replace(/-+/g, '-').slice(0, 80);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const engineSlug = engineName.replace(/\s+/g, '-').toLowerCase();

  const htmlFilename = `report-${engineSlug}-${slug}-${ts}.html`;
  const csvFilename = `report-${engineSlug}-${slug}-${ts}.csv`;
  const htmlPath = join(REPORT_DIR, htmlFilename);
  const csvPath = join(REPORT_DIR, csvFilename);

  let htmlBody: string;
  let csvRows: string[];

  if (engineName === 'Axe-core' && 'violations' in data) {
    const axe = data as AxeResults;
    csvRows = [
      'Engine,Rule ID,Severity,Summary,WCAG Tags,Selector/Node',
      ...axe.violations.flatMap((v) =>
        v.nodes.map((n) =>
          [
            engineName,
            v.id,
            v.impact ?? '',
            `"${(v.help ?? '').replace(/"/g, '""')}"`,
            v.tags.join('; '),
            `"${(n.target?.join(' ') ?? '').replace(/"/g, '""')}"`,
          ].join(',')
        )
      ),
    ];
    htmlBody = `
      <div class="header">
        <h1>Accessibility Report (WCAG 2.2 AA)</h1>
        <span class="badge badge-axe">Testing Engine: ${engineName}</span>
        <div class="meta">URL: ${escapeHtml(url)} | ${timestamp}</div>
      </div>
      <p>Violations: <span class="${axe.violations.length > 0 ? 'fail' : 'pass'}">${axe.violations.length}</span></p>
      <table>
        <thead>
          <tr><th>Rule ID</th><th>Impact</th><th>Help</th><th>WCAG Tags</th><th>Selector/Node</th><th class="copy-cell">JIRA</th></tr>
        </thead>
        <tbody>
          ${axe.violations
            .flatMap((v, vIdx) =>
              v.nodes.map(
                (n, nIdx) => `
            <tr data-rule-id="${escapeHtml(v.id)}" data-impact="${escapeHtml(String(v.impact ?? ''))}" data-help="${escapeHtml(v.help ?? '')}" data-tags="${escapeHtml(v.tags.join(', '))}" data-selector="${escapeHtml(n.target?.join(' ') ?? '')}">
              <td>${escapeHtml(v.id)}</td>
              <td>${escapeHtml(String(v.impact ?? ''))}</td>
              <td>${escapeHtml(v.help ?? '')}</td>
              <td>${v.tags.join(', ')}</td>
              <td>${escapeHtml(n.target?.join(' ') ?? '')}</td>
              <td class="copy-cell"><button class="copy-jira" type="button">Copy for JIRA</button></td>
            </tr>`
              )
            )
            .join('')}
        </tbody>
      </table>
    `;
  } else if (engineName === 'WAVE API' && 'categories' in data) {
    const wave = data as WaveApiResponse;
    const categories = wave.categories as WaveApiCategories;
    const errorCount = categories.error?.count ?? 0;
    const contrastCount = categories.contrast?.count ?? 0;
    const errorItems = Array.isArray(categories.error?.items) ? (categories.error!.items as { id?: string; description?: string; count?: number }[]) : [];
    const contrastItems = Array.isArray(categories.contrast?.items) ? (categories.contrast!.items as { id?: string; description?: string; count?: number }[]) : [];
    const totalErrors = errorCount + contrastCount;

    csvRows = [
      'Engine,Category,Issue ID,Description,Count',
      ...errorItems.map((i) =>
        [engineName, 'error', i.id ?? '', `"${(i.description ?? '').replace(/"/g, '""')}"`, i.count ?? 0].join(',')
      ),
      ...contrastItems.map((i) =>
        [engineName, 'contrast', i.id ?? '', `"${(i.description ?? '').replace(/"/g, '""')}"`, i.count ?? 0].join(',')
      ),
    ];
    if (csvRows.length === 1) csvRows.push(`${engineName},error,—,Errors (summary),${errorCount}`, `${engineName},contrast,—,Contrast (summary),${contrastCount}`);

    const waveRows =
      errorItems.length > 0 || contrastItems.length > 0
        ? [
            ...errorItems.map(
              (i: { id?: string; description?: string; count?: number }) =>
                `<tr data-category="error" data-id="${escapeHtml(String(i.id ?? ''))}" data-desc="${escapeHtml(String(i.description ?? ''))}" data-count="${i.count ?? 0}"><td>error</td><td>${escapeHtml(String(i.id ?? ''))}</td><td>${escapeHtml(String(i.description ?? ''))}</td><td>${i.count ?? 0}</td><td class="copy-cell"><button class="copy-jira" type="button">Copy for JIRA</button></td></tr>`
            ),
            ...contrastItems.map(
              (i: { id?: string; description?: string; count?: number }) =>
                `<tr data-category="contrast" data-id="${escapeHtml(String(i.id ?? ''))}" data-desc="${escapeHtml(String(i.description ?? ''))}" data-count="${i.count ?? 0}"><td>contrast</td><td>${escapeHtml(String(i.id ?? ''))}</td><td>${escapeHtml(String(i.description ?? ''))}</td><td>${i.count ?? 0}</td><td class="copy-cell"><button class="copy-jira" type="button">Copy for JIRA</button></td></tr>`
            ),
          ]
        : [
            `<tr data-category="error" data-id="" data-desc="Errors" data-count="${errorCount}"><td>error</td><td>—</td><td>Errors (summary)</td><td>${errorCount}</td><td class="copy-cell"><button class="copy-jira" type="button">Copy for JIRA</button></td></tr>`,
            `<tr data-category="contrast" data-id="" data-desc="Contrast" data-count="${contrastCount}"><td>contrast</td><td>—</td><td>Contrast (summary)</td><td>${contrastCount}</td><td class="copy-cell"><button class="copy-jira" type="button">Copy for JIRA</button></td></tr>`,
          ];

    htmlBody = `
      <div class="header">
        <h1>Accessibility Report (WCAG 2.2 AA)</h1>
        <span class="badge badge-wave">Testing Engine: ${engineName}</span>
        <div class="meta">URL: ${escapeHtml(url)} | ${timestamp}</div>
      </div>
      <p>Errors + Contrast: <span class="${totalErrors > 0 ? 'fail' : 'pass'}">${totalErrors}</span></p>
      <table>
        <thead>
          <tr><th>Category</th><th>Issue ID</th><th>Description</th><th>Count</th><th class="copy-cell">JIRA</th></tr>
        </thead>
        <tbody>${waveRows.length ? waveRows.join('') : '<tr><td colspan="5">No errors or contrast issues.</td></tr>'}</tbody>
      </table>
    `;
  } else {
    csvRows = ['Engine,Note', `${engineName},Unknown data shape`];
    htmlBody = `<div class="header"><h1>Accessibility Report</h1><span class="badge">Testing Engine: ${engineName}</span><div class="meta">${escapeHtml(url)} | ${timestamp}</div></div><p>No violation table (unknown data).</p>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>A11y Report — ${engineName}</title>
  <style>${EMBEDDED_CSS}</style>
</head>
<body>
  ${htmlBody}
  <script>
    function copyToJira(btn) {
      var row = btn.closest('tr');
      var jiraText;
      if (row.dataset.ruleId !== undefined) {
        jiraText = '*Axe [' + row.dataset.ruleId + '] ' + (row.dataset.impact || '') + '* | ' + (row.dataset.help || '') + ' | WCAG: ' + (row.dataset.tags || '') + ' | Selectors: ' + (row.dataset.selector || '');
      } else {
        jiraText = '*WAVE ' + (row.dataset.category || '') + '* | ' + (row.dataset.id || '') + ' | ' + (row.dataset.desc || '') + ' | Count: ' + (row.dataset.count || '0');
      }
      navigator.clipboard.writeText(jiraText).then(function() { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy for JIRA'; }, 1500); });
    }
    document.querySelectorAll('button.copy-jira').forEach(function(b) { b.addEventListener('click', function() { copyToJira(b); }); });
  </script>
</body>
</html>`;

  try {
    mkdirSync(REPORT_DIR, { recursive: true });
  } catch {
    /* dir may exist */
  }
  writeFileSync(htmlPath, html, 'utf8');
  writeFileSync(csvPath, csvRows.join('\n'), 'utf8');

  return { htmlPath, csvPath };
}
