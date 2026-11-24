"""Build a TTNG from text: each passage becomes a node whose attributes an extractor reads from it.

    python -m ttng_extract passages.json --extractor "lexicon?lexicon=words.json" -o graph.json
    python -m ttng_extract passages.json --extractor "llm?spec=spec.json&provider=openrouter" -o graph.json

`passages.json` is a list. Each item is the text, or {"text": ..., "id": ..., "time": ...}. Without a `time`
a passage gets the next column, in the order given. The result is the file the editor's Import button
reads, with the text as the content of each node, and it goes straight into `ttng_align` and `ttng_story`.

`--extractor` names an extractor (see extractors.py) and may be repeated, as long as no two give the same
attribute. Options follow the name as a query string: `name?key=value&key=value`.

The organising rule (alpha) is applied here, because a node needs a track: the value that decides it is the
first of the node's values in the track priority, which is `--priority` or else the order in which values
first appear. A node with no value for the organising attribute is placed off the grid (track -1), as the
editor does.
"""
import argparse
import datetime
import json
import sys
from urllib.parse import parse_qsl

from extractors import ExtractorError, build_extractor, check_distinct, run_all
from ttng_align import resolve_track_value


def read_passages(items):
    """Passages as (id, text, time) in input order, from a list of strings or objects."""
    if not isinstance(items, list) or not items:
        raise ValueError("the passages must be a non-empty list")
    passages = []
    for index, item in enumerate(items):
        fields = {"text": item} if isinstance(item, str) else item
        if not isinstance(fields, dict) or not isinstance(fields.get("text"), str) or not fields["text"].strip():
            raise ValueError(f"passage {index + 1} needs a non-empty `text`")
        time = fields.get("time", index)
        if not isinstance(time, int) or isinstance(time, bool) or time < 0:
            raise ValueError(f"passage {index + 1}: `time` must be a column number, 0 or more")
        passages.append((str(fields.get("id", f"n{index + 1}")), fields["text"], time))
    ids = [p[0] for p in passages]
    if len(set(ids)) != len(ids):
        raise ValueError("passage ids must be unique")
    return passages


def extract_graph(passages, extractors, organising="Topic", linking="Entity", priority=None, now=None):
    """The graph file for `passages` (from `read_passages`): the editor's export, with its `structure`."""
    check_distinct(extractors)
    given = {a for e in extractors for a in e.attributes}
    for role, attribute in (("organising", organising), ("linking", linking)):
        if attribute not in given:
            raise ExtractorError(
                f"the {role} attribute {attribute!r} is given by no extractor (they give: {', '.join(sorted(given))})"
            )

    attributes = [run_all(extractors, text) for _, text, _ in passages]
    order = list(priority) if priority else list(dict.fromkeys(
        v for found in attributes for v in found.get(organising, [])
    ))
    nodes = []
    for index, ((node_id, text, time), found) in enumerate(zip(passages, attributes)):
        value = resolve_track_value(found.get(organising, []), order)
        # a value the priority does not list has no track: the priority is the whole list of tracks
        track = order.index(value) if value in order else -1
        nodes.append({
            "id": node_id,
            "label": f"v{index + 1}",
            "time": time,
            "track": track,
            "motifSource": "Extracted",
            "attributes": found,
            "content": text,
        })
    when = now or datetime.datetime.now(datetime.timezone.utc)
    return {
        "graph": {"nodes": nodes, "sources": []},
        "layout": {"rows": len(order), "cols": max(p[2] for p in passages) + 1},
        "metadata": {"timestamp": when.isoformat(timespec="milliseconds").replace("+00:00", "Z"), "version": "1.0"},
        "structure": {"organising": organising, "linking": linking, "priority": {organising: order}},
    }


def parse_extractor_argument(argument):
    """`name?key=value&key=value` as (name, {key: value})."""
    name, _, query = argument.partition("?")
    return name, dict(parse_qsl(query, keep_blank_values=True))


def main(argv=None, client=None):
    parser = argparse.ArgumentParser(prog="ttng_extract", description="Build a TTNG graph file from passages of text.")
    parser.add_argument("passages", help="JSON list of texts, or of {text, id, time}")
    parser.add_argument("--extractor", action="append", required=True, metavar="NAME[?key=value&...]",
                        help="an extractor: lexicon, llm, module:attribute, or an installed plugin; may be repeated")
    parser.add_argument("--organising", default="Topic", help="the attribute whose values are the tracks (alpha)")
    parser.add_argument("--linking", default="Entity", help="the attribute whose shared values link nodes (beta)")
    parser.add_argument("--priority", nargs="+", metavar="VALUE", help="track priority, highest first")
    parser.add_argument("-o", "--output", required=True, help="the graph file to write")
    args = parser.parse_args(argv)

    try:
        with open(args.passages) as file:
            passages = read_passages(json.load(file))
        extractors = [build_extractor(*parse_extractor_argument(a), client=client) for a in args.extractor]
        document = extract_graph(passages, extractors, args.organising, args.linking, args.priority)
    except (ValueError, OSError) as error:  # ExtractorError is a ValueError
        parser.error(str(error))
    with open(args.output, "w") as file:
        json.dump(document, file, indent=2, ensure_ascii=False)
        file.write("\n")


if __name__ == "__main__":
    sys.exit(main())
