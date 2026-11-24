// The sample graphs in examples/ must load in the editor and match the schema.
import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeEdges } from '../utils/computeEdges';
import { parseGraphFile } from '../utils/graphFile';
import { loadSchema } from './fixtures';

const example = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}`, import.meta.url), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.compile(loadSchema('graph'));
const validateFile = ajv.compile(loadSchema('graph-file'));

describe('little-red-riding-hood.json', () => {
  const doc = example('little-red-riding-hood.json');

  it('matches the graph file schema', () => {
    validateFile(doc);
    expect(validateFile.errors ?? []).toEqual([]);
  });

  it('is read by the import button', () => {
    const parsed = parseGraphFile(doc);
    expect(parsed?.nodes).toHaveLength(9);
    expect(parsed?.nodes.every(n => n.content)).toBe(true);
  });

  it('lists the tracks in the order of their rows', () => {
    // The editor names row i after the i-th Topic it meets, so the first node of each track must come in track order.
    const nodes = parseGraphFile(doc)!.nodes;
    const topics = [...new Set(nodes.map(n => n.attributes.Topic[0]))];
    expect(topics).toEqual(['Journey', 'Deception', 'Rescue']);
    topics.forEach((topic, row) => {
      expect(nodes.filter(n => n.attributes.Topic[0] === topic).every(n => n.track === row)).toBe(true);
    });
  });

  it('gives the story its shape: two nodes share the first and the fourth cell, and the edges follow the entities', () => {
    const nodes = parseGraphFile(doc)!.nodes;
    const cell = (label: string) => { const n = nodes.find(x => x.label === label)!; return `${n.time},${n.track}`; };
    expect(cell('v1')).toBe(cell('v2'));
    expect(cell('v7')).toBe(cell('v8'));
    const label = (id: string) => nodes.find(n => n.id === id)!.label;
    const edges = computeEdges(nodes, 'Entity', 5).map(e => `${label(e.sourceId)}>${label(e.targetId)}`);
    expect([...edges].sort()).toEqual(
      ['v1>v3', 'v1>v4', 'v2>v3', 'v2>v4', 'v3>v5', 'v3>v6', 'v4>v5', 'v4>v6', 'v5>v7', 'v5>v8', 'v6>v7', 'v6>v8', 'v7>v9', 'v8>v9'].sort()
    );
  });
});
