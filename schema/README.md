# schema

The contract between the Python engine and the graph editor: two JSON Schemas, one shared rule, and the sample data that both sides are tested against.

| File | What it describes |
|---|---|
| [graph.schema.json](graph.schema.json) | A narrative graph as the editor holds and imports it: nodes on a time-by-track grid, optional derived edges, optional sources |
| [graph-file.schema.json](graph-file.schema.json) | The file the editor's JSON button downloads: a `graph` (without edges), the `structure` S = (α, β) with its track priority, plus `layout` and `metadata` |
| [story.schema.json](story.schema.json) | A story as the Python writer produces it: one chapter per node of the narrative structure |
| [fixtures/](fixtures) | Sample data. The Python and web test suites read the same files |

The two schemas describe two different things. A graph is the shape of a narrative; a story is the text written for it. Mapping one onto the other is the work of Stage 2 in [docs/REFACTOR.md](../docs/REFACTOR.md).

## The Linking Rule (beta)

The editor derives the edges of a graph; it never reads them from a file. An edge `u -> v` exists when:

1. `v` is in the very next time column after `u` (`v.time == u.time + 1`);
2. the **predicate** says that `u` and `v` are linked by the linking attribute (default `Entity`).

There are two predicates, and a predicate sees only the two lists of values:

| Predicate | Linked when |
|---|---|
| `share` (default) | the lists have at least one value in common; several shared values still make one edge |
| `equal` | the lists hold the same set of values, in any order; an empty list links nothing |

The tracks play no part. They come from the organising rule (alpha), so a rule that looked at them would make a change of the organising attribute change the edges. Nodes on a negative track, or in a column at or beyond `maxTime`, are off the grid and are ignored. Edges come out ordered by time column, then by the input order of the nodes, and that order is part of the contract.

The attribute and the predicate are the linking rule's parameters, and a graph file records them as `structure.linking` and `structure.predicate`.

The rule exists twice, and both copies must agree:

- TypeScript: [apps/web/utils/computeEdges.ts](../apps/web/utils/computeEdges.ts) and [apps/web/utils/linkPredicates.ts](../apps/web/utils/linkPredicates.ts)
- Python: [python/ttng_edges.py](../python/ttng_edges.py)

## Fixtures

| File | Contents |
|---|---|
| `edges.json` | 31 hand-written cases for the Linking Rule. The expected edges were typed by hand |
| `edges.random.json` | 40 random graphs from seeded generators, 16 of them linked by `equal`. The expected edges come from a brute-force oracle written separately from both implementations, and both rules must match |
| `files.json` | Files the editor's JSON button writes, which the file schema must accept |
| `graphs.json` | Graphs the graph schema must accept |
| `story.json` | Stories the story schema must accept |
| `invalid.json` | 27 documents a schema must refuse, including a chapter in the old `event` / `topics` shape |

The fixtures are the reference. Changing the rule in one language fails that language's tests first; updating the fixtures to match then fails the other language until it follows.

## Checking

```bash
cd python && python -m pytest tests/test_edges.py tests/test_schema.py
cd apps/web && npm test
```

## Not here yet

- The narrative context files in `python/meta/` (a structure plus its themes and entities) have no schema. `python/ttng_align.py` reads them, but nothing validates them.
- Story files written by older versions of the code (`event` / `topics`) do not match `story.schema.json`, on purpose.
- Nothing generates TypeScript types or pydantic models from these schemas yet.
