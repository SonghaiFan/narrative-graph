"""Which nodes of a narrative graph are connected: the editor's "Beta rule", in Python.

An edge u -> v exists when all of these hold:
  - v is in the very next time column after u (v["time"] == u["time"] + 1);
  - their tracks differ by at most one row;
  - they share at least one value of the linking attribute (for example a common Entity).

Nodes on a negative track, or in a column at or beyond max_time, are off the grid and are ignored.

This mirrors computeEdges in apps/web/utils/computeEdges.ts. Both are tested against the same fixtures in
schema/fixtures/, including the order of the edges: the editor compares serialized edge lists to decide
whether anything changed, so the order is part of the contract. Edges come out ordered by time column,
then by the order of the input nodes.

Nodes are plain dicts shaped like the graph JSON (schema/graph.schema.json).
"""


def derive_edges(nodes, linking_attribute, max_time):
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
                if abs(u["track"] - v["track"]) > 1:
                    continue
                u_values = u["attributes"].get(linking_attribute) or []
                v_values = v["attributes"].get(linking_attribute) or []
                if any(value in v_values for value in u_values):
                    edges.append({"id": f"edge-{u['id']}-{v['id']}", "sourceId": u["id"], "targetId": v["id"]})
    return edges
