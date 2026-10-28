"""Align a TTNG graph (the shape the web editor holds) for the chapter writer.

`narrative_alignmenter.align_theme_entity` reads a context file: a structure whose node ids are a theme
letter plus a chapter digit. This module reads a graph instead: nodes on a time-by-track grid, each with
attributes. It returns the same alignment the writer takes, so `narrative_deducer.create_story` accepts
either.

    python -m ttng_align graph.json --context meta/narrative_context_a.json --seed 42 -o alignment.json

What a node needs, and where the rest comes from:

- Entity: kept as the graph has it. A node without any is sampled from its topic's pool in the context.
- Topic: exactly one value; it becomes the chapter's theme. The context entry with the same `theme`
  supplies the description and the pool, if the graph needs them.
- Time: a "Time Period" attribute with two ISO dates, else the topic's date range cut into one slice per
  time column, as the old aligner does, else a `period` given for the whole graph cut the same way. The
  editor's own "Time Period" values are free text such as "Jan 2024", so a graph from the editor needs one
  of the last two.
- Parents: the graph's `edges` when it has them. Otherwise the editor's edge rule, which needs the nodes
  to carry entities already.
"""
import argparse
import datetime
import json
import random
import sys

from narrative_alignmenter import generate_time_periods
from ttng_edges import derive_edges

TOPIC = "Topic"
TIME_PERIOD = "Time Period"
SAMPLE_SIZE = 4  # entities drawn from a topic's pool, as in the old aligner


def graph_from_structure(structure):
    """The graph an old-style structure stands for: letter = track, digit = time column.

    Returns the graph (with its declared edges) and the context entries to align it with.
    """
    symbols = sorted({node[0] for node in structure["nodes"]})
    themes = {ctx["symbol"]: ctx["theme"] for ctx in structure["context"]}
    graph = {
        "nodes": [
            {
                "id": node,
                "time": int(node[-1]) - 1,
                "track": symbols.index(node[0]),
                "attributes": {TOPIC: [themes[node[0]]]},
            }
            for node in structure["nodes"]
        ],
        "edges": [
            {"id": f"edge-{e['from']}-{e['to']}", "sourceId": e["from"], "targetId": e["to"]}
            for e in structure["edges"]
        ],
    }
    return graph, structure["context"]


def unwrap(document):
    """The graph inside what the editor's JSON button wrote ({graph: {...}, layout, metadata}), or the bare graph."""
    return document["graph"] if isinstance(document.get("graph"), dict) else document


def align_graph(graph, context=None, structure=None, seed=None, entity_attribute="Entity", period=None):
    """Align a graph. `structure` may carry `name`, `description` and `structure` for the prompt text.

    `period` is [start, end] ISO dates, used for nodes that have no dates of their own and no topic range.
    """
    nodes = [n for n in graph["nodes"] if n["track"] >= 0]  # off-grid nodes are not part of the story
    ids = [n["id"] for n in nodes]
    if len(set(ids)) != len(ids):
        raise ValueError("node ids must be unique")
    if not nodes:
        return {}
    by_id = {n["id"]: n for n in nodes}
    columns = max(n["time"] for n in nodes) + 1

    if "edges" in graph:
        edges = [(e["sourceId"], e["targetId"]) for e in graph["edges"]]
    else:
        edges = [(e["sourceId"], e["targetId"]) for e in derive_edges(nodes, entity_attribute, columns)]
    parents = {}
    for source, target in edges:
        for end in (source, target):
            if end not in by_id:
                raise ValueError(f"edge refers to {end!r}, which is not a node on the grid")
        parents.setdefault(target, []).append(source)

    pools = {}
    for ctx in context or []:
        pools.setdefault(ctx["theme"], ctx)

    structure = structure or {}
    name = structure.get("name", "custom")
    description = structure.get(
        "description", f"a graph of {len(nodes)} chapters over {columns} time columns"
    )
    shape = structure.get("structure") or ", ".join(f"{s} -> {t}" for s, t in edges)

    rng = random.Random(seed)
    alignment = {}
    for node_id in _parents_first(ids, parents):
        node = by_id[node_id]
        topics = node["attributes"].get(TOPIC, [])
        if len(topics) != 1:
            raise ValueError(f"node {node_id!r} needs exactly one {TOPIC} value, has {len(topics)}")
        topic = topics[0]
        ctx = pools.get(topic)

        entities = list(node["attributes"].get(entity_attribute, []))
        inherited = [e for p in parents.get(node_id, []) for e in alignment[p]["Entity"]]
        if entities:
            # Given entities stay. Only a node that shares nothing with its parents gets one more.
            if inherited and not set(entities) & set(inherited):
                entities.append(rng.choice(inherited))
        else:
            if ctx is None or not ctx.get("entities"):
                raise ValueError(f"node {node_id!r} has no {entity_attribute} and the context has no pool for {topic!r}")
            pool = [e["name"] if isinstance(e, dict) else e for e in ctx["entities"]]
            entities = rng.sample(pool, min(len(pool), SAMPLE_SIZE))
            if inherited:
                entities.append(rng.choice(inherited))

        alignment[node_id] = {
            "Theme": topic,
            "ThemeDescription": ctx["description"] if ctx else topic,
            "Entity": list(set(entities)),
            "Time": _time_of(node, ctx, columns, period),
            "Prev": parents.get(node_id, []),
            "StuctureInstruction": (  # misspelled on purpose: the writer reads this key
                f"The narrative structure is {name}, where {description} (eg. {shape}). "
                f"The current chapter node is {node_id}, which is the {node['time'] + 1}th chapter node in the narrative structure."
            ),
        }
    return alignment


