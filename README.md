# ttng

Design a story as a graph, then let an LLM write it. ttng stands for Temporal Topic Narrative Graph.

A narrative is laid out on a **time × track grid**, where tracks are topics or entities. Nodes are story beats, edges connect beats that share an attribute, and nine reusable **motifs** (Linear, Arch, Ladder, EarlyTurn, LateTurn, SharpBranch, WideBranch, SharpMerge, WideMerge) describe how a plot moves between tracks.

> **Status: early.** Three earlier projects were merged here with their git history intact and are being joined step by step ([docs/REFACTOR.md](docs/REFACTOR.md)). The editor's JSON file goes through the Python writer and back (`python -m ttng_story`); there is no button for it yet, and the writer has never been run against the live OpenAI API. See [docs/MIGRATION.md](docs/MIGRATION.md) for what came from where.

## Layout

| Path | What it is | Came from |
|---|---|---|
| [apps/web](apps/web) | Graph editor: drag motifs onto the grid, DAG and force views, undo/redo, AI graph generation (React 19, Vite, Cytoscape, Gemini) | `ttng-constructor` |
| [python](python) | Generation engine: narrative structure → aligned themes, entities and time periods → LLM writes one chapter per node | `gpt_storytale` |
| [legacy/gpt_storyteller](legacy/gpt_storyteller) | Earlier pipeline. Kept only to lift cartographer, journalist and graph code into `python/`, then to be deleted | `gpt_storyteller` |
| [schema](schema) | The graph, graph-file and story JSON Schemas, with the fixtures both test suites read | – |
| [examples](examples) | Planned sample graphs and stories | – |
| [docs](docs) | Notes | – |

## Running the pieces today

Web editor:

```bash
cd apps/web
npm install
npm run dev    # the AI dialog asks for your own Gemini key; none is needed to edit
```

Python engine: see [python/README.md](python/README.md).

## License

[MIT](LICENSE). The repository still lives at `SonghaiFan/gpt_storytale`.
