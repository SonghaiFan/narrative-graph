# examples

## Little Red Riding Hood and the Wolf

[little-red-riding-hood.json](little-red-riding-hood.json) is a finished graph in the format of the editor's JSON button: nine chapters on three tracks, with the factual statement of each already in the node.

| Track (Topic) | Chapters |
|---|---|
| Journey | v1 Red sets out, v2 the Wolf watches her, v3 they talk on the path |
| Deception | v4 the Wolf sends her to pick flowers, v5 he eats Grandma, v7 he lunges at Red, v8 Red enters the cottage |
| Rescue | v6 the Hunter tracks the Wolf, v9 the Hunter kills the Wolf |

v1 and v2 share one cell, and so do v7 and v8: the editor stacks them. Edges are not in the file; the editor derives them from the entities two chapters share in neighbouring columns (13 edges, drawn as the 8 arrows of the figure, because two pairs of nodes are stacked). The layout is the Topic view; the same graph can be laid out by Entity instead.

Open it in the editor with **Load example** in the left panel, or with **Import**. The tracks are labelled in the order the topics first appear in the file, so keep the first Journey, Deception and Rescue nodes in that order if you edit it.

To see the Python side work on it, write the chapters again with your own key:

```bash
cd python
python -m ttng_story ../examples/little-red-riding-hood.json --period 2024-01-01 2024-12-31 \
  --provider openrouter -o /tmp/red-hood-rewritten.json
```

This makes nine model calls and overwrites each node's `content` in the copy it writes; the original file is not touched. It has not been run against a real model.

## More to add

Candidates already in the repo:

- `python/stories/arc/` was moved to the private `Frankfsh/ttng-run-archive`
- `python/meta/narrative_context_*.json` — narrative structures with their themes and entities (five files holding 2 to 16 structures each; `_a` has the nine used by the pipeline)
- `legacy/gpt_storyteller/graphs/` — sample graphs with rendered PNGs
