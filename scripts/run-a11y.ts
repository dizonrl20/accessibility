#!/usr/bin/env node
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { chromium } from 'playwright';
import { program } from 'commander';
import { runAxeScan } from '../engines/axe-engine.js';
import { runWaveScan } from '../engines/wave-engine.js';
import { runA11yTreeScan } from '../engines/a11y-tree-engine.js';
import { runLighthouseScan } from '../engines/lighthouse-engine.js';
import { generateReport } from '../utils/reporter.js';
import type { ReportConfig, AxeResults, WaveApiResponse, TestingEngine } from '../types/a11y.types.js';
import type { A11yTreeResult } from '../types/a11y-tree.types.js';
import type { LighthouseResult } from '../types/lighthouse.types.js';

program
  .option('--url <url>', 'URL(s) to test', (v: string, acc: string[]) => (acc ?? []).concat(v), [])
  .option('--csv <path>', 'Path to CSV file with URLs (one per line or column)')
  .option('--engine <axe|wave|tree|lighthouse|both>', 'Engine(s): both = axe + tree; lighthouse = same as DevTools a11y; wave = API (key required).', 'both')
  .parse();

const opts = program.opts<{ url?: string | string[]; csv?: string; engine: string }>();

function collectUrls(): Promise<string[]> {
  const urls: string[] = [];

  if (opts.csv) {
    const raw = readFileSync(opts.csv, 'utf8');
    const rows = parse(raw, { skip_empty_lines: true, relax_column_count: true });
    for (const row of rows) {
      const line = Array.isArray(row) ? row.flat().join(' ') : String(row);
      const found = line.match(/https?:\/\/[^\s,]+/g);
      if (found) urls.push(...found);
    }
  }

  const urlOpt = opts.url;
  if (Array.isArray(urlOpt)) urlOpt.forEach((u) => { const t = typeof u === 'string' ? u.trim() : ''; if (t && /^https?:\/\//i.test(t)) urls.push(t); });
  else if (typeof urlOpt === 'string' && urlOpt.trim()) urls.push(urlOpt.trim());

  // Positional args: e.g. "npm run a11y:axe -- --url https://a.com https://b.com" leaves https://b.com in args
  const args: string[] = program.args ?? [];
  for (const a of args) {
    const s = typeof a === 'string' ? a.trim() : '';
    if (s && /^https?:\/\//i.test(s)) urls.push(s);
  }

  if (urls.length > 0) return Promise.resolve([...new Set(urls)]);

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter URL to test: ', (answer) => {
      const u = answer?.trim();
      rl.close();
      resolve(u ? [u] : []);
    });
  });
}

type Row = { url: string; engine: string; status: string };

