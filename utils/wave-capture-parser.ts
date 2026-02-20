/**
 * Parse WAVE browser capture HTML and extract findings from wave5icon alt text.
 * Map to WAVE sidebar tabs: Details, Reference, Tab Order, Structure, Contrast.
 * Uses docs/wcag22aa-wave-reference.md (and utils/wave-wcag-reference.ts) for "why it fails" and WCAG criterion.
 */
import { readFileSync } from 'fs';
import type { WaveCaptureFinding, WaveCaptureTab, WaveJiraIssue } from '../types/a11y.types.js';
import { getWcagRefForFinding } from './wave-wcag-reference.js';

const WAVE_ICON_ALT_REGEX = /class="wave5icon"[^>]*alt="([^"]+)"/gi;
const ALT_CATEGORY_REGEX = /^(ERRORS?|CONTRAST\s+ERRORS?|ALERTS?|FEATURES?|STRUCTURAL\s+ELEMENTS?|ARIA):\s*(.+)$/i;

function categoryToTab(category: string): WaveCaptureTab {
  const c = category.toUpperCase();
  if (c.includes('CONTRAST')) return 'Contrast';
  if (c.includes('STRUCTURAL') || c.includes('HEADING') || c.includes('STRUCTURE')) return 'Structure';
  if (c.includes('ARIA')) return 'Details';
  if (c.includes('ERROR') || c.includes('ALERT')) return 'Details';
  if (c.includes('FEATURE')) return 'Structure';
  return 'Details';
}

function wcagRefFor(category: string, description: string): string | undefined {
  const ref = getWcagRefForFinding(description, category);
  return ref ? ref.criteria.join(' | ') : undefined;
}

/** True if WAVE category is Errors, Contrast Errors, or Alerts (actionable for JIRA). Features/Structure/ARIA are informational. */
export function isActionableFinding(category: string): boolean {
  const c = category.toUpperCase();
  return c.includes('ERROR') || c.includes('CONTRAST') || c.includes('ALERT');
}

export function parseWaveCaptureHtml(htmlPath: string, sourceUrl: string): WaveCaptureFinding[] {
  const html = readFileSync(htmlPath, 'utf8');
  const findings: WaveCaptureFinding[] = [];
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = WAVE_ICON_ALT_REGEX.exec(html)) !== null) {
    const alt = m[1].trim();
    if (!alt || seen.has(alt)) continue;
    seen.add(alt);
    const match = ALT_CATEGORY_REGEX.exec(alt);
    const category = match ? match[1].trim() : 'Other';
    const description = match ? match[2].trim() : alt;
    const tab = categoryToTab(category);
    const wcagRef = wcagRefFor(category, description);
    findings.push({ category, description, tab, wcagRef });
  }
  return findings;
}

export function findingsToJiraIssues(
  findings: WaveCaptureFinding[],
  sourceUrl: string,
  pageTitle?: string,
  options?: { actionableOnly?: boolean }
): WaveJiraIssue[] {
  const list = options?.actionableOnly ? findings.filter((f) => isActionableFinding(f.category)) : findings;
  const issues: WaveJiraIssue[] = [];
  const byTab = new Map<WaveCaptureTab, WaveCaptureFinding[]>();
  for (const f of list) {
    const list = byTab.get(f.tab) ?? [];
    list.push(f);
    byTab.set(f.tab, list);
  }
  // Tab Order: placeholder = actionable (manual check)
  if (!byTab.has('Tab Order')) {
    byTab.set('Tab Order', [
      { category: 'Tab Order', description: 'Manual check: Verify keyboard tab order matches visual order and all interactive elements are reachable.', tab: 'Tab Order' },
    ]);
  }
  // Mark Tab Order and Reference as actionable only for manual/ref; others use isActionableFinding(category)
  const isActionable = (finding: WaveCaptureFinding): boolean =>
    finding.tab === 'Tab Order' ? true : finding.tab === 'Reference' ? false : isActionableFinding(finding.category);
  // Reference: derive from other findings' WCAG refs
  const refSet = new Set<string>();
  for (const f of findings) {
    if (f.wcagRef) refSet.add(f.wcagRef);
  }
  if (refSet.size > 0 && !byTab.has('Reference')) {
    byTab.set('Reference', [{ category: 'Reference', description: Array.from(refSet).join(' | '), tab: 'Reference', wcagRef: Array.from(refSet).join('; ') }]);
  }

  for (const [tab, list] of byTab) {
    for (const f of list) {
      const actionable = isActionable(f);
      const summary = `[WAVE][${tab}] ${f.description.slice(0, 80)}${f.description.length > 80 ? '…' : ''}`;
      const wcagRef = getWcagRefForFinding(f.description, f.category);
      const whyBlock =
        wcagRef ?
          [
            '',
            '*Why this fails (WCAG 2.2 AA):*',
            wcagRef.why,
            '',
            `*Fails:* ${wcagRef.criteria.join(' | ')}`,
          ].join('\n')
        : (f.wcagRef ? `\n\n*Fails:* ${f.wcagRef}` : '');
      const body = [
        `*Source:* ${sourceUrl}`,
        pageTitle ? `*Page:* ${pageTitle}` : '',
        `*WAVE tab:* ${tab}`,
        `*Category:* ${f.category}`,
        `*Description:* ${f.description}`,
        whyBlock,
        '',
        'h3. Reproduction',
        '(Steps to reproduce and verify the issue.)',
        '# Run the WAVE browser extension on the page.',
        `# Open the WAVE sidebar → ${tab} tab.`,
        '# Locate this finding and fix the underlying cause (see "Why this fails" and WCAG link).',
        '# Re-run WAVE to confirm the issue is resolved.',
      ].filter(Boolean).join('\n');
      const bodyWithStatus = actionable ? body : `*Status:* Informational (no action required unless incorrect or missing)\n\n${body}`;
      const jiraText = `${summary}\n\n${bodyWithStatus}`;
      issues.push({
        tab,
        summary,
        description: bodyWithStatus,
        jiraText,
        actionable,
        wcagNumber: wcagRef ? wcagRef.criteria.join(', ') : undefined,
        wcagCause: wcagRef?.why,
        actual: f.description,
        expectedFix: wcagRef ? `${wcagRef.why} Fix per WCAG: ${wcagRef.criteria.join(', ')}.` : undefined,
      });
    }
  }
  return issues;
}
