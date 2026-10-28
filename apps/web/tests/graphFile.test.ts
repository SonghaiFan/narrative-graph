// The file the JSON button writes and the import button reads (utils/graphFile.ts), against the shared schema.
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { computeEdges } from '../utils/computeEdges';
import { buildGraphFile, parseGraphFile } from '../utils/graphFile';
import type { NarrativeGraph } from '../types';
import { loadFixture, loadSchema } from './fixtures';

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(loadSchema('graph'));
const validFile = ajv.compile(loadSchema('graph-file'));

const files = loadFixture<{ files: { name: string; file: any }[] }>('files.json').files;
const WHEN = new Date('2024-06-01T12:00:00.000Z');

const graphOf = (file: any, linking = 'Entity'): NarrativeGraph => {
  const nodes = file.graph.nodes;
  return { nodes, edges: computeEdges(nodes, linking, 10), sources: file.graph.sources };
};

describe('buildGraphFile', () => {
  it.each(files.map(f => [f.name, f.file] as const))('writes what the schema accepts: %s', (_name, file) => {
    const built = buildGraphFile(graphOf(file), file.layout ?? { rows: 0, cols: 0 }, WHEN);
    expect(validFile(built)).toBe(true);
  });

  it('leaves the edges out even when the graph has them', () => {
    const graph = graphOf(files[0].file);
    expect(graph.edges.length).toBeGreaterThan(0);
    const built = buildGraphFile(graph, { rows: 3, cols: 4 }, WHEN);
    expect(Object.keys(built.graph)).not.toContain('edges');
    expect(JSON.stringify(built)).not.toContain('sourceId');
  });

  it('keeps every node as it is, text included', () => {
    const graph = graphOf(files[0].file);
    expect(buildGraphFile(graph, { rows: 3, cols: 4 }, WHEN).graph.nodes).toEqual(graph.nodes);
  });

  it('records the grid size, the time and the version', () => {
    const built = buildGraphFile({ nodes: [], edges: [] }, { rows: 5, cols: 7 }, WHEN);
    expect(built.layout).toEqual({ rows: 5, cols: 7 });
    expect(built.metadata).toEqual({ timestamp: '2024-06-01T12:00:00.000Z', version: '1.0' });
  });

  it('does not change the graph it is given', () => {
    const graph = graphOf(files[0].file);
    const before = JSON.stringify(graph);
    buildGraphFile(graph, { rows: 1, cols: 1 }, WHEN);
    expect(JSON.stringify(graph)).toBe(before);
  });
});

describe('parseGraphFile', () => {
  it('reads back what was written, through JSON text', () => {
    const graph = graphOf(files[0].file);
    const text = JSON.stringify(buildGraphFile(graph, { rows: 3, cols: 4 }, WHEN));
    const parsed = parseGraphFile(JSON.parse(text));
    expect(parsed?.nodes).toEqual(graph.nodes);
    expect(parsed?.sources).toEqual(graph.sources);
    expect(computeEdges(parsed!.nodes, 'Entity', 10)).toEqual(graph.edges); // the edges come back by the rule
  });

  it('accepts a bare graph and ignores its edges', () => {
    const parsed = parseGraphFile({ nodes: [], edges: [{ id: 'e', sourceId: 'a', targetId: 'b' }], sources: [] });
    expect(parsed).toEqual({ nodes: [], sources: [] });
  });

  it.each([null, 5, 'text', [], {}, { graph: {} }, { graph: { nodes: 'no' } }, { nodes: {} }])('refuses %j', doc => {
    expect(parseGraphFile(doc)).toBeNull();
  });
});
