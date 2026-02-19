import type { WaveApiResponse } from '../types/a11y.types.js';

const WAVE_API_BASE = 'https://wave.webaim.org/api/request';

/**
 * Runs WAVE Stand-alone API scan. Throws if API fails or error/contrast counts > 0.
 */
export async function runWaveScan(url: string): Promise<WaveApiResponse> {
  const key = process.env.WAVE_API_KEY;
  if (!key?.trim()) {
    throw new Error('WAVE_API_KEY environment variable is required for WAVE API scans.');
  }

  const params = new URLSearchParams({
    key,
    reporttype: '2',
    url,
  });
  const res = await fetch(`${WAVE_API_BASE}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`WAVE API HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as WaveApiResponse;

  if (!data.status?.success) {
    throw new Error(data.status?.error ?? 'WAVE API request failed.');
  }

  const errorCount = data.categories?.error?.count ?? 0;
  const contrastCount = data.categories?.contrast?.count ?? 0;

  if (errorCount > 0 || contrastCount > 0) {
    const msg = `WAVE failures: errors=${errorCount}, contrast=${contrastCount}. Require 0 for both.`;
    const err = new Error(msg) as Error & { waveResponse?: WaveApiResponse };
    err.waveResponse = data;
    throw err;
  }

  return data;
}
