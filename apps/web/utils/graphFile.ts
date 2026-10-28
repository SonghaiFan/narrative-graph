import type { NarrativeGraph, NarrativeNode, Source } from '../types';

export interface GraphFile {
    graph: { nodes: NarrativeNode[]; sources?: Source[] };
    layout: { rows: number; cols: number };
    metadata: { timestamp: string; version: string };
}

/**
 * What the JSON button downloads. Edges are left out because they are derived from the nodes by the edge rule
 * (computeEdges). schema/graph-file.schema.json describes the result.
 */
export const buildGraphFile = (
    graph: NarrativeGraph,
    layout: { rows: number; cols: number },
    now: Date = new Date()
): GraphFile => {
    const { edges, ...graphData } = graph;
    return {
        graph: graphData,
        layout: { rows: layout.rows, cols: layout.cols },
        metadata: { timestamp: now.toISOString(), version: '1.0' }
    };
};

/**
 * What the import button accepts: a graph file ({graph: {nodes}}) or a bare graph ({nodes}). Edges in the file
 * are ignored. Anything else gives null.
 */
export const parseGraphFile = (json: unknown): { nodes: NarrativeNode[]; sources?: Source[] } | null => {
    if (typeof json !== 'object' || json === null) return null;
    const doc = json as { graph?: { nodes?: unknown; sources?: Source[] }; nodes?: unknown; sources?: Source[] };
    if (doc.graph && Array.isArray(doc.graph.nodes)) {
        return { nodes: doc.graph.nodes as NarrativeNode[], sources: doc.graph.sources };
    }
    if (Array.isArray(doc.nodes)) return { nodes: doc.nodes as NarrativeNode[], sources: doc.sources };
    return null;
};
