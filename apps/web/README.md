# TTNG Constructor

A visual editor for Temporal Topic Narrative Graphs: drag narrative motifs onto a time-by-track grid, give the nodes attributes such as Topic and Entity, and see how they connect.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

The AI Generate dialog asks for your own Gemini API key. The key stays in the browser tab (session storage) and is sent only to Google. Nothing is read from `.env` and nothing is built into the bundle.

## Check

```bash
npm run typecheck
npm test
npm run build
```

## Files

The **JSON** button downloads `narrative_graph.json` and **Import** reads it back; [../../schema/graph-file.schema.json](../../schema/graph-file.schema.json) describes the file. Edges are not saved, because the editor derives them from the nodes ([utils/computeEdges.ts](utils/computeEdges.ts)). To write the chapters of an exported graph, see `python -m ttng_story` in [../../python/README.md](../../python/README.md).
