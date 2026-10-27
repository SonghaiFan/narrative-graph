# schema

Planned: one JSON Schema for the narrative graph (nodes, edges, motifs) and the generated story (chapters), with TypeScript types and pydantic models generated from it.

Today the same data has two incompatible shapes: `apps/web/types.ts` (`time`, `track`, `attributes`) and `python/meta/types.py` (`index`, `Topic`, `time_period`). See [docs/MIGRATION.md](../docs/MIGRATION.md).
