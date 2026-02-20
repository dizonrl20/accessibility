/**
 * Map Lighthouse-style WCAG tags (e.g. "wcag143") to human-readable labels,
 * AND map Lighthouse audit IDs to their WCAG criteria (since Lighthouse does
 * NOT expose tags in the LHR JSON output).
 */

const WCAG_TAG_MAP: Record<string, string> = {
  wcag111: 'WCAG 1.1.1 Non-text Content (Level A)',
  wcag121: 'WCAG 1.2.1 Audio-only and Video-only (Prerecorded) (Level A)',
  wcag122: 'WCAG 1.2.2 Captions (Prerecorded) (Level A)',
  wcag131: 'WCAG 1.3.1 Info and Relationships (Level A)',
  wcag141: 'WCAG 1.4.1 Use of Color (Level A)',
  wcag143: 'WCAG 1.4.3 Contrast (Minimum) (Level AA)',
  wcag144: 'WCAG 1.4.4 Resize Text (Level AA)',
  wcag211: 'WCAG 2.1.1 Keyboard (Level A)',
  wcag221: 'WCAG 2.2.1 Timing Adjustable (Level A)',
  wcag241: 'WCAG 2.4.1 Bypass Blocks (Level A)',
  wcag242: 'WCAG 2.4.2 Page Titled (Level A)',
  wcag243: 'WCAG 2.4.3 Focus Order (Level A)',
  wcag244: 'WCAG 2.4.4 Link Purpose (In Context) (Level A)',
  wcag258: 'WCAG 2.5.8 Target Size (Minimum) (Level AA)',
  wcag311: 'WCAG 3.1.1 Language of Page (Level A)',
  wcag332: 'WCAG 3.3.2 Labels or Instructions (Level A)',
  wcag411: 'WCAG 4.1.1 Parsing (Level A)',
  wcag412: 'WCAG 4.1.2 Name, Role, Value (Level A)',
};

/**
 * Comprehensive Lighthouse audit-id → WCAG tag(s) map.
 *
 * Lighthouse does NOT include `tags` in the LHR JSON. This map is derived
 * from the Lighthouse source (audit meta.tags) so the HTML reporter can
 * show correct WCAG criteria for every known accessibility audit.
 */
export const LIGHTHOUSE_AUDIT_WCAG: Record<string, string[]> = {
  // Navigation & Bypassing
  'accesskeys': ['wcag241'],
  'bypass': ['wcag241'],
  'document-title': ['wcag242'],
  'frame-title': ['wcag412', 'wcag241'],
  'skip-link': ['wcag241'],
  'tabindex': ['wcag243'],

  // ARIA & Names (WCAG 4.1.2)
  'aria-allowed-attr': ['wcag412'],
  'aria-allowed-role': ['wcag412'],
  'aria-command-name': ['wcag412'],
  'aria-conditional-attr': ['wcag412'],
  'aria-dialog-name': ['wcag412'],
  'aria-hidden-body': ['wcag412'],
  'aria-hidden-focus': ['wcag412'],
  'aria-input-field-name': ['wcag412'],
  'aria-meter-name': ['wcag412'],
  'aria-progressbar-name': ['wcag412'],
  'aria-prohibited-attr': ['wcag412'],
  'aria-required-attr': ['wcag412'],
  'aria-roles': ['wcag412'],
  'aria-text': ['wcag412'],
  'aria-toggle-field-name': ['wcag412'],
  'aria-tooltip-name': ['wcag412'],
  'aria-treeitem-name': ['wcag412'],
  'aria-valid-attr-value': ['wcag412'],
  'aria-valid-attr': ['wcag412'],
  'button-name': ['wcag412'],
  'input-button-name': ['wcag412'],
  'link-name': ['wcag412', 'wcag244'],
  'select-name': ['wcag412', 'wcag131'],

  // ARIA Relationships & HTML Semantics (WCAG 1.3.1)
  'aria-required-children': ['wcag131'],
  'aria-required-parent': ['wcag131'],
  'definition-list': ['wcag131'],
  'dlitem': ['wcag131'],
  'heading-order': ['wcag131'],
  'empty-heading': ['wcag131'],
  'list': ['wcag131'],
  'listitem': ['wcag131'],
  'layout-table': ['wcag131'],
  'table-fake-caption': ['wcag131'],
  'td-has-header': ['wcag131'],
  'td-headers-attr': ['wcag131'],
  'th-has-data-cells': ['wcag131'],

  // Form Labels
  'form-field-multiple-labels': ['wcag332'],
  'label': ['wcag412', 'wcag131'],

  // Language & Meta
  'html-has-lang': ['wcag311'],
  'html-lang-valid': ['wcag311'],
  'html-xml-lang-mismatch': ['wcag311'],
  'valid-lang': ['wcag311'],
  'meta-refresh': ['wcag221'],
  'meta-viewport': ['wcag144'],

  // Visuals & Media
  'color-contrast': ['wcag143'],
  'image-alt': ['wcag111'],
  'image-redundant-alt': ['wcag111'],
  'input-image-alt': ['wcag111'],
  'object-alt': ['wcag111'],
  'video-caption': ['wcag122'],
  'link-in-text-block': ['wcag141'],
  'identical-links-same-purpose': ['wcag244'],
  'target-size': ['wcag258'],

  // Parsing
  'duplicate-id-active': ['wcag411'],
  'duplicate-id-aria': ['wcag411'],

  // Table
  'table-duplicate-name': ['wcag131'],
};

/**
 * Map a single WCAG tag to a human-readable string.
 */
export function mapWcagTag(tag: string): string {
  const key = tag.toLowerCase();
  if (WCAG_TAG_MAP[key]) return WCAG_TAG_MAP[key];

  const m = key.match(/^wcag(\d{3})$/);
  if (m) {
    const digits = m[1];
    const parts = [digits[0], digits[1], digits[2]].join('.');
    return `WCAG ${parts}`;
  }

  return tag.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map an array of Lighthouse tags to human-readable WCAG labels,
 * filtering out non-WCAG tags.
 */
export function mapWcagTags(tags: string[]): string[] {
  return tags
    .filter((t) => /^wcag\d{3}$/i.test(t))
    .map((t) => mapWcagTag(t));
}

/**
 * Resolve WCAG labels for a Lighthouse audit.
 *
 * Priority:
 *  1. `wcagTags` from the LHR (if Lighthouse ever starts including them)
 *  2. `LIGHTHOUSE_AUDIT_WCAG[auditId]` hardcoded map
 *  3. Empty array (caller decides fallback text)
 */
export function resolveWcagForLighthouseAudit(auditId: string, wcagTags?: string[]): string[] {
  const fromTags = mapWcagTags(wcagTags ?? []);
  if (fromTags.length > 0) return fromTags;

  const fromMap = LIGHTHOUSE_AUDIT_WCAG[auditId];
  if (fromMap && fromMap.length > 0) return mapWcagTags(fromMap);

  return [];
}

