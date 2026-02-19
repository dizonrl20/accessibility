/**
 * Lighthouse accessibility engine. Runs the same audits as DevTools Lighthouse
 * so you get the same issues (button/link names, contrast, ARIA, etc.).
 */
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import type { LighthouseResult } from '../types/lighthouse.types.js';

/** LHR from Lighthouse runner result (minimal shape we need). */
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

function normalizeLhrToResult(url: string, lhr: LHR): LighthouseResult {
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
    issues.push({
      id: audit.id,
      title: audit.title,
      description: audit.description ?? '',
      displayValue: audit.displayValue,
      score: audit.score,
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
 * a normalized result (same issues as DevTools Lighthouse a11y).
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

    return normalizeLhrToResult(url, runnerResult.lhr as LHR);
  } catch (err) {
    await chrome.kill().catch(() => {});
    throw err;
  }
}