def _parents_first(ids, parents):
    """Input order, except that a node waits until all its parents are done (as the old aligner does)."""
    waiting = list(ids)
    done = []
    while waiting:
        progressed = False
        for node in list(waiting):
            if all(p in done for p in parents.get(node, [])):
                done.append(node)
                waiting.remove(node)
                progressed = True
        if not progressed:
            raise ValueError(f"the edges contain a cycle through {waiting[0]!r}")
    return done


def _time_of(node, ctx, columns, period):
    given = node["attributes"].get(TIME_PERIOD, [])
    if len(given) == 2:
        for day in given:
            datetime.datetime.strptime(day, "%Y-%m-%d")
        return list(given)
    if ctx is not None:
        return generate_time_periods(ctx["time"][0], ctx["time"][1], columns)[node["time"]]
    if period is not None:
        return generate_time_periods(period[0], period[1], columns)[node["time"]]
    raise ValueError(
        f"node {node['id']!r} has no {TIME_PERIOD} of two ISO dates, and neither the context nor --period gives dates"
    )


def load_context(path, structure_name=None):
    """Read a context file. A list of structures needs `structure_name`; returns (context entries, structure)."""
    with open(path) as file:
        context = json.load(file)
    if context and "context" in context[0]:  # a list of structures: take one, as storytale.py does
        structure = next((s for s in context if s["name"] == structure_name), None)
        if structure is None:
            raise ValueError(f"--structure must name one of: {', '.join(s['name'] for s in context)}")
        return structure["context"], structure
    return context, None


def add_graph_arguments(parser):
    parser.add_argument("graph", help="graph JSON: the editor's file ({graph: {...}}) or a bare {nodes, edges?}")
    parser.add_argument("--context", help="context JSON: a list of structures or of {theme, description, time, entities}")
    parser.add_argument("--structure", help="when the context is a list of structures, the one to take themes from")
    parser.add_argument("--period", nargs=2, metavar=("START", "END"), help="ISO dates for nodes that have none")
    parser.add_argument("--seed", type=int)


def read_inputs(args, parser):
    with open(args.graph) as file:
        document = json.load(file)
    context, structure = None, None
    if args.context:
        try:
            context, structure = load_context(args.context, args.structure)
        except ValueError as error:
            parser.error(str(error))
    return document, context, structure


def main(argv=None):
    parser = argparse.ArgumentParser(prog="ttng_align", description="Align a TTNG graph for the chapter writer.")
    add_graph_arguments(parser)
    parser.add_argument("-o", "--output", help="write here instead of stdout")
    args = parser.parse_args(argv)

    document, context, structure = read_inputs(args, parser)
    alignment = align_graph(unwrap(document), context=context, structure=structure, seed=args.seed, period=args.period)
    text = json.dumps(alignment, indent=2)
    if args.output:
        with open(args.output, "w") as file:
            file.write(text + "\n")
    else:
        print(text)


if __name__ == "__main__":
    sys.exit(main())
