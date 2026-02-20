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

/** From WAVE capture HTML, get the element snippet immediately after the icon (next tag or wave5text content). Skips consecutive wave5icon img tags. */
function getElementInfoAfterIcon(html: string, iconEndIndex: number): string | undefined {
  let offset = 0;
  const after = html.slice(iconEndIndex);
  for (let i = 0; i < 5; i++) {
    const nextOpen = after.slice(offset).search(/</);
    if (nextOpen === -1) return undefined;
    const start = offset + nextOpen;
    const frag = after.slice(start, start + 400);
    const tagMatch = frag.match(/^<([a-zA-Z][a-zA-Z0-9]*)\s*/);
    if (!tagMatch) return undefined;
    const tag = tagMatch[1].toLowerCase();
    if (tag === 'img' && frag.includes('wave5icon')) {
      const close = frag.indexOf('>');
      offset = start + (close === -1 ? tagMatch[0].length : close + 1);
      continue;
    }
    if (tag === 'span' && frag.includes('wave5text')) {
      const inner = frag.match(/wave5text[^>]*>([^<]*)</);
      if (inner?.[1]) {
        const text = inner[1].replace(/\*/g, '').trim();
        return text || undefined;
      }
    }
    if (['noscript', 'nav', 'header', 'footer', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'button', 'a', 'input', 'select', 'textarea', 'label', 'img', 'iframe', 'form', 'section', 'article', 'aside', 'figure', 'figcaption', 'table', 'th', 'td', 'tr'].includes(tag)) {
      const fullTag = frag.match(/^<[^>]+>/);
      const raw = fullTag ? fullTag[0] : `<${tag}>`;
      return raw.length > 120 ? raw.slice(0, 117) + '...' : raw;
    }
    return undefined;
  }
  return undefined;
}

/** Fallback element hint from WAVE description when capture snippet is not available */
function elementHintFromDescription(description: string): string {
  const d = description.toLowerCase();
  if (d.includes('noscript')) return '<noscript>';
  if (d.includes('heading level 1') || d.includes('h1')) return '<h1>';
  if (d.includes('heading level 2') || d.includes('h2')) return '<h2>';
  if (d.includes('heading level 3') || d.includes('h3')) return '<h3>';
  if (d.includes('heading level 4') || d.includes('h4')) return '<h4>';
  if (d.includes('heading level 5') || d.includes('h5')) return '<h5>';
  if (d.includes('heading level 6') || d.includes('h6')) return '<h6>';
  if (d.includes('navigation')) return '<nav>';
  if (d.includes('header')) return '<header>';
  if (d.includes('footer')) return '<footer>';
  if (d.includes('main')) return '<main>';
  if (d.includes('unordered list') || d.includes('ul')) return '<ul>';
  if (d.includes('ordered list') || d.includes('ol')) return '<ol>';
  if (d.includes('list item') || d.includes('li')) return '<li>';
  if (d.includes('button')) return '<button>';
  if (d.includes('link') || d.includes('skip link')) return '<a>';
  if (d.includes('missing form label') || d.includes('missing label')) return '<input> or <select> (missing associated <label>)';
  if (d.includes('empty form label')) return '<input> / <select> (empty or ineffective <label>)';
  if (d.includes('multiple form labels')) return '<input> / <select> (multiple <label>s)';
  if (d.includes('missing alternative') || d.includes('alt')) return '<img> (missing or empty alt)';
  if (d.includes('aria label')) return 'element with aria-label';
  if (d.includes('aria expanded')) return 'element with aria-expanded';
  if (d.includes('aria ') || d.includes('role=')) return 'element with ARIA role/attribute';
  if (d.includes('language') || d.includes('lang')) return 'element with lang/hreflang';
  if (d.includes('skipped heading')) return '<h2>–<h6> (heading level skipped in sequence)';
  if (d.includes('redundant link')) return '<a> (redundant with adjacent link)';
  if (d.includes('empty button')) return '<button>';
  return description;
}

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
    const endOfImg = html.indexOf('>', m.index);
    const elementInfo =
      endOfImg !== -1
        ? getElementInfoAfterIcon(html, endOfImg + 1)
        : undefined;
    findings.push({
      category,
      description,
      tab,
      wcagRef,
      elementInfo: elementInfo ?? elementHintFromDescription(description),
    });
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
        f.elementInfo ? `*Element(s):* ${f.elementInfo}` : '',
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
        elements: f.elementInfo,
      });
    }
  }
  return issues;
}
