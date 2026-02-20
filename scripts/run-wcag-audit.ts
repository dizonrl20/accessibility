#!/usr/bin/env node
/**
 * Strict WCAG 2.2 AA / AODA audit on top of Lighthouse accessibility.
 *
 * - Runs Lighthouse (accessibility category only)
 * - Filters audits to those tagged as accessibility
 * - Maps WCAG tags (wcag143, wcag111, etc.) to human-readable criteria
 * - Segregates into: failures, passes, manualChecks, notApplicable
 * - Extracts failing HTML node snippets for failures
 * - Writes wcag-audit-report.json and logs a summary table
 */

import { writeFileSync } from 'fs';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { mapWcagTags } from '../utils/wcag-dictionary.js';

type ScoreDisplayMode = 'binary' | 'numeric' | 'manual' | 'notApplicable' | 'informative' | string;

interface LhrAuditDetailsItem {
  node?: {
    selector?: string;
    snippet?: string;
  };
  selector?: string;
  snippet?: string;
  [key: string]: unknown;
}

interface LhrAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: ScoreDisplayMode;
  tags?: string[];
  details?: {
    items?: LhrAuditDetailsItem[];
    [key: string]: unknown;
  };
}

interface Lhr {
  audits?: Record<string, LhrAudit>;
}

interface FindingBase {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: ScoreDisplayMode;
  tags: string[];
  wcagCriteria: string[];
}

interface FailureFinding extends FindingBase {
  nodes: { selector?: string; snippet?: string }[];
}

interface PassFinding extends FindingBase {}
interface ManualFinding extends FindingBase {}
interface NotApplicableFinding extends FindingBase {}

interface WcagAuditReport {
  auditTarget: string;
  timestamp: string;
  complianceTarget: string;
  summary: {
    passes: number;
    failures: number;
    manualChecks: number;
    notApplicable: number;
  };
  findings: {
    passes: PassFinding[];
    failures: FailureFinding[];
    manualChecks: ManualFinding[];
    notApplicable: NotApplicableFinding[];
  };
}

async function runLighthouseAccessibility(url: string): Promise<Lhr> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
    logLevel: 'error',
  });

  try {
    const runnerResult = await lighthouse(
      url,
      {
        port: chrome.port,
        onlyCategories: ['accessibility'],
        logLevel: 'error',
        output: 'json',
      },
      undefined
    );

    if (!runnerResult?.lhr) {
      throw new Error('Lighthouse did not return a result.');
    }

    return runnerResult.lhr as Lhr;
  } finally {
    // Always attempt to close Chrome; ignore errors on kill.
    await Promise.resolve(chrome.kill()).catch(() => {});
  }
}

function buildWcagAuditReport(url: string, lhr: Lhr): WcagAuditReport {
  const passes: PassFinding[] = [];
  const failures: FailureFinding[] = [];
  const manualChecks: ManualFinding[] = [];
  const notApplicable: NotApplicableFinding[] = [];

  const audits = lhr.audits ?? {};

  for (const audit of Object.values(audits)) {
    const tags = audit.tags ?? [];
    // Step 1: filter to accessibility-tagged audits only.
    if (!tags.includes('accessibility')) continue;

    const wcagCriteria = mapWcagTags(tags);
    const base: FindingBase = {
      id: audit.id,
      title: audit.title,
      description: audit.description ?? '',
      score: audit.score,
      scoreDisplayMode: audit.scoreDisplayMode ?? '',
      tags,
      wcagCriteria,
    };

    const mode = audit.scoreDisplayMode ?? '';

    // Step 3: segregate by status.
    if (mode === 'manual') {
      manualChecks.push(base);
      continue;
    }
    if (mode === 'notApplicable') {
      notApplicable.push(base);
      continue;
    }

    const score = audit.score;

    // Failures: explicit score === 0
    if (score === 0) {
      const items = audit.details?.items ?? [];
      const nodes: FailureFinding['nodes'] = items.map((item) => ({
        selector: item.selector ?? item.node?.selector,
        snippet: item.snippet ?? item.node?.snippet,
      }));

      failures.push({
        ...base,
        nodes,
      });
      continue;
    }

    // Passes: score === 1 (binary/numeric passing)
    if (score === 1) {
      passes.push(base);
      continue;
    }

    // Everything else (informative, null, etc.) is ignored for this strict WCAG view.
  }

  const report: WcagAuditReport = {
    auditTarget: url,
    timestamp: new Date().toISOString(),
    complianceTarget: 'WCAG 2.2 AA / AODA',
    summary: {
      passes: passes.length,
      failures: failures.length,
      manualChecks: manualChecks.length,
      notApplicable: notApplicable.length,
    },
    findings: {
      passes,
      failures,
      manualChecks,
      notApplicable,
    },
  };

  return report;
}

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url || !/^https?:\/\//i.test(url)) {
    console.error('Usage: run-wcag-audit <url>');
    console.error('Example: npx tsx scripts/run-wcag-audit.ts https://example.com');
    process.exit(1);
  }

  try {
    const lhr = await runLighthouseAccessibility(url);
    const report = buildWcagAuditReport(url, lhr);

    // 4. Output: JSON + console.table(summary). No overall Lighthouse score.
    const outPath = 'wcag-audit-report.json';
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    const { passes, failures, manualChecks, notApplicable } = report.summary;
    // console.table expects an array or object; wrap summary in an array for a single row.
    console.table([
      {
        auditTarget: report.auditTarget,
        complianceTarget: report.complianceTarget,
        passes,
        failures,
        manualChecks,
        notApplicable,
      },
    ]);

    console.log(`\nWCAG audit report written to ${outPath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/net::ERR|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      console.error(`Failed to reach URL ${url}: ${msg}`);
    } else {
      console.error(`WCAG audit failed: ${msg}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected WCAG audit error:', err);
  process.exit(1);
});

