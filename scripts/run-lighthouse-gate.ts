#!/usr/bin/env node
/**
 * CI gate: run Lighthouse accessibility on TARGET_URL and exit 1 if any audits fail.
 * Use for pipeline blocking when the site has known or unknown a11y issues.
 *
 * Env:
 *   TARGET_URL - URL to audit (default: https://atlas.gc.ca/toporama/en/index.html)
 *   LIGHTHOUSE_SETTLE_MS - Wait after load before audit (e.g. 15000 for map/SPA)
 *   LIGHTHOUSE_MAX_WAIT_MS - Max wait for load (default 45000)
 */
import { runLighthouseScan } from '../engines/lighthouse-engine.js';

const TARGET_URL = process.env.TARGET_URL ?? 'https://atlas.gc.ca/toporama/en/index.html';

async function main(): Promise<void> {
  console.log(`Lighthouse gate: auditing ${TARGET_URL} ...`);
  const result = await runLighthouseScan(TARGET_URL);
  const failed = result.issues.length;
  const score = result.score != null ? Math.round(result.score * 100) : null;
  console.log(`Accessibility score: ${score ?? 'n/a'}, failed audits: ${failed}`);

  if (failed > 0) {
    console.error(`Gate failed: ${failed} accessibility audit(s) did not pass. Fix issues or adjust gate.`);
    process.exit(1);
  }
  console.log('Gate passed: no failed accessibility audits.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
