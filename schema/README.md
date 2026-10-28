# schema

The contract between the Python engine and the graph editor: two JSON Schemas, one shared rule, and the sample data that both sides are tested against.

| File | What it describes |
|---|---|
| [graph.schema.json](graph.schema.json) | A narrative graph as the editor holds and imports it: nodes on a time-by-track grid, optional derived edges, optional sources |
| [graph-file.schema.json](graph-file.schema.json) | The file the editor's JSON button downloads: a `graph` (without edges) plus `layout` and `metadata` |
| [story.schema.json](story.schema.json) | A story as the Python writer produces it: one chapter per node of the narrative structure |
| [fixtures/](fixtures) | Sample data. The Python and web test suites read the same files |

The two schemas describe two different things. A graph is the shape of a narrative; a story is the text written for it. Mapping one onto the other is the work of Stage 2 in [docs/REFACTOR.md](../docs/REFACTOR.md).

## The edge rule

The editor derives the edges of a graph; it never reads them from a file. An edge `u -> v` exists when:

1. `v` is in the very next time column after `u` (`v.time == u.time + 1`);
2. their tracks differ by at most one row;
3. they share at least one value of the linking attribute (default `Entity`).

Nodes on a negative track, or in a column at or beyond `maxTime`, are off the grid and are ignored. Edges come out ordered by time column, then by the input order of the nodes, and that order is part of the contract.

The rule exists twice, and both copies must agree:

- TypeScript: [apps/web/utils/computeEdges.ts](../apps/web/utils/computeEdges.ts)
- Python: [python/ttng_edges.py](../python/ttng_edges.py)

## Fixtures

| File | Contents |
|---|---|
| `edges.json` | 23 hand-written cases for the edge rule. The expected edges were typed by hand |
| `edges.random.json` | 30 random graphs from a seeded generator. Expected edges come from the Python rule, and the web rule must match |
| `files.json` | Files the editor's JSON button writes, which the file schema must accept |
| `graphs.json` | Graphs the graph schema must accept |
| `story.json` | Stories the story schema must accept |
| `invalid.json` | 22 documents a schema must refuse, including a chapter in the old `event` / `topics` shape |

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
