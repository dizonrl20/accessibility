/**
 * Minimal types for Lighthouse accessibility result (engine output).
 * Maps LHR accessibility category + failed audits to our report shape.
 */

export interface LighthouseAuditItem {
  selector?: string;
  snippet?: string;
  nodeLabel?: string;
  [key: string]: unknown;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  displayValue?: string;
  details?: {
    items?: LighthouseAuditItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LighthouseResult {
  url: string;
  timestamp: string;
  score: number;
  /** Failed or unscored (manual) audits we surface as issues */
  issues: {
    id: string;
    title: string;
    description: string;
    displayValue?: string;
    score: number | null;
     /** Raw WCAG tags from Lighthouse (e.g. wcag412, wcag143) */
     wcagTags?: string[];
    items: LighthouseAuditItem[];
  }[];
}
