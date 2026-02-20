/**
 * Lighthouse accessibility engine. Runs the same audits as DevTools Lighthouse
 * so you get the same issues (button/link names, contrast, ARIA, etc.).
 *
 * WCAG tag extraction:
 *  - Lighthouse strips `tags` from the LHR JSON to keep payload small.
 *  - We extract them dynamically from `runnerResult.artifacts.Accessibility`
 *    which contains the raw axe-core payload with all WCAG tags intact.
 *  - The hardcoded map in `utils/wcag-dictionary.ts` serves as fallback for
 *    any audit not present in the artifacts (e.g. Lighthouse-only checks).
 */
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import type { LighthouseResult } from '../types/lighthouse.types.js';

interface LHR {
  categories?: {
    accessibility?: {
      score: number;
      auditRefs?: { id: string }[];
    };
  };
  audits?: Record<
    string,
    {
      id: string;
      title: string;
      description?: string;
      score: number | null;
      displayValue?: string;
      details?: { items?: Array<{ selector?: string; snippet?: string; node?: { selector?: string } }> };
    }
  >;
}

interface AxeArtifactEntry {
  id: string;
  tags?: string[];
  [key: string]: unknown;
}

interface LighthouseArtifacts {
  Accessibility?: {
    violations?: AxeArtifactEntry[];
    incomplete?: AxeArtifactEntry[];
    passes?: AxeArtifactEntry[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Build audit-id → wcag tags from the raw axe-core artifacts that Lighthouse
 * gathers before formatting the LHR.
 */
function buildTagMapFromArtifacts(artifacts?: LighthouseArtifacts): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!artifacts?.Accessibility) return map;

  const all = [
    ...(artifacts.Accessibility.violations ?? []),
    ...(artifacts.Accessibility.incomplete ?? []),
    ...(artifacts.Accessibility.passes ?? []),
  ];
  for (const entry of all) {
    if (!entry.id || !entry.tags) continue;
    const wcag = entry.tags.filter((t: string) => /^wcag\d{2,4}[a-z]*$/i.test(t));
    if (wcag.length > 0) map.set(entry.id, wcag);
  }
  return map;
}

function normalizeLhrToResult(
  url: string,
  lhr: LHR,
  artifactTagMap: Map<string, string[]>,
): LighthouseResult {
  const a11y = lhr.categories?.accessibility;
  const score = a11y?.score ?? 0;
  const auditRefs = a11y?.auditRefs ?? [];
  const issues: LighthouseResult['issues'] = [];

  for (const ref of auditRefs) {
    const audit = lhr.audits?.[ref.id];
    if (!audit) continue;
    const failed = audit.score === 0 || audit.score === null;
    if (!failed) continue;
    const items = audit.details?.items ?? [];

    const rawTags = artifactTagMap.get(audit.id) ?? [];
    const wcagTags = rawTags.filter((t) => /^wcag\d{3}$/i.test(t));

    issues.push({
      id: audit.id,
      title: audit.title,
      description: audit.description ?? '',
      displayValue: audit.displayValue,
      score: audit.score,
      wcagTags,
      items: items.map((item) => ({
        selector: item.selector ?? item.node?.selector,
        snippet: item.snippet,
        nodeLabel: (item as { nodeLabel?: string }).nodeLabel,
      })),
    });
  }

  return {
    url,
    timestamp: new Date().toISOString(),
    score,
    issues,
  };
}

/**
 * Runs Lighthouse with only the accessibility category and returns
 * a normalized result. Extracts WCAG tags from artifacts (raw axe-core
 * data) so the HTML report can show correct WCAG criteria dynamically.
 *
 * No tokens, no AI — runs entirely locally via chrome-launcher.
 */
export async function runLighthouseScan(url: string): Promise<LighthouseResult> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
    logLevel: 'error',
  });

  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: ['accessibility'],
      logLevel: 'error',
      output: 'json',
    }, undefined);

    await chrome.kill();

    if (!runnerResult?.lhr) {
      throw new Error('Lighthouse did not return a result.');
    }

    const artifacts = (runnerResult as unknown as { artifacts?: LighthouseArtifacts }).artifacts;
    const artifactTagMap = buildTagMapFromArtifacts(artifacts);

    return normalizeLhrToResult(url, runnerResult.lhr as LHR, artifactTagMap);
  } catch (err) {
    await Promise.resolve(chrome.kill()).catch(() => {});
    throw err;
  }
}
