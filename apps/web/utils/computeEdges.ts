import type { NarrativeEdge, NarrativeNode } from '../types';
import { LINK_PREDICATES, type LinkPredicate, type LinkPredicateName } from './linkPredicates';

/**
 * The Linking Rule (beta): which nodes are connected, derived from node positions and one linking attribute.
 *
 * An edge u -> v exists when both of these hold:
 *   - v is in the very next time column after u (v.time === u.time + 1);
 *   - the predicate says that u and v are linked by the linking attribute: by default, that they share at
 *     least one value of it (for example a common Entity). See utils/linkPredicates.ts.
 *
 * The tracks play no part. They come from the organising rule (alpha), so a rule that looked at them would
 * make a change of the organising attribute change the edges. Nodes on a negative track, or in a column at
 * or beyond maxTime, are off the grid and are ignored.
 *
 * This is a pure function. The Python engine implements the same rule in python/ttng_edges.py, and both
 * are tested against the shared fixtures in schema/fixtures/. Edges come out ordered by time column, then
 * by the order of the input nodes. The editor relies on that order being stable: it compares serialized
 * edge lists to decide whether anything changed.
 */
export const computeEdges = (
    nodes: NarrativeNode[],
    linkingAttr: string,
    maxTime: number,
    predicate: LinkPredicate | LinkPredicateName = 'share'
): NarrativeEdge[] => {
    const linked = typeof predicate === 'function' ? predicate : LINK_PREDICATES[predicate];
    if (!linked) throw new Error(`unknown link predicate: ${String(predicate)}`);
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
                const uAttrs = u.attributes[linkingAttr] || [];
                const vAttrs = v.attributes[linkingAttr] || [];

                if (linked(uAttrs, vAttrs)) {
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
