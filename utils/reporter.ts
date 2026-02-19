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
import type { A11yTreeResult, A11yTreeIssue } from '../types/a11y-tree.types.js';
import type { LighthouseResult } from '../types/lighthouse.types.js';

const REPORT_DIR = join(process.cwd(), 'a11y-reports');

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Renders one standard issue section (label + content). Omit if content empty. */
function sec(title: string, content: string): string {
  const v = (content ?? '').trim();
  if (!v || v === '—') return '';
  return `<div class="section"><div class="section-title">${escapeHtml(title)}</div><div class="section-content">${v}</div></div>`;
}

const EMBEDDED_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 2rem; background: #0d1117; color: #e6edf3; line-height: 1.6; max-width: 960px; margin-left: auto; margin-right: auto; }
  .header { margin-bottom: 1.5rem; }
  .header h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 600; color: #fff; }
  .header a { color: #58a6ff; text-decoration: none; }
  .header a:hover { text-decoration: underline; }
  .meta { color: #8b949e; font-size: 0.875rem; margin-top: 0.25rem; }
  .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.75rem; margin-left: 0.5rem; }
  .badge-axe { background: #238636; color: #fff; }
  .badge-wave { background: #1f6feb; color: #fff; }
  .badge-tree { background: #8957e5; color: #fff; }
  .badge-lighthouse { background: #f9ab00; color: #0d1117; }
  .user-scenarios { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; font-size: 0.9rem; color: #8b949e; }
  .user-scenarios strong { color: #e6edf3; }
  .summary-box { background: #3d1f1f; border: 1px solid #8b2c2c; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
  .summary-box.pass { background: #1a2e1a; border-color: #2d5a2d; }
  .summary-box h3 { margin: 0 0 0.5rem 0; font-size: 1rem; color: #f85149; }
  .summary-box.pass h3 { color: #3fb950; }
  .summary-box .counts { margin-top: 0.5rem; font-size: 0.875rem; color: #e6edf3; }
  .by-rule { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
  .by-rule h3 { margin: 0 0 0.75rem 0; font-size: 0.95rem; color: #e6edf3; }
  .by-rule ul { margin: 0; padding-left: 1.25rem; }
  .by-rule li { margin: 0.25rem 0; }
  .issue-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .issue-card h4 { margin: 0 0 0.75rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .issue-card .rule-id { font-family: ui-monospace, monospace; color: #e6edf3; }
  .severity-pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
  .severity-critical { background: #da3633; color: #fff; }
  .severity-serious { background: #f85149; color: #fff; }
  .severity-moderate { background: #d29922; color: #0d1117; }
  .severity-minor { background: #8b949e; color: #0d1117; }
  .issue-card .section { margin-top: 0.75rem; font-size: 0.875rem; }
  .issue-card .section-title { font-weight: 600; color: #8b949e; margin-bottom: 0.25rem; }
  .issue-card .section-content { color: #e6edf3; }
  .issue-card code { background: #0d1117; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.85em; }
  button.copy-jira { margin-left: auto; padding: 0.4rem 0.75rem; cursor: pointer; background: #238636; color: #fff; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 500; }
  button.copy-jira:hover { background: #2ea043; }
  button.copy-jira:active { background: #196c2e; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.6rem 0.75rem; border: 1px solid #30363d; }
  th { background: #161b22; color: #8b949e; font-weight: 600; font-size: 0.875rem; }
  tr:nth-child(even) { background: #161b22; }
  .copy-cell { width: 120px; }
  .pass { color: #3fb950; }
  .fail { color: #f85149; }
  .issue-card.issue-actionable { border-left: 3px solid #f85149; }
  .issue-card.issue-informational { border-left: 3px solid #3fb950; }
  .status-pill.status-actionable { background: #f85149; color: #fff; }
  .status-pill.status-informational { background: #3fb950; color: #0d1117; }
`;

export function generateReport(config: ReportConfig): { htmlPath: string; csvPath: string } {
  const { url, engineName, timestamp, data, actionableOnly, reportSuffix = '' } = config;
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '-').replace(/-+/g, '-').slice(0, 80);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const engineSlug = engineName.replace(/\s+/g, '-').toLowerCase();

  const htmlFilename = `report-${engineSlug}-${slug}-${ts}${reportSuffix}.html`;
  const csvFilename = `report-${engineSlug}-${slug}-${ts}${reportSuffix}.csv`;
  const htmlPath = join(REPORT_DIR, htmlFilename);
  const csvPath = join(REPORT_DIR, csvFilename);

  let htmlBody: string;
  let csvRows: string[];

  if (engineName === 'Axe-core' && 'violations' in data) {
    const axe = data as AxeResults;
    type AxeItem = { result: AxeResult; actionable: boolean };
    const items: AxeItem[] = actionableOnly
      ? axe.violations.map((v) => ({ result: v, actionable: true }))
      : [
          ...axe.violations.map((v) => ({ result: v, actionable: true })),
          ...axe.incomplete.map((i) => ({ result: i, actionable: false })),
        ];

    const totalNodes = items.reduce((sum, { result }) => sum + result.nodes.length, 0);
    const actionableCount = items.filter((i) => i.actionable).reduce((s, i) => s + i.result.nodes.length, 0);
    const informationalCount = totalNodes - actionableCount;
    const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    axe.violations.forEach((v) => {
      const imp = (v.impact ?? 'moderate').toLowerCase();
      if (imp in bySeverity) (bySeverity as Record<string, number>)[imp] += v.nodes.length;
      else bySeverity.moderate += v.nodes.length;
    });

    const csvHeaders = actionableOnly
      ? 'Engine,Rule ID,Severity,Summary,WCAG Tags,Selector/Node'
      : 'Engine,Rule ID,Severity,Actionable,Summary,WCAG Tags,Selector/Node';
    csvRows = [
      csvHeaders,
      ...items.flatMap(({ result: v, actionable }) =>
        v.nodes.map((n) => {
          const base = [engineName, v.id, v.impact ?? '', `"${(v.help ?? '').replace(/"/g, '""')}"`, v.tags.join('; '), `"${(n.target?.join(' ') ?? '').replace(/"/g, '""')}"`];
          if (actionableOnly) return base.join(',');
          return [engineName, v.id, v.impact ?? '', actionable ? 'Yes' : 'Informational', ...base.slice(3)].join(',');
        })
      ),
    ];

    const byRuleList = items
      .map(({ result: v, actionable }) => `<li><code>${escapeHtml(v.id)}</code>: ${v.nodes.length} node(s)${actionable ? '' : ' <span class="status-pill status-informational">Informational</span>'}</li>`)
      .join('');
    const wcagTagsToCriteria = (tags: string[]): string =>
      tags.filter((t) => /wcag|cat\./.test(t)).join(', ') || '—';
    const issueCards = items
      .map(
        (entry, idx) => {
          const v = entry.result;
          const impact = (v.impact ?? 'moderate').toLowerCase();
          const severityClass = impact in bySeverity ? `severity-${impact}` : 'severity-moderate';
          const jiraBase = `*Axe [${v.id}] ${v.impact ?? 'moderate'}*\n${v.help ?? ''}\nWCAG: ${v.tags.join(', ')}\nSelectors: ${v.nodes.map((n) => n.target?.join(' ')).join('; ')}`;
          const jiraPayload = escapeHtml(entry.actionable ? jiraBase : `*Status:* Informational (manual review)\n${jiraBase}`);
          const elementsSnippet = v.nodes.map((n) => (n.html ? `<code>${escapeHtml(n.html.slice(0, 300))}${n.html.length > 300 ? '…' : ''}</code>` : '')).filter(Boolean).join('<br/>') || v.nodes.map((n) => `<code>${escapeHtml(n.target?.join(' ') ?? '')}</code>`).join(', ') || '—';
          const whereLocated = v.nodes.map((n) => n.target?.join(' ') ?? '—').join('; ') || '—';
          const expectedFix = (v.description ?? v.help ?? '') + (v.helpUrl ? ` See: ${v.helpUrl}` : '');
          const cardClass = entry.actionable ? 'issue-actionable' : 'issue-informational';
          const pill = entry.actionable ? '<span class="severity-pill ' + severityClass + '">' + escapeHtml(String(v.impact ?? 'moderate')) + '</span>' : '<span class="status-pill status-informational">Informational</span>';
          const sections = [
            sec('Title', v.help ?? v.id),
            sec('Description', v.description ?? v.help ?? ''),
            sec('Element(s)', elementsSnippet),
            sec('Where located', whereLocated),
            sec('WCAG number', wcagTagsToCriteria(v.tags)),
            sec('WCAG cause of failure', v.description ?? ''),
            sec('Actual', v.help ?? ''),
            sec('Expected + proposed fix', expectedFix),
          ].join('');
          return `
      <div class="issue-card ${cardClass}" data-rule-id="${escapeHtml(v.id)}" data-impact="${escapeHtml(String(v.impact ?? ''))}" data-help="${escapeHtml(v.help ?? '')}" data-tags="${escapeHtml(v.tags.join(', '))}" data-selector="${escapeHtml(v.nodes.map((n) => n.target?.join(' ')).join('; '))}" data-actionable="${entry.actionable ? 'true' : 'false'}" data-jira="${jiraPayload}">
        <h4>
          <span>#${idx + 1}</span>
          <span class="rule-id">${escapeHtml(v.id)}</span>
          ${pill}
          <button class="copy-jira" type="button">Copy for JIRA</button>
        </h4>
        ${sections}
      </div>`;
        }
      )
      .join('');

    const summaryLine = actionableOnly
      ? `<strong>${actionableCount}</strong> violation node(s) across <strong>${axe.violations.length}</strong> rule(s) (actionable only)`
      : informationalCount > 0
        ? `<strong>${totalNodes}</strong> total: <strong>${actionableCount} actionable</strong> (fix or review), <strong>${informationalCount} informational</strong> (manual review)`
        : `<strong>${totalNodes}</strong> violation node(s) across <strong>${items.length}</strong> rule(s)`;

    htmlBody = `
      <div class="header">
        <h1>Accessibility Report (WCAG 2.2 AA)</h1>
        <div class="meta"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></div>
        <div class="meta">${timestamp} <span class="badge badge-axe">${engineName} + Playwright</span>${reportSuffix ? ' <span class="badge">' + (actionableOnly ? 'Actionable only' : 'All issues') + '</span>' : ''}</div>
      </div>
      <div class="user-scenarios">
        <strong>User scenarios:</strong> Use this report to (1) triage issues by impact, (2) fix violations using the "How to fix" and help links, (3) copy issue text into JIRA with the button, (4) treat Informational items as manual verification.
      </div>
      <div class="summary-box ${actionableOnly ? (actionableCount === 0 ? 'pass' : '') : totalNodes === 0 ? 'pass' : ''}">
        <h3>${summaryLine}</h3>
        ${actionableOnly || !axe.violations.length ? '' : `<div class="counts"><strong>${bySeverity.critical} critical</strong> · <strong>${bySeverity.serious} serious</strong> · <strong>${bySeverity.moderate} moderate</strong> · <strong>${bySeverity.minor} minor</strong></div>`}
      </div>
      <div class="by-rule">
        <h3>Issues grouped by rule</h3>
        <ul>${byRuleList || '<li>No issues.</li>'}</ul>
      </div>
      <h3 style="margin-bottom: 0.75rem; font-size: 1rem;">Detailed issues</h3>
      ${issueCards || '<p class="pass">No issues.</p>'}
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
        <div class="meta"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></div>
        <div class="meta">${timestamp} <span class="badge badge-wave">${engineName}</span></div>
      </div>
      <div class="user-scenarios">
        <strong>User scenarios:</strong> Use this report to (1) triage by category, (2) fix errors and contrast issues, (3) copy issue text into JIRA with the button.
      </div>
      <div class="summary-box ${totalErrors === 0 ? 'pass' : ''}">
        <h3><strong>${totalErrors}</strong> issue(s) (errors + contrast)</h3>
        <div class="counts">Errors: <strong>${errorCount}</strong> · Contrast: <strong>${contrastCount}</strong></div>
      </div>
      <table>
        <thead>
          <tr><th>Category</th><th>Issue ID</th><th>Description</th><th>Count</th><th class="copy-cell">JIRA</th></tr>
        </thead>
        <tbody>${waveRows.length ? waveRows.join('') : '<tr><td colspan="5">No errors or contrast issues.</td></tr>'}</tbody>
      </table>
    `;
  } else if (engineName === 'A11y Tree' && 'inventory' in data && 'issues' in data) {
    const tree = data as A11yTreeResult;
    const inv = tree.inventory;
    const treeKindToWcag: Record<string, string> = {
      'nameless-link': '2.4.4, 4.1.2',
      'nameless-button': '2.1.1, 4.1.2',
      'nameless-input': '1.3.1, 4.1.2',
      'video-no-captions': '1.2.2',
      'audio-no-transcript': '1.2.1',
      'iframe-no-title': '2.4.1',
    };
    const treeKindToExpected: Record<string, string> = {
      'nameless-link': 'Provide accessible name (visible text or aria-label) so purpose is clear to assistive tech.',
      'nameless-button': 'Provide accessible name (inner text or aria-label) so purpose is clear.',
      'nameless-input': 'Associate a visible label or use aria-label/aria-labelledby so the field is identified.',
      'video-no-captions': 'Provide captions for video; ensure captions are available or document as decorative.',
      'audio-no-transcript': 'Provide a transcript or document as decorative.',
      'iframe-no-title': 'Give the iframe a title attribute describing its content.',
    };
    const actionableCount = tree.issues.filter((i) => i.actionable).length;
    const informationalCount = tree.issues.filter((i) => !i.actionable).length;
    const summaryLine =
      tree.issues.length === 0
        ? `Component inventory: <strong>${inv.links} links</strong>, <strong>${inv.buttons} buttons</strong>, <strong>${inv.images} images</strong>, <strong>${inv.videos} videos</strong>, <strong>${inv.audio} audio</strong>, <strong>${inv.iframes} iframes</strong>. No issues flagged.`
        : informationalCount > 0
          ? `<strong>${tree.issues.length}</strong> issue(s): <strong>${actionableCount} actionable</strong> (fix or manual review), <strong>${informationalCount} informational</strong>`
          : `<strong>${tree.issues.length}</strong> actionable issue(s) (fix or manual review)`;

    csvRows = [
      'Engine,Type,Kind,Actionable,Summary',
      `A11y Tree,inventory,links,—,${inv.links}`,
      `A11y Tree,inventory,buttons,—,${inv.buttons}`,
      `A11y Tree,inventory,images,—,${inv.images}`,
      `A11y Tree,inventory,videos,—,${inv.videos}`,
      `A11y Tree,inventory,audio,—,${inv.audio}`,
      `A11y Tree,inventory,iframes,—,${inv.iframes}`,
      ...tree.issues.map((i) =>
        [engineName, 'issue', i.kind, i.actionable ? 'Yes' : 'Informational', `"${(i.summary ?? '').replace(/"/g, '""')}"`].join(',')
      ),
    ];
    const issueCards = tree.issues
      .map(
        (i, idx) => {
          const cardClass = i.actionable ? 'issue-actionable' : 'issue-informational';
          const pillClass = i.actionable ? 'status-actionable' : 'status-informational';
          const pillLabel = i.actionable ? 'Actionable' : 'Informational';
          const jiraText = i.actionable
            ? `*A11y Tree [${i.kind}]*\n${i.summary}\nRole: ${i.role}${i.name ? ` | Name: ${i.name}` : ''}`
            : `*Status:* Informational\n*A11y Tree [${i.kind}]*\n${i.summary}`;
          const jiraPayload = escapeHtml(jiraText);
          const wcagNum = treeKindToWcag[i.kind] ?? '—';
          const expectedFix = treeKindToExpected[i.kind] ?? i.summary ?? '—';
          const elementDesc = [i.role, i.name].filter(Boolean).join(' · ') || '—';
          const sections = [
            sec('Title', i.summary ?? i.kind),
            sec('Description', i.summary ?? ''),
            sec('Element(s)', elementDesc),
            sec('Where located', '— (see tree / page for context)'),
            sec('WCAG number', wcagNum),
            sec('WCAG cause of failure', i.summary ?? ''),
            sec('Actual', [i.role, i.name].filter(Boolean).join(' · ') || 'No accessible name'),
            sec('Expected + proposed fix', expectedFix),
          ].join('');
          return `
      <div class="issue-card ${cardClass}" data-jira="${jiraPayload}">
        <h4>
          <span>#${idx + 1}</span>
          <span class="rule-id">${escapeHtml(i.kind)}</span>
          <span class="status-pill ${pillClass}">${pillLabel}</span>
          <button class="copy-jira" type="button">Copy for JIRA</button>
        </h4>
        ${sections}
      </div>`;
        }
      )
      .join('');

    htmlBody = `
      <div class="header">
        <h1>Accessibility Report — Component inventory &amp; tree issues</h1>
        <div class="meta"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></div>
        <div class="meta">${timestamp} <span class="badge badge-tree">${engineName}</span></div>
      </div>
      <div class="user-scenarios">
        <strong>User scenarios:</strong> Use this report to (1) see what interactables and media exist (inventory), (2) fix nameless links/buttons/inputs, (3) create manual-review tickets for video/audio (captions, audio description), (4) copy issue text into JIRA with the button.
      </div>
      <div class="summary-box ${tree.issues.length === 0 ? 'pass' : ''}">
        <h3>${summaryLine}</h3>
        <div class="counts">Inventory: <strong>${inv.links} links</strong> · <strong>${inv.buttons} buttons</strong> · <strong>${inv.images} images</strong> · <strong>${inv.videos} videos</strong> · <strong>${inv.audio} audio</strong> · <strong>${inv.iframes} iframes</strong></div>
      </div>
      <h3 style="margin-bottom: 0.75rem; font-size: 1rem;">Issues (nameless controls, media manual review)</h3>
      ${issueCards || '<p class="pass">No issues.</p>'}
    `;
  } else if (engineName === 'Lighthouse' && 'issues' in data && 'score' in data) {
    const lh = data as LighthouseResult;
    const lhAuditToWcag: Record<string, string> = {
      'aria-valid-attr-value': '4.1.2',
      'aria-valid-attr': '4.1.2',
      'button-name': '2.1.1, 4.1.2',
      'bypass': '2.4.1',
      'color-contrast': '1.4.3',
      'document-title': '2.4.2',
      'duplicate-id-aria': '4.1.1',
      'form-field-multiple-labels': '3.3.2',
      'frame-title': '2.4.1',
      'html-has-lang': '3.1.1',
      'html-lang-valid': '3.1.1',
      'image-alt': '1.1.1',
      'input-image-alt': '1.1.1',
      'label': '1.3.1, 4.1.2',
      'link-name': '2.4.4, 4.1.2',
      'list': '1.3.1',
      'listitem': '1.3.1',
      'meta-refresh': '2.2.1',
      'meta-viewport': '1.4.4',
      'object-alt': '1.1.1',
      'tabindex': '2.4.3',
      'td-headers-attr': '1.3.1',
      'th-has-data-cells': '1.3.1',
      'valid-aria-role': '4.1.2',
      'video-caption': '1.2.2',
    };
    const issueCards = lh.issues
      .map((issue, idx) => {
        const jiraText = `*Lighthouse [${issue.id}]* ${issue.title}\n${issue.description}\n${issue.items?.length ? 'Elements: ' + issue.items.map((i) => i.selector || i.snippet || '').filter(Boolean).join('; ') : ''}`;
        const jiraPayload = escapeHtml(jiraText);
        const elementsSnippet =
          issue.items?.length > 0
            ? issue.items.map((i) => `<code>${escapeHtml((i.snippet || i.selector || i.nodeLabel || '—').slice(0, 300))}${(i.snippet?.length ?? 0) > 300 ? '…' : ''}</code>`).join('<br/>')
            : '—';
        const whereLocated =
          issue.items?.length > 0
            ? issue.items.map((i) => i.selector || i.snippet || i.nodeLabel || '—').join('; ')
            : '—';
        const wcagNum = lhAuditToWcag[issue.id] ?? '—';
        const sections = [
          sec('Title', issue.title),
          sec('Description', issue.description ?? ''),
          sec('Element(s)', elementsSnippet),
          sec('Where located', whereLocated),
          sec('WCAG number', wcagNum),
          sec('WCAG cause of failure', issue.description ?? ''),
          sec('Actual', issue.displayValue ?? issue.title ?? ''),
          sec('Expected + proposed fix', issue.description + ' See Lighthouse accessibility docs for this audit.'),
        ].join('');
        return `
      <div class="issue-card issue-actionable" data-jira="${jiraPayload}">
        <h4>
          <span>#${idx + 1}</span>
          <span class="rule-id">${escapeHtml(issue.id)}</span>
          <span class="severity-pill severity-serious">Failed</span>
          <button class="copy-jira" type="button">Copy for JIRA</button>
        </h4>
        ${sections}
      </div>`;
      })
      .join('');

    csvRows = [
      'Engine,Audit ID,Title,Description,Elements',
      ...lh.issues.flatMap((i) =>
        (i.items?.length ? i.items : [{}]).map((item) =>
          [
            engineName,
            i.id,
            `"${(i.title ?? '').replace(/"/g, '""')}"`,
            `"${(i.description ?? '').replace(/"/g, '""')}"`,
            `"${(item.selector || item.snippet || '').replace(/"/g, '""')}"`,
          ].join(',')
        )
      ),
    ];
    if (lh.issues.length === 0) csvRows.push(`${engineName},—,No failed audits,—,—`);

    htmlBody = `
      <div class="header">
        <h1>Accessibility Report — Lighthouse</h1>
        <div class="meta"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></div>
        <div class="meta">${timestamp} <span class="badge badge-lighthouse">${engineName}</span> · Score: ${Math.round((lh.score ?? 0) * 100)}</div>
      </div>
      <div class="user-scenarios">
        <strong>User scenarios:</strong> Same audits as DevTools Lighthouse accessibility. Use this report to fix failed audits and copy issue text into JIRA.
      </div>
      <div class="summary-box ${lh.issues.length === 0 ? 'pass' : ''}">
        <h3><strong>${lh.issues.length}</strong> failed audit(s) · Accessibility score: <strong>${Math.round((lh.score ?? 0) * 100)}</strong></h3>
      </div>
      <h3 style="margin-bottom: 0.75rem; font-size: 1rem;">Failed audits</h3>
      ${issueCards || '<p class="pass">No failed audits.</p>'}
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
    function decodeAttr(s) {
      if (!s) return '';
      return s.replace(/&#10;/g, '\\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    function copyToJira(btn) {
      var card = btn.closest('.issue-card');
      var row = btn.closest('tr');
      var jiraText;
      if (card && card.getAttribute('data-jira')) {
        jiraText = decodeAttr(card.getAttribute('data-jira'));
      } else if (card && card.dataset.ruleId !== undefined) {
        jiraText = '*Axe [' + card.dataset.ruleId + '] ' + (card.dataset.impact || '') + '*\\n' + (card.dataset.help || '') + '\\nWCAG: ' + (card.dataset.tags || '') + '\\nSelectors: ' + (card.dataset.selector || '');
      } else if (row && row.dataset.ruleId !== undefined) {
        jiraText = '*Axe [' + row.dataset.ruleId + '] ' + (row.dataset.impact || '') + '* | ' + (row.dataset.help || '') + ' | WCAG: ' + (row.dataset.tags || '') + ' | Selectors: ' + (row.dataset.selector || '');
      } else if (row) {
        jiraText = '*WAVE ' + (row.dataset.category || '') + '* | ' + (row.dataset.id || '') + ' | ' + (row.dataset.desc || '') + ' | Count: ' + (row.dataset.count || '0');
      } else return;
      navigator.clipboard.writeText(jiraText.replace(/\\\\n/g, '\\n')).then(function() { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy for JIRA'; }, 1500); });
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
