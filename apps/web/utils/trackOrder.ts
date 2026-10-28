/**
 * Moves the visible track at index `from` to index `to` and returns the full label list.
 * Hidden tracks keep their slots, so showing them again puts them back where they were.
 * A label is visible when it is empty or not hidden, as in GraphContext.visibleRowLabels.
 */
export const reorderVisible = (all: string[], hidden: string[], from: number, to: number): string[] => {
    const isVisible = (l: string) => !l || !hidden.includes(l);
    const visible = all.filter(isVisible);
    if (from === to || from < 0 || to < 0 || from >= visible.length || to >= visible.length) return all;
    const [moved] = visible.splice(from, 1);
    visible.splice(to, 0, moved);
    let next = 0;
    return all.map(l => (isVisible(l) ? visible[next++] : l));
};
