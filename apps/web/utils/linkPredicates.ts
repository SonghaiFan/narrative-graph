/**
 * What it means for two nodes to be linked by an attribute: the predicate of the Linking Rule (beta).
 *
 * A predicate gets the values the earlier node and the later node have for the linking attribute, and says
 * whether they are linked. It sees nothing else: not the tracks, not the times. Where the nodes sit on the
 * grid is the organising rule's business (utils/structure.ts), and the later node being in the very next
 * column is part of what beta is (utils/computeEdges.ts).
 *
 * python/ttng_edges.py has the same predicates under the same names, and schema/fixtures/edges*.json holds
 * both to the same answers.
 */
export type LinkPredicate = (from: string[], to: string[]) => boolean;

export const LINK_PREDICATES = {
    /** At least one value in common. Several shared values still make one link. */
    share: (from, to) => from.some(value => to.includes(value)),
    /** The same set of values, in any order, and not empty. */
    equal: (from, to) => {
        if (from.length === 0 || to.length === 0) return false;
        const a = new Set(from);
        const b = new Set(to);
        return a.size === b.size && [...a].every(value => b.has(value));
    },
} satisfies Record<string, LinkPredicate>;

export type LinkPredicateName = keyof typeof LINK_PREDICATES;

export const DEFAULT_LINK_PREDICATE: LinkPredicateName = 'share';

export const isLinkPredicateName = (value: unknown): value is LinkPredicateName =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(LINK_PREDICATES, value);
