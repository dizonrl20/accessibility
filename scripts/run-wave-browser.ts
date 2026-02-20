#!/usr/bin/env node
/**
 * Open a page in a browser with the WAVE extension and capture the result for AI reporting.
 * WAVE is loaded from your existing Chrome install (copy) or from --extension-path.
 * Flow: launch browser with WAVE → navigate to URL → you click Evaluate → press Enter → capture.
 */
import { createInterface } from 'readline';
import { chromium } from 'playwright';
import { join, resolve } from 'path';
import { mkdirSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'fs';
import { program } from 'commander';

const WAVE_EXTENSION_ID = 'jbbplnpkjmmeebjpijfedlgcdilocofh';

program
  .option('--url <url>', 'URL to test')
  .option('--profile <dir>', 'Browser user data dir for this run', '.wave-browser-profile')
  .option('--extension-path <path>', 'Path to unpacked WAVE extension folder (or we copy from Chrome)')
  .option('--check', 'Only check if WAVE is found in Chrome profile; do not launch browser')
  .parse();

const opts = program.opts<{ url?: string; profile: string; extensionPath?: string; check?: boolean }>();
const REPORT_DIR = join(process.cwd(), 'a11y-reports');
const WAVE_COPY_DIR = join(process.cwd(), '.wave-extension');

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, name.name);
    const d = join(dest, name.name);
    if (name.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

function findWaveInChromeProfile(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  const isWin = process.platform === 'win32';
  const chromeBase = isWin
    ? join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data')
    : join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  if (!existsSync(chromeBase)) return null;
  const profiles = readdirSync(chromeBase).filter((p) => p === 'Default' || p.startsWith('Profile '));
  for (const profile of ['Default', ...profiles.filter((p) => p !== 'Default')]) {
    const extDir = join(chromeBase, profile, 'Extensions', WAVE_EXTENSION_ID);
    if (!existsSync(extDir)) continue;
    const versions = readdirSync(extDir);
    const ver = versions.find((v) => v.match(/^\d+(\.\d+)*/)) ?? versions[0];
    if (!ver) continue;
    const path = join(extDir, ver);
    if (existsSync(join(path, 'manifest.json'))) return path;
  }
  return null;
}

function getWaveExtensionPath(): string | null {
  if (opts.extensionPath?.trim()) {
    const p = resolve(opts.extensionPath.trim());
    if (existsSync(join(p, 'manifest.json'))) return p;
    return null;
  }
  const fromChrome = findWaveInChromeProfile();
  if (fromChrome) {
    mkdirSync(WAVE_COPY_DIR, { recursive: true });
    copyDir(fromChrome, WAVE_COPY_DIR);
    return WAVE_COPY_DIR;
  }
  return null;
}

async function main(): Promise<void> {
  if (opts.check) {
    const fromChrome = findWaveInChromeProfile();
    if (fromChrome) {
      console.log('Found WAVE in Chrome profile at:');
      console.log(fromChrome);
      process.exit(0);
    }
    if (opts.extensionPath?.trim()) {
      const p = resolve(opts.extensionPath.trim());
      if (existsSync(join(p, 'manifest.json'))) {
        console.log('Found WAVE at --extension-path:');
        console.log(p);
        process.exit(0);
      }
    }
    console.error('WAVE not found.');
    const home = process.env.HOME || process.env.USERPROFILE;
    const isWin = process.platform === 'win32';
    const chromeBase = isWin
      ? join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data')
      : join(home || '', 'Library', 'Application Support', 'Google', 'Chrome');
    console.error('Chrome profile base we looked in:', chromeBase);
    process.exit(1);
  }

  const targetUrl = opts.url?.trim() || process.env.WAVE_BROWSER_URL?.trim();
  if (!targetUrl) {
    console.error('Provide --url <link> or set WAVE_BROWSER_URL.');
    process.exit(1);
  }

  const userDataDir = join(process.cwd(), opts.profile);
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });

  const pathToExtension = getWaveExtensionPath();
  if (!pathToExtension) {
    console.error('WAVE extension not found. Install WAVE in your normal Chrome, then run this script again.');
    console.error('Or provide an unpacked WAVE folder: --extension-path ./wave-extension');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  const page = context.pages()[0] || (await context.waitForEvent('page'));
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  console.log('\n--- WAVE browser flow ---');
  console.log('WAVE is loaded. Click the WAVE icon in the toolbar and choose "Evaluate".');
  console.log('When the evaluation is visible, press Enter here.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => rl.question('Press Enter after WAVE has run... ', () => { rl.close(); resolve(); }));

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = targetUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '-').replace(/-+/g, '-').slice(0, 50);
  const base = `wave-browser-capture-${slug}-${ts}`;
  const htmlPath = join(REPORT_DIR, `${base}.html`);
  const pngPath = join(REPORT_DIR, `${base}.png`);

  const html = await page.content();
  writeFileSync(htmlPath, html, 'utf8');
  await page.screenshot({ path: pngPath, fullPage: true }).catch(() => page.screenshot({ path: pngPath }));

  console.log('Saved:', htmlPath, pngPath);
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
