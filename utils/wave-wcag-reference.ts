/**
 * WCAG 2.2 AA reference for WAVE findings: why each fails and which criterion.
 * See docs/wcag22aa-wave-reference.md for the full document.
 */
export interface WcagRef {
  why: string;
  criteria: string[];
}

/** Key: normalized phrase (lowercase). Value: explanation + WCAG criteria. */
export const WAVE_WCAG_REF: Record<string, WcagRef> = {
  'noscript element': {
    why: 'Content inside <noscript> is only shown when JavaScript is off. If the page relies on JS, users who disable it or use assistive tech that does not run JS may get no equivalent content or functionality.',
    criteria: ['WCAG 2.1.1 Keyboard (Level A)', 'WCAG 1.1.1 Non-text Content (Level A)'],
  },
  'missing form label': {
    why: 'Inputs without an associated <label> or aria-label are not announced properly by screen readers; users do not know what to enter.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)', 'WCAG 2.4.6 Headings and Labels (Level AA)', 'WCAG 3.3.2 Labels or Instructions (Level A)'],
  },
  'empty form label': {
    why: 'A label exists but has no text, so it provides no usable name for the control.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)', 'WCAG 3.3.2 Labels or Instructions (Level A)'],
  },
  'missing alternative text': {
    why: 'Images without alt (or appropriate ARIA) are invisible to screen reader users.',
    criteria: ['WCAG 1.1.1 Non-text Content (Level A)'],
  },
  'very low contrast': {
    why: 'Text that does not meet contrast ratios is hard or impossible to read for people with low vision or in poor light.',
    criteria: ['WCAG 1.4.3 Contrast (Minimum) (Level AA)'],
  },
  'language missing': {
    why: 'Missing or wrong lang on <html> prevents correct pronunciation and language switching for screen readers.',
    criteria: ['WCAG 3.1.1 Language of Page (Level A)'],
  },
  'empty heading': {
    why: 'Headings with no content do not provide structure and can confuse navigation.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)', 'WCAG 2.4.6 Headings and Labels (Level AA)'],
  },
  'empty button': {
    why: 'Buttons with no visible or accessible name cannot be understood or used reliably.',
    criteria: ['WCAG 2.4.4 Link Purpose (Level A)', 'WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'empty link': {
    why: 'Links with no visible or accessible name cannot be understood or used reliably.',
    criteria: ['WCAG 2.4.4 Link Purpose (Level A)', 'WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'possible heading': {
    why: 'Text that looks like a heading but is not marked with heading elements breaks structure and skip navigation.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)', 'WCAG 2.4.6 Headings and Labels (Level AA)'],
  },
  'html5 video or audio': {
    why: 'Video or audio without captions, transcripts, or audio description excludes deaf/hard-of-hearing and blind users.',
    criteria: ['WCAG 1.2.1 Prerecorded Audio-only and Video-only (Level A)', 'WCAG 1.2.2 Captions (Level A)'],
  },
  'aria': {
    why: 'ARIA is used to expose roles, names, and states. If wrong or missing, assistive tech gets incorrect or no information.',
    criteria: ['WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'aria label': {
    why: 'ARIA labels must accurately name controls and regions so assistive technologies can announce them.',
    criteria: ['WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'aria expanded': {
    why: 'aria-expanded must reflect the current state so users know whether content is expanded or collapsed.',
    criteria: ['WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'aria popup': {
    why: 'Popup triggers must expose state and role so users know when a popup is open.',
    criteria: ['WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'aria tabindex': {
    why: 'Focusable elements must be keyboard operable and expose focus order.',
    criteria: ['WCAG 2.1.1 Keyboard (Level A)', 'WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'aria hidden': {
    why: 'Content marked aria-hidden is hidden from assistive tech; ensure nothing critical is hidden without an equivalent.',
    criteria: ['WCAG 4.1.2 Name, Role, Value (Level A)'],
  },
  'contrast': {
    why: 'Text and images of text must meet minimum contrast ratios for readability.',
    criteria: ['WCAG 1.4.3 Contrast (Minimum) (Level AA)'],
  },
  'heading level': {
    why: 'Headings define structure and allow navigation by heading. Wrong or missing hierarchy confuses users.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)', 'WCAG 2.4.6 Headings and Labels (Level AA)'],
  },
  'main content': {
    why: 'A main landmark lets users jump to primary content; missing or duplicate main reduces usability.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)', 'WCAG 2.4.1 Bypass Blocks (Level A)'],
  },
  'navigation': {
    why: 'Nav landmarks expose navigation regions for skip and region navigation.',
    criteria: ['WCAG 2.4.1 Bypass Blocks (Level A)'],
  },
  'skip link': {
    why: 'A skip link lets keyboard users bypass repeated content; missing or broken skip reduces efficiency.',
    criteria: ['WCAG 2.4.1 Bypass Blocks (Level A)'],
  },
  'unordered list': {
    why: 'Lists should be marked with ul/ol so structure is exposed to assistive tech.',
    criteria: ['WCAG 1.3.1 Info and Relationships (Level A)'],
  },
  'tab order': {
    why: 'Verify keyboard tab order matches a logical sequence and all interactive elements are reachable.',
    criteria: ['WCAG 2.4.3 Focus Order (Level A)', 'WCAG 2.1.1 Keyboard (Level A)'],
  },
};

/**
 * Find the best-matching WCAG reference for a WAVE finding description/category.
 */
export function getWcagRefForFinding(description: string, category: string): WcagRef | null {
  const normalized = `${category} ${description}`.toLowerCase();
  // Exact key match
  for (const [key, ref] of Object.entries(WAVE_WCAG_REF)) {
    if (normalized.includes(key) || description.toLowerCase().includes(key)) return ref;
  }
  // Fallback by category
  if (category.toUpperCase().includes('CONTRAST')) return WAVE_WCAG_REF['contrast'] ?? null;
  if (category.toUpperCase().includes('ARIA')) return WAVE_WCAG_REF['aria'] ?? null;
  if (description.toLowerCase().includes('heading')) return WAVE_WCAG_REF['heading level'] ?? null;
  if (description.toLowerCase().includes('label')) return WAVE_WCAG_REF['missing form label'] ?? null;
  if (description.toLowerCase().includes('alt') || description.toLowerCase().includes('image'))
    return WAVE_WCAG_REF['missing alternative text'] ?? null;
  return null;
}
