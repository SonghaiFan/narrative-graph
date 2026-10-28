// The key and the model the user types: remembered in the browser, never built into the bundle.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadApiKey, loadModel, saveApiKey, saveModel } from '../utils/apiKey';

afterEach(() => vi.unstubAllGlobals());

const memory = () => {
  const store = new Map<string, string>();
  return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
};
const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

describe('the remembered key and model', () => {
  it('are empty when there is no storage', () => {
    expect(loadApiKey()).toBe('');
    expect(loadModel()).toBe('');
    expect(() => saveApiKey('x')).not.toThrow();
    expect(() => saveModel('x')).not.toThrow();
  });

  it('come back from storage', () => {
    vi.stubGlobal('sessionStorage', memory());
    vi.stubGlobal('localStorage', memory());
    saveApiKey('abc');
    saveModel('openai/gpt-4o-mini');
    expect(loadApiKey()).toBe('abc');
    expect(loadModel()).toBe('openai/gpt-4o-mini');
  });

  it('keep the key out of local storage, which outlives the tab', () => {
    const session = memory();
    const local = memory();
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    saveApiKey('secret');
    saveModel('m/x');
    expect(session.getItem('ttng.openrouterApiKey')).toBe('secret');
    expect(local.getItem('ttng.openrouterApiKey')).toBeNull();
    expect(session.getItem('ttng.model')).toBeNull();
  });

  it('survive a blocked storage', () => {
    vi.stubGlobal('sessionStorage', blocked);
    vi.stubGlobal('localStorage', blocked);
    expect(loadApiKey()).toBe('');
    expect(loadModel()).toBe('');
    expect(() => saveApiKey('x')).not.toThrow();
    expect(() => saveModel('x')).not.toThrow();
  });
});
