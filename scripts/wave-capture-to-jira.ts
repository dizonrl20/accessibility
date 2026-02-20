#!/usr/bin/env node
/**
 * Parse a WAVE browser capture HTML and output JIRA issues grouped by tab:
 * Details, Reference, Tab Order, Structure, Contrast.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { program } from 'commander';
import { parseWaveCaptureHtml, findingsToJiraIssues } from '../utils/wave-capture-parser.js';
import type { WaveJiraIssue, WaveCaptureTab } from '../types/a11y.types.js';

const REPORT_DIR = join(process.cwd(), 'a11y-reports');

program
  .option('--file <path>', 'WAVE capture HTML file (default: latest wave-browser-capture-*.html in a11y-reports)')
  .option('--url <url>', 'Source URL of the page (default: parsed from filename)')
  .option('--out-dir <path>', 'Output directory', REPORT_DIR)
  .option('--actionable-only', 'Only report Errors, Contrast, Alerts (match WAVE fix list; skip Features/Structure/ARIA)')
  .parse();

function getLatestCapturePath(): string | null {
  try {
    if (!statSync(REPORT_DIR).isDirectory()) return null;
  } catch {
    return null;
  }
  const files = readdirSync(REPORT_DIR)
    .filter((f) => f.startsWith('wave-browser-capture-') && f.endsWith('.html'))
    .map((f) => ({ name: f, mtime: statSync(join(REPORT_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return files.length ? join(REPORT_DIR, files[0].name) : null;
}

function urlFromFilename(filename: string): string {
  const match = filename.match(/wave-browser-capture-(.+?)-\d{4}-\d{2}-\d{2}T/);
  return match ? 'https://' + match[1].replace(/-/g, '.') : 'https://example.com';
}

function escapeCsv(s: string): string {
  const t = s.replace(/"/g, '""');
  return `"${t}"`;
}

function main(): void {
  const opts = program.opts<{ file?: string; url?: string; outDir: string; actionableOnly?: boolean }>();
  const htmlPath = opts.file ?? getLatestCapturePath();
  if (!htmlPath) {
    console.error('No WAVE capture file found. Use --file <path> or run a11y:wave-browser first.');
    process.exit(1);
  }
  const sourceUrl = opts.url ?? urlFromFilename(basename(htmlPath));
  mkdirSync(opts.outDir, { recursive: true });

  const findings = parseWaveCaptureHtml(htmlPath, sourceUrl);
  const issues = findingsToJiraIssues(findings, sourceUrl, undefined, { actionableOnly: opts.actionableOnly });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = sourceUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '-').slice(0, 40);

  const csvPath = join(opts.outDir, `wave-jira-${slug}-${ts}.csv`);
  const csvRows = [
    'Tab,Actionable,Summary,Description,JIRA Text',
    ...issues.map((i) =>
      [i.tab, i.actionable ? 'Yes' : 'Informational', escapeCsv(i.summary), escapeCsv(i.description.replace(/\n/g, ' ')), escapeCsv(i.jiraText.replace(/\n/g, ' '))].join(',')
    ),
  ];
  writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log('CSV:', csvPath);

  const mdPath = join(opts.outDir, `wave-jira-${slug}-${ts}.md`);
  const tabOrder: WaveCaptureTab[] = ['Details', 'Contrast', 'Structure', 'Tab Order', 'Reference'];
  const lines: string[] = [
    `# WAVE → JIRA issues`,
    `Source: ${sourceUrl}`,
    `Capture: ${htmlPath}`,
    '',
    '---',
  ];
  for (const tab of tabOrder) {
    const tabIssues = issues.filter((i) => i.tab === tab);
    if (tabIssues.length === 0) continue;
    lines.push(`## ${tab} tab`);
    lines.push('');
    tabIssues.forEach((issue, idx) => {
      lines.push(`### Issue ${idx + 1}`);
      lines.push('```');
      lines.push(issue.jiraText);
      lines.push('```');
      lines.push('');
    });
  }
  writeFileSync(mdPath, lines.join('\n'), 'utf8');
  console.log('Markdown:', mdPath);

  const htmlPathOut = join(opts.outDir, `wave-jira-${slug}-${ts}.html`);
  const html = buildJiraReportHtml(issues, sourceUrl, htmlPath, tabOrder);
  writeFileSync(htmlPathOut, html, 'utf8');
  console.log('HTML (copy for JIRA):', htmlPathOut);
  console.log(`\nTotal: ${issues.length} JIRA issues across ${new Set(issues.map((i) => i.tab)).size} tabs.`);
}

function buildJiraReportHtml(issues: WaveJiraIssue[], sourceUrl: string, capturePath: string, tabOrder: WaveCaptureTab[]): string {
  const byTab = new Map<WaveCaptureTab, WaveJiraIssue[]>();
  for (const i of issues) {
    const list = byTab.get(i.tab) ?? [];
    list.push(i);
    byTab.set(i.tab, list);
  }
  const actionableCount = issues.filter((i) => i.actionable).length;
  const informationalCount = issues.filter((i) => !i.actionable).length;
  const summaryLine =
    informationalCount > 0
      ? `<strong>${issues.length}</strong> total: <strong>${actionableCount} actionable</strong> (fix or review), <strong>${informationalCount} informational</strong> (inventory, no action unless wrong)`
      : `<strong>${issues.length}</strong> JIRA issue(s) across <strong>${new Set(issues.map((i) => i.tab)).size}</strong> tabs`;

  const sec = (title: string, content: string): string => {
    const v = (content ?? '').trim();
    if (!v || v === '—') return '';
    return `<div class="section"><div class="section-title">${escapeHtml(title)}</div><div class="section-content">${escapeHtml(v).replace(/\n/g, '<br/>')}</div></div>`;
  };
  const tabSections = tabOrder
    .filter((tab) => (byTab.get(tab)?.length ?? 0) > 0)
    .map(
      (tab) => `
    <section class="tab-section" data-tab="${tab}">
      <h2>${tab} tab</h2>
      ${(byTab.get(tab) ?? [])
        .map(
          (issue, idx) => {
            const title = issue.summary.replace(/^\[WAVE\]\[[^\]]+\]\s*/, '').trim() || `Issue ${idx + 1}`;
            const elements = 'See WAVE overlay on capture for highlighted element(s).';
            const whereLocated = `WAVE tab: ${tab}`;
            const sections = [
              sec('Title', title),
              sec('Description', issue.summary),
              sec('Element(s)', elements),
              sec('Where located', whereLocated),
              sec('WCAG number', issue.wcagNumber ?? '—'),
              sec('WCAG cause of failure', issue.wcagCause ?? '—'),
              sec('Actual', issue.actual ?? issue.summary),
              sec('Expected + proposed fix', issue.expectedFix ?? 'Fix per WAVE recommendation and WCAG criteria. Re-run WAVE to verify.'),
            ].join('');
            return `
        <div class="issue ${issue.actionable ? 'issue-actionable' : 'issue-informational'}">
          <h3>Issue ${idx + 1} <span class="status-pill status-${issue.actionable ? 'actionable' : 'informational'}">${issue.actionable ? 'Actionable' : 'Informational'}</span> <button type="button" class="copy-jira" data-text="${escapeAttr(issue.jiraText)}">Copy for JIRA</button></h3>
          ${sections}
          <pre class="jira-text jira-collapsed">${escapeHtml(issue.jiraText)}</pre>
        </div>`;
          }
        )
        .join('')}
    </section>`
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>WAVE → JIRA</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 2rem; background: #0d1117; color: #e6edf3; line-height: 1.6; max-width: 960px; margin-left: auto; margin-right: auto; }
    .header h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 600; color: #fff; }
    .header a { color: #58a6ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .meta { color: #8b949e; font-size: 0.875rem; margin-top: 0.25rem; }
    .user-scenarios { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.25rem; margin: 1.5rem 0; font-size: 0.9rem; color: #8b949e; }
    .user-scenarios strong { color: #e6edf3; }
    .summary-box { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
    .summary-box h3 { margin: 0; font-size: 1rem; color: #e6edf3; }
    .tab-section { margin-bottom: 2rem; }
    .tab-section h2 { color: #58a6ff; font-size: 1.1rem; border-bottom: 1px solid #30363d; padding-bottom: 0.5rem; margin-bottom: 1rem; }
    .issue { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    .issue-informational { border-left: 3px solid #3fb950; }
    .issue-actionable { border-left: 3px solid #f85149; }
    .issue h3 { margin: 0 0 0.75rem 0; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .issue .section { margin-top: 0.75rem; }
    .issue .section-title { font-size: 0.75rem; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 0.25rem; }
    .issue .section-content { font-size: 0.9rem; color: #e6edf3; }
    .jira-collapsed { margin-top: 0.75rem; }
    .status-pill { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; }
    .status-actionable { background: #f85149; color: #fff; }
    .status-informational { background: #3fb950; color: #0d1117; }
    .jira-text { white-space: pre-wrap; font-size: 0.8rem; overflow-x: auto; padding: 0.75rem; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-family: ui-monospace, monospace; }
    button.copy-jira { margin-left: auto; padding: 0.4rem 0.75rem; cursor: pointer; background: #238636; color: #fff; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 500; }
    button.copy-jira:hover { background: #2ea043; }
  </style>
</head>
<body>
  <div class="header">
    <h1>WAVE → JIRA issues</h1>
    <div class="meta"><a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a></div>
    <div class="meta">Capture: ${escapeHtml(capturePath)}</div>
  </div>
  <div class="user-scenarios">
    <strong>User scenarios:</strong> Use this report to copy each issue into JIRA with the button below it. Issues are grouped by WAVE tab (Details, Contrast, Structure, Tab Order, Reference).
  </div>
  <div class="summary-box">
    <h3>${summaryLine}</h3>
  </div>
  ${tabSections}
  <script>
    document.querySelectorAll('button.copy-jira').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var text = (this.getAttribute('data-text') || '').replace(/&#10;/g, '\\n');
        navigator.clipboard.writeText(text).then(function() { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy for JIRA'; }, 1500); });
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, '&#10;');
}

main();
