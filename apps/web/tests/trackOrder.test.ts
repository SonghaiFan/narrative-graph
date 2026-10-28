import { describe, expect, it } from 'vitest';
import { reorderVisible } from '../utils/trackOrder';

describe('reorderVisible', () => {
  const all = ['A', 'B', 'C', 'D'];

  it('moves a track down and up', () => {
    expect(reorderVisible(all, [], 0, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(reorderVisible(all, [], 3, 1)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('leaves the list alone for no move or an index out of range', () => {
    for (const [from, to] of [[1, 1], [-1, 2], [0, 4], [4, 0]]) expect(reorderVisible(all, [], from, to)).toBe(all);
  });

  it('counts only visible tracks, and hidden ones keep their slots', () => {
    // visible: A, C, D. Moving A (0) to the end (2) gives C, D, A in the visible slots.
    expect(reorderVisible(all, ['B'], 0, 2)).toEqual(['C', 'B', 'D', 'A']);
    expect(reorderVisible(['A', 'B', 'C', 'D', 'E'], ['A', 'E'], 0, 2)).toEqual(['A', 'C', 'D', 'B', 'E']);
  });

  it('keeps every label exactly once', () => {
    const out = reorderVisible(['x', 'y', 'z', 'w'], ['y'], 2, 0);
    expect([...out].sort()).toEqual(['w', 'x', 'y', 'z']);
  });

  it('treats an empty label as visible', () => {
    expect(reorderVisible(['A', '', 'C'], ['C'], 0, 1)).toEqual(['', 'A', 'C']);
  });

  it('does not change its input', () => {
    const copy = [...all];
    reorderVisible(copy, ['B'], 0, 2);
    expect(copy).toEqual(all);
  });
});
