"""Which nodes of a narrative graph are connected: the Linking Rule (beta) of the model, in Python.

An edge u -> v exists when both of these hold:
  - v is in the very next time column after u (v["time"] == u["time"] + 1);
  - the predicate says that u and v are linked by the linking attribute: by default, that they share at
    least one value of it (for example a common Entity).

The tracks play no part. They come from the organising rule (alpha), so a rule that looked at them would make
a change of the organising attribute change the edges. Nodes on a negative track, or in a column at or beyond
max_time, are off the grid and are ignored.

This mirrors computeEdges in apps/web/utils/computeEdges.ts, and PREDICATES mirrors LINK_PREDICATES in
apps/web/utils/linkPredicates.ts. Both are tested against the same fixtures in schema/fixtures/, including
the order of the edges: the editor compares serialized edge lists to decide whether anything changed, so the
order is part of the contract. Edges come out ordered by time column, then by the order of the input nodes.

Nodes are plain dicts shaped like the graph JSON (schema/graph.schema.json).
"""

# A predicate gets the values of the earlier and the later node for the linking attribute and says whether
# they are linked. It sees nothing else.
PREDICATES = {
    "share": lambda source, target: bool(set(source) & set(target)),
    "equal": lambda source, target: bool(source) and bool(target) and set(source) == set(target),
}

DEFAULT_PREDICATE = "share"


def derive_edges(nodes, linking_attribute, max_time, predicate=DEFAULT_PREDICATE):
    """The edges of `nodes`. `predicate` is the name of one of PREDICATES, or a function of two value lists."""
    if callable(predicate):
        linked = predicate
    elif predicate in PREDICATES:
        linked = PREDICATES[predicate]
    else:
        raise ValueError(f"unknown link predicate {predicate!r}; use one of: {', '.join(PREDICATES)}")

    nodes_by_time = {}
    for node in nodes:
        if node["track"] < 0 or node["time"] >= max_time:
            continue
        nodes_by_time.setdefault(node["time"], []).append(node)

    edges = []
    for time in sorted(nodes_by_time):
        if time + 1 not in nodes_by_time:
            continue
        for u in nodes_by_time[time]:
            for v in nodes_by_time[time + 1]:
                u_values = u["attributes"].get(linking_attribute) or []
                v_values = v["attributes"].get(linking_attribute) or []
                if linked(u_values, v_values):
                    edges.append({"id": f"edge-{u['id']}-{v['id']}", "sourceId": u["id"], "targetId": v["id"]})
    return edges
