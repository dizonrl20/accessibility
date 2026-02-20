import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { AxeResults } from '../types/a11y.types.js';

const MIN_TARGET_SIZE = 24;

/** Post-navigation settle for SPAs. Default 8s; override with A11Y_SETTLE_MS. */
const SETTLE_MS = typeof process !== 'undefined' && process.env?.A11Y_SETTLE_MS ? Math.max(0, parseInt(process.env.A11Y_SETTLE_MS, 10) || 0) : 8000;

/**
 * Runs Axe-core scan with WCAG 2.2 AA and AODA-oriented rules.
 * Fails explicitly on: target size < 24x24 (2.5.8), missing alt, missing label.
 */
/** Max time to wait for meaningful DOM content (SPA hydration). Default 30s; override with A11Y_CONTENT_WAIT_MS. */
const CONTENT_WAIT_MS = typeof process !== 'undefined' && process.env?.A11Y_CONTENT_WAIT_MS !== undefined ? Math.max(0, parseInt(process.env.A11Y_CONTENT_WAIT_MS, 10) || 0) : 30000;

export async function runAxeScan(page: Page, url: string): Promise<AxeResults> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });
  if (SETTLE_MS > 0) await new Promise((r) => setTimeout(r, SETTLE_MS));

  if (CONTENT_WAIT_MS > 0) {
    await page.waitForFunction(
      () => {
        const bodyLen = document.body?.innerHTML?.length ?? 0;
        const interactive = document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), [tabindex]:not([tabindex="-1"]), select, textarea, [role="link"], [role="tab"], nav, header, main, footer, h1, h2, h3, img').length;
        return bodyLen > 500 && interactive >= 2;
      },
      { timeout: CONTENT_WAIT_MS }
    ).catch(() => { /* run axe anyway if timeout */ });
  }

  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .withRules([
      'image-alt',
      'label',
      'label-title-only',
      'input-button-name',
      'button-name',
      'link-name',
      'color-contrast',
      'aria-allowed-attr',
    ]);

  const results = await builder.analyze();

  // WCAG 2.5.8 Target Size Minimum: enforce 24x24 CSS px for interactive elements
  const smallTargets = await page.evaluate((minSize: number) => {
    const selector =
      'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    const violations: { selector: string; width: number; height: number }[] = [];
    nodes.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < minSize || rect.height < minSize) {
        const sel =
          el.id ? `#${el.id}` : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : '');
        violations.push({
          selector: sel,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    });
    return violations;
  }, MIN_TARGET_SIZE);

  if (smallTargets.length > 0) {
    const targetSizeViolation: import('../types/a11y.types.js').AxeResult = {
      id: 'target-size-minimum',
      impact: 'serious',
      description: 'WCAG 2.5.8: Interactive elements must have a minimum size of 24×24 CSS pixels.',
      help: 'Ensure touch targets are at least 24×24 pixels.',
      helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
      tags: ['wcag2aa', 'wcag22aa', 'cat-target-size'],
      nodes: smallTargets.map((v) => ({
        html: '',
        target: [v.selector],
        any: [],
        all: [],
        none: [],
      })),
    };
    results.violations.push(targetSizeViolation);
  }

  return results as AxeResults;
}
