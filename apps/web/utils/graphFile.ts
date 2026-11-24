import type { NarrativeGraph, NarrativeNode, Source } from '../types';
import { readStructure, type Structure } from './structure';

export interface GraphFile {
    graph: { nodes: NarrativeNode[]; sources?: Source[] };
    layout: { rows: number; cols: number };
    metadata: { timestamp: string; version: string };
    structure?: Structure;
}

/**
 * What the JSON button downloads. Edges are left out because they are derived from the nodes by the edge rule
 * (computeEdges). schema/graph-file.schema.json describes the result.
 */
export const buildGraphFile = (
    graph: NarrativeGraph,
    layout: { rows: number; cols: number },
    now: Date = new Date(),
    structure?: Structure
): GraphFile => {
    const { edges, ...graphData } = graph;
    return {
        graph: graphData,
        layout: { rows: layout.rows, cols: layout.cols },
        metadata: { timestamp: now.toISOString(), version: '1.0' },
        ...(structure ? { structure } : {})
    };
};

/**
 * What the import button accepts: a graph file ({graph: {nodes}}) or a bare graph ({nodes}). Edges in the file
 * are ignored. The structure (organising and linking attribute, track priority) comes from a graph file only.
 * Anything else gives null.
 */
export const parseGraphFile = (
    json: unknown
): { nodes: NarrativeNode[]; sources?: Source[]; structure?: Structure } | null => {
    if (typeof json !== 'object' || json === null) return null;
    const doc = json as { graph?: { nodes?: unknown; sources?: Source[] }; nodes?: unknown; sources?: Source[]; structure?: unknown };
    if (doc.graph && Array.isArray(doc.graph.nodes)) {
        const structure = readStructure(doc.structure);
        return { nodes: doc.graph.nodes as NarrativeNode[], sources: doc.graph.sources, ...(structure ? { structure } : {}) };
    }
    if (Array.isArray(doc.nodes)) return { nodes: doc.nodes as NarrativeNode[], sources: doc.sources };
    return null;
};
