"""Write the chapters of a graph from the editor and put them back into it.

    python -m ttng_story narrative_graph.json --context meta/narrative_context_a.json --structure Arch \\
        --period 2024-01-01 2024-12-31 -o with_text.json

Reads the file the editor's JSON button wrote, aligns it (ttng_align), has the writer produce one chapter per
node (narrative_deducer), and writes the same file with each node's `content` filled in. The editor's import
button reads the result, and its story sidebar shows the text. This makes one model call per node.
"""
import argparse
import copy
import json
import sys

from narrative_deducer import create_story
from ttng_align import add_graph_arguments, align_graph, read_inputs, unwrap


def fill_content(document, texts):
    """A copy of the document in which node `id` has content `texts[id]`. Other nodes are left as they are."""
    result = copy.deepcopy(document)
    for node in unwrap(result)["nodes"]:
        if node["id"] in texts:
            node["content"] = texts[node["id"]]
    return result


def write_story(document, context=None, structure=None, period=None, seed=None, client=None):
    """Returns the document with the chapters written into it, and the story."""
    alignment = align_graph(unwrap(document), context=context, structure=structure, seed=seed, period=period)
    story = create_story(alignment, client=client)
    # The chapters come out in alignment order. Match by position: the id in a reply is the model's to write.
    texts = {node: chapter.content for node, chapter in zip(alignment, story.chapters)}
    return fill_content(document, texts), story


def main(argv=None, client=None):
    parser = argparse.ArgumentParser(prog="ttng_story", description="Write a graph's chapters into its nodes.")
    add_graph_arguments(parser)
    parser.add_argument("-o", "--output", required=True, help="the graph file with the text filled in")
    parser.add_argument("--story-out", help="also save the story as the writer returned it")
    args = parser.parse_args(argv)

    document, context, structure = read_inputs(args, parser)
    filled, story = write_story(document, context, structure, args.period, args.seed, client)
    with open(args.output, "w") as file:
        json.dump(filled, file, indent=2)
        file.write("\n")
    if args.story_out:
        with open(args.story_out, "w") as file:
            json.dump(story.dict(), file, indent=4)


if __name__ == "__main__":
    sys.exit(main())
