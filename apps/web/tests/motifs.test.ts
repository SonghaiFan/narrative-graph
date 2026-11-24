// A motif dragged onto the grid gets its nodes the way addMotifToGraph makes them: the track's value for the
// organising attribute, and one linking value for the whole motif. The edges the editor then derives must be the
// motif's own edges, and a second motif in another row must stay apart from it.
import { describe, expect, it } from 'vitest';
import { NARRATIVE_MOTIFS } from '../constants';
import type { Motif, NarrativeNode } from '../types';
import { computeEdges } from '../utils/computeEdges';

const place = (motif: Motif, startT: number, startH: number, link: string): NarrativeNode[] =>
  motif.nodes.map((n, i) => ({
    id: `${motif.id}-${startT}-${startH}-${i}`,
    time: startT + n.relTime,
    track: startH + n.relTrack,
    motifSource: motif.name,
    attributes: { Topic: [`row ${startH + n.relTrack}`], Entity: [link] },
    content: '',
  }));

const pairs = (nodes: NarrativeNode[], edges: { sourceId: string; targetId: string }[]) =>
  edges.map(e => `${nodes.findIndex(n => n.id === e.sourceId)}>${nodes.findIndex(n => n.id === e.targetId)}`).sort();

describe.each(NARRATIVE_MOTIFS)('motif $name', motif => {
  it('derives exactly its own edges once placed', () => {
    const nodes = place(motif, 0, 0, 'x');
    const columns = Math.max(...nodes.map(n => n.time)) + 1;
    const want = motif.edges.map(e => `${e.sourceIndex}>${e.targetIndex}`).sort();
    expect(pairs(nodes, computeEdges(nodes, 'Entity', columns))).toEqual(want);
  });

  it('is not linked to a motif of another link value in the next columns', () => {
    const first = place(motif, 0, 0, 'x');
    const second = place(motif, 3, 0, 'y');
    const all = [...first, ...second];
    const edges = computeEdges(all, 'Entity', 6);
    const crossing = edges.filter(e => {
      const a = all.find(n => n.id === e.sourceId)!;
      const b = all.find(n => n.id === e.targetId)!;
      return a.attributes.Entity[0] !== b.attributes.Entity[0];
    });
    expect(crossing).toEqual([]);
  });
});
