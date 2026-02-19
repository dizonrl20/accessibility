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
  impact: string | null;
  message: string;
  data?: Record<string, unknown>;
  relatedNodes?: AxeRelatedNode[];
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

export type TestingEngine = 'Axe-core' | 'WAVE API';

export interface ReportConfig {
  url: string;
  engineName: TestingEngine;
  timestamp: string;
  data: AxeResults | WaveApiResponse;
}
