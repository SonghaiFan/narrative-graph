// AI graph generation through OpenRouter. No request leaves the test: fetch is a stand-in.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MODEL, OPENROUTER_URL, SUGGESTED_MODELS, buildRequestBody, extractJson, extractSources, generateGraphFromPrompt, toNodes,
} from '../services/ai';

const reply = (message: object, init: { ok?: boolean; status?: number } = {}) =>
  vi.fn(async () => ({
    ok: init.ok ?? true, status: init.status ?? 200, statusText: 'x',
    json: async () => ({ choices: [{ message }] }),
  } as unknown as Response));

const GRAPH = JSON.stringify({ nodes: [{ time: 0, track: 1, content: 'Ana met Ben.', attributes: [{ key: 'Entity', values: ['Ana', 'Ben'] }] }] });

describe('buildRequestBody', () => {
  const body = buildRequestBody('a story', 3, 5, false, 'vendor/model');

  it('names the model and carries the prompt as the user message', () => {
    expect(body.model).toBe('vendor/model');
    expect(body.messages.map(m => m.role)).toEqual(['system', 'user']);
    expect(body.messages[1].content).toBe('a story');
  });

  it('puts the grid size and the JSON shape in the instructions', () => {
    const system = body.messages[0].content;
    expect(system).toContain('5 (Time) x 3 (Track)');
    expect(system).toContain('{"nodes": [{"time": 0');
    expect(system).not.toMatch(/Google/i);
  });

  it('asks for a strict JSON schema', () => {
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.required).toEqual(['nodes']);
  });

  it('turns web search on for real news only', () => {
    expect(body).not.toHaveProperty('plugins');
    const search = buildRequestBody('p', 3, 5, true, 'm');
    expect(search.plugins).toEqual([{ id: 'web' }]);
    expect(search.messages[0].content).toContain('REAL NEWS');
  });
});

describe('extractJson', () => {
  it.each([
    ['plain', '{"a":1}'],
    ['in a code fence', '```json\n{"a":1}\n```'],
    ['with words around it', 'Here you go: {"a":1} Hope that helps.'],
  ])('reads JSON that is %s', (_name, text) => {
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it('refuses text with no object', () => {
    expect(() => extractJson('sorry, I cannot')).toThrow(/JSON/);
  });
});

describe('extractSources', () => {
  it('takes url citations, once each, with a title or else the address', () => {
    const message = { annotations: [
      { type: 'url_citation', url_citation: { url: 'https://a.test/1', title: 'One' } },
      { type: 'url_citation', url_citation: { url: 'https://a.test/1', title: 'One again' } },
      { type: 'url_citation', url_citation: { url: 'https://a.test/2' } },
      { type: 'something_else', url_citation: { url: 'https://a.test/3' } },
    ] };
    expect(extractSources(message)).toEqual([
      { title: 'One', uri: 'https://a.test/1' },
      { title: 'https://a.test/2', uri: 'https://a.test/2' },
    ]);
  });

  it('is empty without annotations', () => {
    expect(extractSources({})).toEqual([]);
    expect(extractSources(undefined)).toEqual([]);
  });
});

describe('toNodes', () => {
  it('turns the key/values list into the attribute record, and marks where it came from', () => {
    const [node] = toNodes(JSON.parse(GRAPH), true);
    expect(node).toMatchObject({ time: 0, track: 1, content: 'Ana met Ben.', attributes: { Entity: ['Ana', 'Ben'] }, motifSource: 'AI Search' });
    expect(node.id).toBeTruthy();
    expect(toNodes(JSON.parse(GRAPH), false)[0].motifSource).toBe('AI Creative');
  });

  it('also takes attributes already written as an object', () => {
    const nodes = toNodes({ nodes: [{ time: 1, track: 0, content: 'x', attributes: { Topic: ['Tax'] } }] }, false);
    expect(nodes[0].attributes).toEqual({ Topic: ['Tax'] });
  });

  it('refuses JSON without a nodes list', () => {
    expect(() => toNodes({}, false)).toThrow(/nodes/);
  });
});

describe('generateGraphFromPrompt', () => {
  it('sends one request to OpenRouter with the key and returns the graph', async () => {
    const fetchImpl = reply({ content: GRAPH });
    const result = await generateGraphFromPrompt('p', [], 3, 5, false, '  sk-or-1  ', 'vendor/model', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-1');
    expect(JSON.parse(init.body as string).model).toBe('vendor/model');
    expect(result.nodes).toHaveLength(1);
    expect(result).toMatchObject({ sources: [], recommendedRows: 3, recommendedCols: 5 });
  });

  it('uses the default model when none is given', async () => {
    const fetchImpl = reply({ content: GRAPH });
    await generateGraphFromPrompt('p', [], 3, 5, false, 'k', undefined, fetchImpl);
    expect(JSON.parse((fetchImpl.mock.calls[0] as any)[1].body).model).toBe(DEFAULT_MODEL);
  });

  it('brings back the sources in real-news mode only', async () => {
    const message = { content: GRAPH, annotations: [{ type: 'url_citation', url_citation: { url: 'https://a.test', title: 'A' } }] };
    expect((await generateGraphFromPrompt('p', [], 3, 5, true, 'k', 'm', reply(message))).sources).toEqual([{ title: 'A', uri: 'https://a.test' }]);
    expect((await generateGraphFromPrompt('p', [], 3, 5, false, 'k', 'm', reply(message))).sources).toEqual([]);
  });

  it.each([['', 'k', /API key/], ['   ', 'k', /API key/], ['k', '', /model/]] as const)(
    'refuses key %j with model %j before any request', async (key, model, message) => {
      const fetchImpl = reply({ content: GRAPH });
      const [apiKey, modelId] = key === 'k' ? [key, model] : [key, 'm'];
      await expect(generateGraphFromPrompt('p', [], 3, 5, false, apiKey, modelId, fetchImpl)).rejects.toThrow(message);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

  it('reports an error from OpenRouter with its code and message', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ error: { code: 401, message: 'No auth credentials found' } }) } as unknown as Response));
    await expect(generateGraphFromPrompt('p', [], 3, 5, false, 'bad', 'm', fetchImpl)).rejects.toThrow('OpenRouter 401: No auth credentials found');
  });

  it('reports an error that comes inside a 200 reply', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ error: { code: 429, message: 'rate limited' } }) } as unknown as Response));
    await expect(generateGraphFromPrompt('p', [], 3, 5, false, 'k', 'm', fetchImpl)).rejects.toThrow('rate limited');
  });

  it('reports an empty reply', async () => {
    await expect(generateGraphFromPrompt('p', [], 3, 5, false, 'k', 'm', reply({ content: '' }))).rejects.toThrow(/No response/);
  });

  it('offers real model ids and a default among them', () => {
    expect(SUGGESTED_MODELS).toContain(DEFAULT_MODEL);
    expect(SUGGESTED_MODELS.every(id => /^[a-z0-9.-]+\/[a-z0-9.:_-]+$/i.test(id))).toBe(true);
  });
});
