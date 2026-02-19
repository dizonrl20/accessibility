import { test, expect } from '@playwright/test';
import { runAxeScan } from '../engines/axe-engine.js';

/**
 * Parameterized a11y test: run Axe-core (WCAG 2.2 AA) on the page specified by TARGET_URL.
 * Use in CI: TARGET_URL=https://example.com/page npx playwright test tests/accessibility-module.spec.ts
 */
const TARGET_URL = process.env.TARGET_URL ?? 'https://example.com';

test.describe('Accessibility (WCAG 2.2 AA / AODA)', () => {
  test('Axe-core scan has no violations', async ({ page }) => {
    const results = await runAxeScan(page, TARGET_URL);
    expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
  });
});

function formatViolations(violations: { id: string; help: string; nodes: { target: string[] }[] }[]): string {
  if (violations.length === 0) return '';
  return violations
    .map(
      (v) =>
        `[${v.id}] ${v.help}\n  ${v.nodes.map((n) => n.target?.join(' ') ?? '').join('\n  ')}`
    )
    .join('\n\n');
}

/*
 * MANUAL TESTING CHECKLIST (cannot be fully automated)
 * -----------------------------------------------
 *
 * 2.4.11 Focus Not Obscured (Minimum) (Level AA)
 * - Tab through the page; ensure the focused element is never fully covered by sticky headers,
 *   footers, or fixed overlays. At least 2.5.8’s 24×24px of the focus indicator must be visible.
 * - Test with a visible focus ring (e.g. :focus-visible) and with browser zoom up to 400%.
 *
 * 3.3.8 Accessible Authentication (Minimum) (Level AA)
 * - If the module includes login/sign-up, confirm that no cognitive function tests (e.g. puzzles,
 *   object recognition, memorizing content) are required. Use alternatives like password managers
 *   or passkeys where possible.
 *
 * 2.5.7 Dragging Movements (Level AA)
 * - For any drag-and-drop UI (e.g. reorderable lists, sliders that require drag): verify an
 *   alternative, single-pointer (e.g. click/tap) method exists to achieve the same outcome
 *   (e.g. up/down buttons, form fields, or keyboard steps).
 */
