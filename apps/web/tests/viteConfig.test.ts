// The build must not carry any API key into the bundle.
import { describe, expect, it } from 'vitest';
import config from '../vite.config';

describe('vite config', () => {
  it('defines nothing from the environment', async () => {
    process.env.GEMINI_API_KEY = 'sentinel-key';
    const resolved = typeof config === 'function' ? await config({ mode: 'production', command: 'build' }) : config;
    expect(JSON.stringify(resolved.define ?? {})).not.toContain('sentinel');
    expect(Object.keys(resolved.define ?? {})).toEqual([]);
  });
});
