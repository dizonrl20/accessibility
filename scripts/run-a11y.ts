#!/usr/bin/env node
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { chromium } from 'playwright';
import { program } from 'commander';
import { runAxeScan } from '../engines/axe-engine.js';
import { runWaveScan } from '../engines/wave-engine.js';
import { generateReport } from '../utils/reporter.js';
import type { ReportConfig, AxeResults, WaveApiResponse, TestingEngine } from '../types/a11y.types.js';

program
  .option('--url <url>', 'Single URL to test')
  .option('--csv <path>', 'Path to CSV file with URLs (one per line or column)')
  .option('--engine <axe|wave|both>', 'Engine(s) to run', 'both')
  .parse();

const opts = program.opts<{ url?: string; csv?: string; engine: 'axe' | 'wave' | 'both' }>();

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

  if (opts.url?.trim()) urls.push(opts.url.trim());

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

  const engineChoice = (opts.engine ?? 'both') as 'axe' | 'wave' | 'both';
  const runAxe = engineChoice === 'axe' || engineChoice === 'both';
  const runWave = engineChoice === 'wave' || engineChoice === 'both';

  const table: Row[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    if (runAxe) browser = await chromium.launch({ headless: true });

    for (const url of urls) {
      if (runAxe && browser) {
        try {
          const context = await browser.newContext();
          const page = await context.newPage();
          const results = await runAxeScan(page, url);
          await context.close();

          const config: ReportConfig = {
            url,
            engineName: 'Axe-core' as TestingEngine,
            timestamp: new Date().toISOString(),
            data: results as AxeResults,
          };
          const { htmlPath, csvPath } = generateReport(config);
          const status = results.violations.length === 0 ? 'Pass' : 'Fail';
          table.push({ url, engine: 'Axe-core', status });
          console.log(`Axe-core: ${url} → ${status} (${results.violations.length} violations). Report: ${htmlPath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          table.push({ url, engine: 'Axe-core', status: `Fail: ${msg.slice(0, 50)}` });
          console.error(`Axe-core: ${url} → Fail:`, msg);
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
