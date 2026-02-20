/**
 * Shared types for WCAG 2.2 AA / AODA accessibility testing suite.
 * Axe-core and WAVE API result shapes + ReportConfig for segregated reporting.
 */

// --- WAVE API (reporttype=2) ---

export interface WaveApiStatus {
  success: boolean;
  httpstatuscode?: number;
  error?: string;
}

export interface WaveCategoryCount {
  count: number;
  items?: WaveCategoryItem[];
}

export interface WaveCategoryItem {
  id?: string;
  description?: string;
  count?: number;
  /** XPath or selector for reporttype 2+ */
  selectors?: string[];
}

export interface WaveApiCategories {
  error: WaveCategoryCount;
  contrast: WaveCategoryCount;
  alert?: WaveCategoryCount;
  feature?: WaveCategoryCount;
  structure?: WaveCategoryCount;
  aria?: WaveCategoryCount;
  [key: string]: WaveCategoryCount | undefined;
}

export interface WaveApiResponse {
  status: WaveApiStatus;
  statistics?: {
    pagetitle?: string;
  };
  categories: WaveApiCategories;
}

// --- Axe-core (from @axe-core/playwright) ---

export interface AxeNodeResult {
  html: string;
  target: string[];
  xpath?: string[];
  ancestry?: string[];
  any: AxeCheckResult[];
  all: AxeCheckResult[];
  none: AxeCheckResult[];
}

export interface AxeCheckResult {
  id: string;
  impact: string;
  message: string;
  data: Record<string, unknown> | null;
  relatedNodes?: AxeRelatedNode[];
  [key: string]: unknown;
}

export interface AxeRelatedNode {
  html: string;
  target: string[];
}

export interface AxeResult {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNodeResult[];
}

export interface AxeResults {
  violations: AxeResult[];
  passes: AxeResult[];
  incomplete: AxeResult[];
  inapplicable: AxeResult[];
  timestamp: string;
  url: string;
  testEngine: { name: string; version: string };
  testRunner: { name: string };
  toolOptions: Record<string, unknown>;
}

// --- Report config (engine-tagged artifacts) ---

export type TestingEngine = 'Axe-core' | 'WAVE API' | 'A11y Tree' | 'Lighthouse';

export interface ReportConfig {
  url: string;
  engineName: TestingEngine;
  timestamp: string;
  data:
    | AxeResults
    | WaveApiResponse
    | import('./a11y-tree.types.js').A11yTreeResult
    | import('./lighthouse.types.js').LighthouseResult;
  /** Axe only: when true, report only violations (actionable). When false/undefined, report violations + incomplete with actionable/informational pills. */
  actionableOnly?: boolean;
  /** Optional suffix for filenames (e.g. '-actionable' for report-axe-...-actionable.html). */
  reportSuffix?: string;
}

// --- WAVE browser capture (parsed from HTML) ---

export type WaveCaptureTab = 'Details' | 'Reference' | 'Tab Order' | 'Structure' | 'Contrast';

export interface WaveCaptureFinding {
  category: string;
  description: string;
  tab: WaveCaptureTab;
  wcagRef?: string;
  /** Element(s) that triggered the finding: tag name, role, or short DOM snippet from WAVE capture */
  elementInfo?: string;
}

export interface WaveJiraIssue {
  tab: WaveCaptureTab;
  summary: string;
  description: string;
  jiraText: string;
  /** true = Error/Contrast/Alert (fix or review); false = Feature/Structure/ARIA (inventory, no action unless wrong) */
  actionable: boolean;
  /** Unified report fields (from WCAG reference when available) */
  wcagNumber?: string;
  wcagCause?: string;
  actual?: string;
  expectedFix?: string;
  /** Element(s) that triggered the finding (tag, role, or short DOM snippet) */
  elements?: string;
}
