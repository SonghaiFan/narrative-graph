# TTNG Constructor

A visual editor for Time Track Narrative Graphs (ttng): drag narrative motifs onto a time-by-track grid, give the nodes attributes such as Topic and Entity, and see how they connect.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

The AI Generate dialog works through [OpenRouter](https://openrouter.ai), so one key reaches many models. Type your own OpenRouter API key and a model id (`vendor/model`, any id on openrouter.ai/models; a few are suggested). The key stays in the browser tab (session storage) and is sent only to OpenRouter; the model id is remembered across visits. Nothing is read from `.env` and nothing is built into the bundle. "Real News" mode turns on OpenRouter's web search and shows the pages it cited as sources; "Creative Fiction" does not.

## Tracks

Tracks are edited beside the graph. Hover a track name to get its controls: drag the handle to reorder, the eye hides the track (it then appears under the graph as a chip to show it again), the bin deletes it. The name itself is editable. Nodes stay with their track when it moves.

## Check

```bash
npm run typecheck
npm test
npm run build
```

## Files

The **JSON** button downloads `narrative_graph.json` and **Import** reads it back; [../../schema/graph-file.schema.json](../../schema/graph-file.schema.json) describes the file. Edges are not saved, because the editor derives them from the nodes ([utils/computeEdges.ts](utils/computeEdges.ts)). To write the chapters of an exported graph, see `python -m ttng_story` in [../../python/README.md](../../python/README.md).
