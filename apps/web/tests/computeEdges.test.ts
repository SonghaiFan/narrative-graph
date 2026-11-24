// The edge rule in TypeScript, held to the same fixtures as python/ttng_edges.py.
// The fixtures are the reference: changing the rule here fails these tests first. Updating the fixtures to
// match then fails python/tests/test_edges.py, which reads the very same files, until Python follows.
import { describe, expect, it } from 'vitest';
import { computeEdges } from '../utils/computeEdges';
import { LINK_PREDICATES, type LinkPredicateName } from '../utils/linkPredicates';
import type { NarrativeNode } from '../types';
import { loadFixture } from './fixtures';

interface EdgeCase {
  name: string;
  linkingAttribute: string;
  predicate?: LinkPredicateName;
  maxTime: number;
  nodes: NarrativeNode[];
  expectedEdges: [string, string][];
}

for (const file of ['edges.json', 'edges.random.json']) {
  const { cases } = loadFixture<{ cases: EdgeCase[] }>(file);

  describe(`edge rule: ${file}`, () => {
    it.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
      const nodesBefore = JSON.stringify(c.nodes);

      const edges = computeEdges(c.nodes, c.linkingAttribute, c.maxTime, c.predicate);

      expect(edges.map(e => [e.sourceId, e.targetId])).toEqual(c.expectedEdges);
      expect(edges.map(e => e.id)).toEqual(c.expectedEdges.map(([source, target]) => `edge-${source}-${target}`));
      expect(JSON.stringify(c.nodes)).toBe(nodesBefore); // pure: the input is left alone
    });
  });
}

describe('edge rule: the fixture files are not hollow', () => {
  const hand = loadFixture<{ cases: EdgeCase[] }>('edges.json').cases;
  const random = loadFixture<{ cases: EdgeCase[] }>('edges.random.json').cases;

  it('has enough cases with and without edges', () => {
    expect(hand.length).toBeGreaterThanOrEqual(20);
    expect(hand.some(c => c.expectedEdges.length > 0)).toBe(true);
    expect(hand.some(c => c.expectedEdges.length === 0)).toBe(true);
    expect(random.filter(c => c.expectedEdges.length > 0).length).toBeGreaterThanOrEqual(20);
    expect(random.filter(c => c.expectedEdges.length === 0).length).toBeGreaterThanOrEqual(3);
  });
});

describe('the Linking Rule does not look at the tracks', () => {
  const cases = ['edges.json', 'edges.random.json'].flatMap(f => loadFixture<{ cases: EdgeCase[] }>(f).cases);

  it.each(cases.map(c => [c.name, c] as const))('moving every node to another track keeps the edges: %s', (_name, c) => {
    // a move that changes who is next to whom
    const moved = c.nodes.map((n, i) => (n.track >= 0 ? { ...n, track: n.track + 7 * (i % 3) } : n));
    expect(computeEdges(moved, c.linkingAttribute, c.maxTime, c.predicate)).toEqual(
      computeEdges(c.nodes, c.linkingAttribute, c.maxTime, c.predicate)
    );
  });
});

describe('link predicates', () => {
  it.each([
    [[], [], false, false],
    [['a'], [], false, false],
    [['a'], ['a'], true, true],
    [['a', 'b'], ['b'], true, false],
    [['a', 'b'], ['b', 'a'], true, true],
    [['a', 'a'], ['a'], true, true],
    [['a'], ['A'], false, false],
  ] as [string[], string[], boolean, boolean][])('on their own: %j and %j', (from, to, share, equal) => {
    expect(LINK_PREDICATES.share(from, to)).toBe(share);
    expect(LINK_PREDICATES.equal(from, to)).toBe(equal);
  });

  const pair: NarrativeNode[] = [
    { id: 'a', time: 0, track: 0, attributes: { Entity: ['x'] } },
    { id: 'b', time: 1, track: 0, attributes: { Entity: ['y'] } },
  ];

  it('may be a function', () => {
    expect(computeEdges(pair, 'Entity', 5, (from, to) => from[0] !== to[0]).map(e => e.id)).toEqual(['edge-a-b']);
    expect(computeEdges(pair, 'Entity', 5, () => false)).toEqual([]);
  });

  it('refuse a name they do not know', () => {
    expect(() => computeEdges(pair, 'Entity', 5, 'similar' as LinkPredicateName)).toThrow('unknown link predicate: similar');
  });
});
