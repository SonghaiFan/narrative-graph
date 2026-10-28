import type { NarrativeEdge, NarrativeNode } from '../types';

/**
 * The "Beta rule": which nodes are connected, derived from node positions and one linking attribute.
 *
 * An edge u -> v exists when all of these hold:
 *   - v is in the very next time column after u (v.time === u.time + 1);
 *   - their tracks differ by at most one row;
 *   - they share at least one value of the linking attribute (for example a common Entity).
 *
 * Nodes on a negative track, or in a column at or beyond maxTime, are off the grid and are ignored.
 *
 * This is a pure function. The Python engine implements the same rule in python/ttng_edges.py, and both
 * are tested against the shared fixtures in schema/fixtures/. Edges come out ordered by time column, then
 * by the order of the input nodes. The editor relies on that order being stable: it compares serialized
 * edge lists to decide whether anything changed.
 */
export const computeEdges = (nodes: NarrativeNode[], linkingAttr: string, maxTime: number): NarrativeEdge[] => {
    const edges: NarrativeEdge[] = [];
    const nodesByTime: Record<number, NarrativeNode[]> = {};

    nodes.forEach(n => {
        if (n.track < 0 || n.time >= maxTime) return;
        if (!nodesByTime[n.time]) nodesByTime[n.time] = [];
        nodesByTime[n.time].push(n);
    });

    const times = Object.keys(nodesByTime).map(Number).sort((a, b) => a - b);

    for (let i = 0; i < times.length; i++) {
        const t = times[i];
        if (!nodesByTime[t + 1]) continue;

        const currentNodes = nodesByTime[t];
        const nextNodes = nodesByTime[t + 1];

        currentNodes.forEach(u => {
            nextNodes.forEach(v => {
                const isAdjacentTrack = Math.abs(u.track - v.track) <= 1;
                if (!isAdjacentTrack) return;

                const uAttrs = u.attributes[linkingAttr] || [];
                const vAttrs = v.attributes[linkingAttr] || [];
                const isConnected = uAttrs.some(val => vAttrs.includes(val));

                if (isConnected) {
                    edges.push({
                        id: `edge-${u.id}-${v.id}`,
                        sourceId: u.id,
                        targetId: v.id
                    });
                }
            });
        });
    }
    return edges;
};
