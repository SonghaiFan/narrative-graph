// The structure S = (alpha, beta) with track priority, as the thesis defines it (utils/structure.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeEdges } from '../utils/computeEdges';
import { buildGraphFile, parseGraphFile } from '../utils/graphFile';
import { assignTracks, orderLabels, readStructure } from '../utils/structure';
import type { NarrativeNode } from '../types';

const node = (id: string, time: number, attrs: Record<string, string[]>, track = -1): NarrativeNode =>
  ({ id, time, track, attributes: attrs });

const redRidingHood = JSON.parse(readFileSync(new URL('../../../examples/little-red-riding-hood.json', import.meta.url), 'utf8'));

describe('assignTracks (organising rule with track priority)', () => {
  it('puts a node with several values on the track of the highest-priority one', () => {
    const nodes = [node('a', 0, { Entity: ['Wolf', 'Red'] })];
    expect(assignTracks(nodes, 'Entity', ['Red', 'Wolf'], ['Red', 'Wolf'])[0].track).toBe(0);
    expect(assignTracks(nodes, 'Entity', ['Wolf', 'Red'], ['Wolf', 'Red'])[0].track).toBe(0);
    expect(assignTracks(nodes, 'Entity', ['Wolf', 'Red'], ['Red', 'Wolf'])[0].track).toBe(1); // priority, not row order
  });

  it('changes the graph when only the priority changes', () => {
    const nodes = [node('a', 0, { Entity: ['Hunter', 'Wolf'] }), node('b', 1, { Entity: ['Wolf'] })];
    const rows = (order: string[]) => assignTracks(nodes, 'Entity', order, order).map(n => n.track);
    expect(rows(['Hunter', 'Wolf'])).toEqual([0, 1]);
    expect(rows(['Wolf', 'Hunter'])).toEqual([0, 0]);
  });

  it('keeps a node off the grid when none of its values has a visible track', () => {
    const nodes = [node('a', 0, { Entity: ['Wolf'] }), node('b', 0, {})];
    expect(assignTracks(nodes, 'Entity', ['Wolf'], []).map(n => n.track)).toEqual([-1, -1]);
  });

  it('returns the same node object when nothing changes', () => {
    const nodes = [node('a', 0, { Entity: ['Red'] }, 0)];
    expect(assignTracks(nodes, 'Entity', ['Red'], ['Red'])[0]).toBe(nodes[0]);
  });
});

describe('orderLabels', () => {
  const nodes = [node('a', 0, { Entity: ['Red'] }), node('b', 0, { Entity: ['Wolf', 'Hunter'] })];
  it('lists the declared priority first, then new values in the order they appear', () => {
    expect(orderLabels(nodes, 'Entity', ['Hunter'])).toEqual(['Hunter', 'Red', 'Wolf']);
    expect(orderLabels(nodes, 'Entity')).toEqual(['Red', 'Wolf', 'Hunter']);
  });
  it('keeps declared values that no node uses, and drops empty and repeated ones', () => {
    expect(orderLabels(nodes, 'Entity', ['Unused', '', 'Unused'])).toEqual(['Unused', 'Red', 'Wolf', 'Hunter']);
  });
});

describe('readStructure', () => {
  it('reads what the file declares and drops what is not the right shape', () => {
    expect(readStructure({ organising: 'Topic', linking: 'Entity', priority: { Topic: ['A', 'B'], Entity: 'oops' } }))
      .toEqual({ organising: 'Topic', linking: 'Entity', priority: { Topic: ['A', 'B'] } });
    expect(readStructure({ organising: 3 })).toBeUndefined();
    expect(readStructure({ predicate: 'equal' })).toEqual({ predicate: 'equal' });
    expect(readStructure({ predicate: 'similar' })).toBeUndefined(); // a predicate this build does not have is dropped
    expect(readStructure(null)).toBeUndefined();
    expect(readStructure({ priority: ['A'] })).toBeUndefined();
  });
});

describe('the structure in a graph file', () => {
  it('survives writing and reading', () => {
    const structure = { organising: 'Entity', linking: 'Topic', predicate: 'equal' as const, priority: { Entity: ['Hunter', 'Red', 'Wolf'] } };
    const file = buildGraphFile({ nodes: [], edges: [] }, { rows: 1, cols: 1 }, new Date(0), structure);
    expect(parseGraphFile(JSON.parse(JSON.stringify(file)))?.structure).toEqual(structure);
  });
  it('is left out of a file that has none', () => {
    expect('structure' in buildGraphFile({ nodes: [], edges: [] }, { rows: 1, cols: 1 })).toBe(false);
    expect(parseGraphFile({ nodes: [] })).toEqual({ nodes: [], sources: undefined });
  });
});

describe('the Red Riding Hood example in both views of the thesis', () => {
  const parsed = parseGraphFile(redRidingHood)!;
  const label = (nodes: NarrativeNode[], id: string) => nodes.find(n => n.id === id)!.label;
  const view = (attribute: string) => {
    const priority = parsed.structure!.priority![attribute];
    return assignTracks(parsed.nodes, attribute, priority, priority);
  };
  const edgesOf = (nodes: NarrativeNode[]) =>
    computeEdges(nodes, 'Entity', 5).map(e => `${label(nodes, e.sourceId)}>${label(nodes, e.targetId)}`).sort();

  it('declares the Topic view as its organising rule', () => {
    expect(parsed.structure).toMatchObject({ organising: 'Topic', linking: 'Entity' });
  });

  it('keeps the tracks of the file in the Topic view', () => {
    expect(view('Topic').map(n => n.track)).toEqual(parsed.nodes.map(n => n.track));
  });

  it('puts each node on the highest-priority entity it has in the Entity view (Hunter > Red > Wolf)', () => {
    const rows = Object.fromEntries(view('Entity').map(n => [n.label, n.track]));
    // v1 Red; v2 Wolf; v3, v4 Red and Wolf; v5 Wolf; v6 Hunter and Wolf; v7, v8 Red and Wolf; v9 Hunter, Red, Wolf
    expect(rows).toEqual({ v1: 1, v2: 2, v3: 1, v4: 1, v5: 2, v6: 0, v7: 1, v8: 1, v9: 0 });
  });

  it('has the same edges in both views: the organising rule does not change who is linked', () => {
    // The Linking Rule looks at the next column and the shared entities, not at the tracks. v3 and v6 are
    // two tracks apart in the Topic view and neighbours in the Entity view, and are linked in both.
    const topic = edgesOf(view('Topic'));
    expect(topic).toHaveLength(14);
    expect(topic).toContain('v3>v6');
    expect(edgesOf(view('Entity'))).toEqual(topic);
  });
});