async function main(): Promise<void> {
  const urls = await collectUrls();
  if (urls.length === 0) {
    console.error('No URLs provided. Use --url <link>, --csv <path>, or enter a URL when prompted.');
    process.exit(1);
  }

  const engineChoice = (opts.engine ?? 'both') as 'axe' | 'wave' | 'tree' | 'lighthouse' | 'both';
  const runAxe = engineChoice === 'axe' || engineChoice === 'both';
  const runWave = engineChoice === 'wave'; // WAVE API only when explicitly --engine wave; use a11y:wave-browser + a11y:wave-to-jira for the browser-capture flow
  const runTree = engineChoice === 'tree' || engineChoice === 'both' || engineChoice === 'axe';
  const runLighthouse = engineChoice === 'lighthouse';

  const table: Row[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    if (runAxe || runTree) browser = await chromium.launch({ headless: true });

    for (const url of urls) {
      if ((runAxe || runTree) && browser) {
        try {
          const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          });
          const page = await context.newPage();
          const settleMs = Math.max(0, parseInt(process.env.A11Y_SETTLE_MS ?? '8000', 10) || 0);
          if (runTree && !runAxe) {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            });
            if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
            const contentWaitMs = Math.max(0, parseInt(process.env.A11Y_CONTENT_WAIT_MS ?? '30000', 10) || 0);
            if (contentWaitMs > 0) {
              await page.waitForFunction(
                () => {
                  const bodyLen = document.body?.innerHTML?.length ?? 0;
                  const interactive = document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), [tabindex]:not([tabindex="-1"]), select, textarea, [role="link"], [role="tab"], nav, header, main, footer, h1, h2, h3, img').length;
                  return bodyLen > 500 && interactive >= 2;
                },
                { timeout: contentWaitMs }
              ).catch(() => {});
            }
          }

          if (runAxe) {
            const results = await runAxeScan(page, url);
            const ts = new Date().toISOString();
            const configAll: ReportConfig = {
              url,
              engineName: 'Axe-core' as TestingEngine,
              timestamp: ts,
              data: results as AxeResults,
              actionableOnly: false,
              reportSuffix: '-all',
            };
            const configActionable: ReportConfig = {
              url,
              engineName: 'Axe-core' as TestingEngine,
              timestamp: ts,
              data: results as AxeResults,
              actionableOnly: true,
              reportSuffix: '-actionable',
            };
            const { htmlPath: htmlAll } = generateReport(configAll);
            const { htmlPath: htmlActionable } = generateReport(configActionable);
            const status = results.violations.length === 0 ? 'Pass' : 'Fail';
            table.push({ url, engine: 'Axe-core', status });
            console.log(`Axe-core: ${url} → ${status} (${results.violations.length} violations). All: ${htmlAll} | Actionable: ${htmlActionable}`);
          }

          if (runTree) {
            const treeResult = await runA11yTreeScan(page, url);
            const treeConfig: ReportConfig = {
              url,
              engineName: 'A11y Tree' as TestingEngine,
              timestamp: treeResult.timestamp,
              data: treeResult as A11yTreeResult,
            };
            const { htmlPath: treeHtml, csvPath: treeCsv } = generateReport(treeConfig);
            table.push({ url, engine: 'A11y Tree', status: treeResult.issues.some((i) => i.actionable) ? 'Issues' : 'Pass' });
            console.log(`A11y Tree: ${url} → ${treeResult.issues.length} issue(s). Report: ${treeHtml}`);
          }

          await context.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (runAxe) table.push({ url, engine: 'Axe-core', status: `Fail: ${msg.slice(0, 50)}` });
          if (runTree) table.push({ url, engine: 'A11y Tree', status: `Fail: ${msg.slice(0, 50)}` });
          console.error(`Browser: ${url} → Fail:`, msg);
        }
      }

      if (runLighthouse) {
        try {
          const lhResult = await runLighthouseScan(url);
          const lhConfig: ReportConfig = {
            url,
            engineName: 'Lighthouse' as TestingEngine,
            timestamp: lhResult.timestamp,
            data: lhResult as LighthouseResult,
          };
          const { htmlPath: lhHtml } = generateReport(lhConfig);
          table.push({ url, engine: 'Lighthouse', status: lhResult.issues.length > 0 ? `${lhResult.issues.length} failed` : `Score ${Math.round((lhResult.score ?? 0) * 100)}` });
          console.log(`Lighthouse: ${url} → ${lhResult.issues.length} failed audit(s), score ${Math.round((lhResult.score ?? 0) * 100)}. Report: ${lhHtml}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          table.push({ url, engine: 'Lighthouse', status: `Fail: ${msg.slice(0, 50)}` });
          console.error(`Lighthouse: ${url} → Fail:`, msg);
        }
      }

      if (runWave) {
        try {
          const results = await runWaveScan(url);
          const config: ReportConfig = {
            url,
            engineName: 'WAVE API' as TestingEngine,
            timestamp: new Date().toISOString(),
            data: results as WaveApiResponse,
          };
          const { htmlPath } = generateReport(config);
          table.push({ url, engine: 'WAVE API', status: 'Pass' });
          console.log(`WAVE API: ${url} → Pass. Report: ${htmlPath}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          table.push({ url, engine: 'WAVE API', status: `Fail: ${msg.slice(0, 50)}` });
          console.error(`WAVE API: ${url} → Fail:`, msg);
          const waveData = err && typeof err === 'object' && 'waveResponse' in err ? (err as { waveResponse: WaveApiResponse }).waveResponse : null;
          if (waveData) {
            const { htmlPath } = generateReport({ url, engineName: 'WAVE API', timestamp: new Date().toISOString(), data: waveData });
            console.log(`WAVE failure report: ${htmlPath}`);
          }
        }
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  // Console table
  const colWidths = { url: Math.min(60, Math.max(20, ...urls.map((u) => u.length))), engine: 12, status: 10 };
  const sep = `\n${'-'.repeat(colWidths.url + colWidths.engine + colWidths.status + 6)}`;
  console.log(sep);
  console.log(
    `| ${'URL'.padEnd(colWidths.url)} | ${'Engine'.padEnd(colWidths.engine)} | ${'Status'.padEnd(colWidths.status)} |`
  );
  console.log(sep);
  for (const row of table) {
    const u = row.url.length > colWidths.url ? row.url.slice(0, colWidths.url - 3) + '...' : row.url.padEnd(colWidths.url);
    const e = row.engine.padEnd(colWidths.engine);
    const s = (row.status.slice(0, colWidths.status - 2) + (row.status.length > colWidths.status ? '..' : '')).padEnd(colWidths.status);
    console.log(`| ${u} | ${e} | ${s} |`);
  }
  console.log(sep);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
