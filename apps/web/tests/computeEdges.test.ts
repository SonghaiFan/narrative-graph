// The edge rule in TypeScript, held to the same fixtures as python/ttng_edges.py.
// The fixtures are the reference: changing the rule here fails these tests first. Updating the fixtures to
// match then fails python/tests/test_edges.py, which reads the very same files, until Python follows.
import { describe, expect, it } from 'vitest';
import { computeEdges } from '../utils/computeEdges';
import type { NarrativeNode } from '../types';
import { loadFixture } from './fixtures';

interface EdgeCase {
  name: string;
  linkingAttribute: string;
  maxTime: number;
  nodes: NarrativeNode[];
  expectedEdges: [string, string][];
}

for (const file of ['edges.json', 'edges.random.json']) {
  const { cases } = loadFixture<{ cases: EdgeCase[] }>(file);

  describe(`edge rule: ${file}`, () => {
    it.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
      const nodesBefore = JSON.stringify(c.nodes);

      const edges = computeEdges(c.nodes, c.linkingAttribute, c.maxTime);

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
