# The thesis and this code

The thesis defines the model in Part III: chapter "The Time-Track Narrative Graph Model" (`Parts/Part3-Visualisation-Oriented-Data-Model/04-ttng-model.tex` in the thesis repository), chapter "Synthetic Data Pipeline" (`05-pipeline.tex`) and the appendix "Full synthetic narrative schema and examples". This page says where each part of it lives here, where the code is stricter or looser than the thesis, and what the thesis describes that this repository does not contain.

## Where the model lives

| Thesis | Here |
|---|---|
| Node `v = (p, A)`: an ordering attribute (time) and a set of attributes | `NarrativeNode` in [apps/web/types.ts](../apps/web/types.ts); `time` and `attributes` in [schema/graph.schema.json](../schema/graph.schema.json) |
| Organising rule α, with track priority for a node that has several values | `assignTracks` in [apps/web/utils/structure.ts](../apps/web/utils/structure.ts) (the editor); `resolve_track_value` in [python/ttng_align.py](../python/ttng_align.py) |
| Linking rule β | An attribute and a predicate (`share` or `equal`): `computeEdges` in [apps/web/utils/computeEdges.ts](../apps/web/utils/computeEdges.ts) with [linkPredicates.ts](../apps/web/utils/linkPredicates.ts); `derive_edges` in [python/ttng_edges.py](../python/ttng_edges.py) |
| The structure `S = (α, β)` | `structure` in the graph file: `organising`, `linking`, `predicate` and `priority`. The editor writes it on export and reads it on import; `structure_of` reads it in Python |
| Hard constraint: edges follow temporal order | An edge needs `target.time > source.time`. Python refuses a declared edge that does not; the edge rule below only ever makes edges to the next column |
| Soft constraints: one track per node; neighbouring tracks | One track per node, see "Stricter than the thesis". Neighbouring tracks are a matter of layout: the Linking Rule does not look at tracks |
| Nine 3-node motifs | `NARRATIVE_MOTIFS` in [apps/web/constants.ts](../apps/web/constants.ts) matches the thesis. `python/meta/narrative_context_*.json` calls EarlyTurn and LateTurn `ShortFork` and `LongFork` |
| Attributes from text, f(text) | Not in the thesis, where the attributes are given. [python/extractors.py](../python/extractors.py) is a plugin point for it, and [python/ttng_extract.py](../python/ttng_extract.py) builds a graph from text with it |
| Cartographer (rule-based) | `python/narrative_alignmenter.py` for context files; `python/ttng_align.py` for graphs |
| Writer (LLM) | `python/narrative_deducer.py` with the prompt in `python/prompts/chapter.md` |
| `StructureInstruction` in the appendix listing | The key is spelled that way in all new files. Files from before this change spell it `StuctureInstruction`, and the writer reads both |

## Stricter than the thesis

The thesis calls the temporal constraint hard and the other two constraints soft, and it lets the person who builds the graph state α and β. The code fixes more than that:

- **Time.** The thesis allows any later time (`t_j > t_i`). The edge rule makes an edge only to the very next column (`t_j = t_i + 1`). This suits the 3-node motifs, which use consecutive columns, but it means the editor cannot derive an edge that skips a column. A graph file read by Python may declare one.
- **Neighbouring tracks.** The thesis prefers edges between neighbouring tracks and allows longer ones. The edge rule used to join only tracks at most one row apart, which made the edges depend on the organising attribute. It no longer looks at tracks, so a long cross-track edge is derived like any other, and a preference for neighbouring tracks is for a layout to keep, not for the model. In the Red Riding Hood example, both views have the same 14 edges, including `v3 → v6`, which spans two tracks in the Topic view.
- **One track per node.** The thesis lets this be relaxed (as Metro Maps do). Here a node always has exactly one track, chosen by priority.

## What the thesis describes that is not in this repository

- **The Crafter.** The appendix gives its system prompt, but no code in this repository calls it. `python/README.md` already says so.
- **The validation of generated text.** The pipeline chapter reports Jaccard, TF-IDF and BERT similarity and two-sample t-tests between same-track and different-track pairs. I found no code for this in this repository, its history or the thesis repository. If the scripts exist elsewhere, they belong in `python/` so that the chapter can be reproduced.
- **Structure validation in the Cartographer.** The chapter lists it. For a graph, `align_graph` now checks that declared edges name real nodes and go forward in time, and that every node has a single value, or a priority to choose from several. It does not check the soft constraints, and `narrative_alignmenter.py` (the context-file path) checks nothing.

## Points in the thesis text to look at

These are in the thesis, not the code. I have not edited the thesis.

1. **The Entity view figure and the example table disagree.** The table gives V5 the entity Wolf only and V6 the entities Hunter and Wolf. In the Entity view of the figure that was shared with me, v5 sits on the Hunter track and v6 on the Wolf track. With the priority Hunter > Red > Wolf that the figure's track order suggests, the table puts v5 on Wolf and v6 on Hunter. A node without the entity Hunter cannot be on the Hunter track under any priority.
2. **The WideBranch formula.** `04-ttng-model.tex` gives `(h_i, t_j) → {(h_{i+1}, t_{j+1}), (h_{i+2}, t_{j+1})}`. That is a branch whose targets are on the next track and the one after, so it is not different in kind from SharpBranch. The code and the Python context files have the source on the middle track and the two targets above and below it. The formula probably should be `(h_{i+1}, t_j) → {(h_i, t_{j+1}), (h_{i+2}, t_{j+1})}`.
3. **`T1`, `T2`, `T3` for tracks.** The temporal constraint says "a node in T1 connects to T3 through T2". Elsewhere `T` is time and `H` is the track.
4. **The pipeline source link** `github.com/SonghaiFan/gpt_storytale` still works, because GitHub redirects it, but the repository is now `SonghaiFan/narrative-graph`.
