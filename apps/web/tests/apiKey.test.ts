// The Gemini key comes from the user, and nothing about it is built into the bundle.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadApiKey, saveApiKey } from '../utils/apiKey';

const construct = vi.fn();
vi.mock('@google/genai', () => ({
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', INTEGER: 'INTEGER', NUMBER: 'NUMBER' },
  GoogleGenAI: class {
    constructor(options: unknown) { construct(options); }
    models = { generateContent: async () => { throw new Error('stop here'); } };
  },
}));

afterEach(() => { construct.mockClear(); vi.unstubAllGlobals(); });

describe('generateGraphFromPrompt', () => {
  it('refuses to start without a key, and builds no client', async () => {
    const { generateGraphFromPrompt } = await import('../services/ai');
    for (const key of ['', '   ']) {
      await expect(generateGraphFromPrompt('p', [], 3, 5, false, key)).rejects.toThrow(/API key/);
    }
    expect(construct).not.toHaveBeenCalled();
  });

  it('uses the key it is given, trimmed', async () => {
    const { generateGraphFromPrompt } = await import('../services/ai');
    await expect(generateGraphFromPrompt('p', [], 3, 5, false, '  my-key  ')).rejects.toThrow('stop here');
    expect(construct).toHaveBeenCalledWith({ apiKey: 'my-key' });
  });

  it('can be imported with no key anywhere, which used to crash the app', async () => {
    await expect(import('../services/ai')).resolves.toBeDefined();
    expect(construct).not.toHaveBeenCalled();
  });
});

describe('the remembered key', () => {
  it('is empty when there is no storage', () => {
    expect(loadApiKey()).toBe('');
    expect(() => saveApiKey('x')).not.toThrow();
  });

  it('comes back from session storage, and a blocked storage does not break it', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    saveApiKey('abc');
    expect(loadApiKey()).toBe('abc');
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(loadApiKey()).toBe('');
    expect(() => saveApiKey('x')).not.toThrow();
  });
});
