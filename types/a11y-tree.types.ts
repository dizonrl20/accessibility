/**
 * A11y Tree engine: inventory + issues from Playwright accessibility snapshot.
 * Complements Axe (rules) and WAVE (visual overlay).
 */

export interface A11yTreeInventory {
  links: number;
  buttons: number;
  images: number;
  videos: number;
  audio: number;
  iframes: number;
}

export type A11yTreeIssueKind =
  | 'nameless-link'
  | 'nameless-button'
  | 'nameless-input'
  | 'media-manual-review';

export interface A11yTreeIssue {
  kind: A11yTreeIssueKind;
  role: string;
  name?: string;
  description?: string;
  summary: string;
  actionable: boolean;
}

export interface A11yTreeResult {
  url: string;
  timestamp: string;
  inventory: A11yTreeInventory;
  issues: A11yTreeIssue[];
}
