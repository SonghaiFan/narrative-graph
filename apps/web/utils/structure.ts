import type { NarrativeNode } from '../types';
import { isLinkPredicateName, type LinkPredicateName } from './linkPredicates';

/**
 * The structure S = (alpha, beta) of a TTNG (thesis, chapter "The Time-Track Narrative Graph Model"):
 * the attribute that organises nodes into tracks (alpha), the attribute that links them and the predicate that
 * decides (beta), and the track priority that settles which track a node with several values belongs to. All three are choices made by the
 * person who builds the graph, so the file carries them; without them a re-import would have to guess.
 */
export interface Structure {
    organising?: string;
    linking?: string;
    predicate?: LinkPredicateName;
    priority?: Record<string, string[]>;
}

const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(v => typeof v === 'string');

/** The structure in a parsed file, or undefined. Anything that is not the right shape is dropped, not repaired. */
export const readStructure = (value: unknown): Structure | undefined => {
    if (typeof value !== 'object' || value === null) return undefined;
    const doc = value as Record<string, unknown>;
    const structure: Structure = {};
    if (typeof doc.organising === 'string') structure.organising = doc.organising;
    if (typeof doc.linking === 'string') structure.linking = doc.linking;
    if (isLinkPredicateName(doc.predicate)) structure.predicate = doc.predicate;
    if (typeof doc.priority === 'object' && doc.priority !== null && !Array.isArray(doc.priority)) {
        const priority: Record<string, string[]> = {};
        for (const [attr, labels] of Object.entries(doc.priority)) {
            if (isStringList(labels)) priority[attr] = labels;
        }
        structure.priority = priority;
    }
    return Object.keys(structure).length > 0 ? structure : undefined;
};

/**
 * Track labels for one attribute, highest priority first: the declared priority, then any other value in the
 * order the nodes first show it. Declared values that no node uses stay, so that their (empty) tracks survive.
 */
export const orderLabels = (nodes: NarrativeNode[], attribute: string, declared: string[] = []): string[] => {
    const labels = [...new Set(declared.filter(l => l))];
    for (const node of nodes) {
        for (const value of node.attributes[attribute] || []) {
            if (!labels.includes(value)) labels.push(value);
        }
    }
    return labels;
};

/**
 * The organising rule alpha with track priority: a node goes to the visible track of the highest-priority
 * value it carries. A node with no value on a visible track gets track -1, which keeps it off the grid.
 */
export const assignTracks = (
    nodes: NarrativeNode[],
    attribute: string,
    priority: string[],
    visibleLabels: string[]
): NarrativeNode[] => {
    const rank = new Map<string, number>();
    priority.forEach((label, i) => { if (label) rank.set(label, i); });
    const row = new Map<string, number>();
    visibleLabels.forEach((label, i) => { if (label) row.set(label, i); });

    return nodes.map(node => {
        let best: string | null = null;
        let bestRank = Infinity;
        for (const value of node.attributes[attribute] || []) {
            const r = rank.has(value) ? rank.get(value)! : Infinity;
            if (r < bestRank) { bestRank = r; best = value; }
        }
        const track = best !== null && row.has(best) ? row.get(best)! : -1;
        return node.track === track ? node : { ...node, track };
    });
};
