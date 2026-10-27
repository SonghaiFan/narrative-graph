# narrative-graph (working title)

Design a story as a graph, then let an LLM write it.

A narrative is laid out on a **time × track grid**, where tracks are topics or entities. Nodes are story beats, edges connect beats that share an attribute, and nine reusable **motifs** (Linear, Arch, Ladder, EarlyTurn, LateTurn, SharpBranch, WideBranch, SharpMerge, WideMerge) describe how a plot moves between tracks.

> **Status: scaffold.** Three earlier projects were merged here with their git history intact. The code has not been refactored yet, so the pieces do not talk to each other. See [docs/MIGRATION.md](docs/MIGRATION.md) for what came from where and what is known to be broken.

## Layout

| Path | What it is | Came from |
|---|---|---|
| [apps/web](apps/web) | Graph editor: drag motifs onto the grid, DAG and force views, undo/redo, AI graph generation (React 19, Vite, Cytoscape, Gemini) | `ttng-constructor` |
| [python](python) | Generation engine: narrative structure → aligned themes, entities and time periods → LLM writes one chapter per node | `gpt_storytale` |
| [legacy/gpt_storyteller](legacy/gpt_storyteller) | Earlier pipeline. Kept only to lift cartographer, journalist and graph code into `python/`, then to be deleted | `gpt_storyteller` |
| [schema](schema) | Planned single source of truth for the graph and story JSON | – |
| [examples](examples) | Planned sample graphs and stories | – |
| [docs](docs) | Notes | – |

## Running the pieces today

Web editor:

```bash
cd apps/web
npm install
# put GEMINI_API_KEY in apps/web/.env.local
npm run dev
```

Python engine: see [python/README.md](python/README.md). It is out of date; [docs/MIGRATION.md](docs/MIGRATION.md) lists what is wrong with it.

## License

Not chosen yet.
