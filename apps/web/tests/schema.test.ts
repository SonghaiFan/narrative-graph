// The JSON Schemas in schema/, checked against the shared fixtures (python/tests/test_schema.py does the same).
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { computeEdges } from '../utils/computeEdges';
import type { NarrativeNode } from '../types';
import { loadFixture, loadSchema } from './fixtures';

const ajv = new Ajv2020({ allErrors: true, strict: true });
const graph = ajv.compile(loadSchema('graph'));
const story = ajv.compile(loadSchema('story'));
const file = ajv.compile(loadSchema('graph-file')); // refers to the graph schema by its relative path
const validators = { graph, story, file };

const messages = (validate: typeof graph, document: unknown): string[] => {
  validate(document);
  return (validate.errors ?? []).map(e => `${e.instancePath} ${e.message}`);
};

describe('schemas', () => {
  it('are valid schemas', () => {
    expect(ajv.validateSchema(loadSchema('graph'))).toBe(true);
    expect(ajv.validateSchema(loadSchema('story'))).toBe(true);
    expect(ajv.validateSchema(loadSchema('graph-file'))).toBe(true);
  });

  const files = loadFixture<{ files: { name: string; file: unknown }[] }>('files.json').files;
  it.each(files.map(f => [f.name, f.file] as const))('graph file accepted: %s', (_name, doc) => {
    expect(messages(file, doc)).toEqual([]);
  });

  const graphs = loadFixture<{ graphs: { name: string; graph: unknown }[] }>('graphs.json').graphs;
  it.each(graphs.map(g => [g.name, g.graph] as const))('graph accepted: %s', (_name, doc) => {
    expect(messages(graph, doc)).toEqual([]);
  });

  const stories = loadFixture<{ stories: { name: string; story: unknown }[] }>('story.json').stories;
  it.each(stories.map(s => [s.name, s.story] as const))('story accepted: %s', (_name, doc) => {
    expect(messages(story, doc)).toEqual([]);
  });

  const invalid = loadFixture<{ cases: { schema: 'graph' | 'story' | 'file'; name: string; data: unknown }[] }>('invalid.json').cases;
  it.each(invalid.map(c => [`${c.schema}: ${c.name}`, c] as const))('refused: %s', (_label, c) => {
    expect(messages(validators[c.schema], c.data).length).toBeGreaterThan(0);
  });

  const edgeCases = ['edges.json', 'edges.random.json'].flatMap(
    file => loadFixture<{ cases: { name: string; linkingAttribute: string; maxTime: number; nodes: NarrativeNode[] }[] }>(file).cases,
  );
  it.each(edgeCases.map(c => [c.name, c] as const))('a graph with its derived edges is valid: %s', (_name, c) => {
    const edges = computeEdges(c.nodes, c.linkingAttribute, c.maxTime);
    expect(messages(graph, { nodes: c.nodes, edges })).toEqual([]);
  });
});
