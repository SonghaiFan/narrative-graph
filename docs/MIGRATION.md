# Migration notes

## Where everything came from

| Path here | Upstream repo | Upstream HEAD at import | Commits |
|---|---|---|---|
| `apps/web` | `SonghaiFan/ttng-constructor` | `9ca7fe1` | 23 |
| `python` | `SonghaiFan/gpt_storytale` | `8d3ee69` | 8 |
| `legacy/gpt_storyteller` | `SonghaiFan/gpt_storyteller` | `56ea6ca` | 31 |

Each subtree was imported with its paths rewritten under the prefix, then joined with `git merge --allow-unrelated-histories`. `git log -- apps/web`, `git log -- python` and `git log -- legacy/gpt_storyteller` show each project's own history. The three subtrees were byte-identical to the upstream HEADs at the moment of import.

- **`python` hashes differ from upstream.** A stray root `.env` in the first upstream commit was removed from the imported history, which changes every `python` commit hash.
- **Authorship is preserved,** including two commits by Simon D Angus in `gpt_storytale`. Check with them before changing the name or the license.
- **Not imported:** uncommitted working-tree edits in the original folders. The only real one was `ttng-constructor/package-lock.json` (9 lines of `peer` flags removed, probably npm noise); the rest were `.DS_Store` files.
- `.DS_Store` and `.pyc` files that upstream had tracked were deleted in their own commit.

## Known problems to fix first

1. **Fixed:** `create_story` called `make_chapter(theme=...)` although the function takes `topic`, so every run raised `TypeError`. It now passes `topic=`.
2. **Fixed:** `python/README.md` described files that did not exist (`src/generate_story.py`, `src/evaluate.py`, `examples/`, `tests/`, `LICENSE`). It was rewritten from the actual files.
3. **Fixed:** `python/requirements.txt` is pinned to langchain 0.3.30, langchain-community 0.3.31, openai 3.39.0 and python-dotenv 1.2.4. It no longer installs LangChain 1.x (which has no `langchain.output_parsers`) and no longer omits `openai` and `langchain-community`. In `narrative_deducer.py`, `langchain.llms.OpenAI(model_name="gpt-4")` was replaced by `langchain_community.chat_models.ChatOpenAI`: the old call became `OpenAIChat`, which ignored the model name (it sent `gpt-3.5-turbo`) and fails on openai 1.x or newer. `ChatOpenAI` from langchain-community is itself deprecated in favour of `langchain-openai`. No real OpenAI call has been tried.
4. **Two shapes for the same data.**
   - Python: `python/meta/types.py` uses `Topic`, `index`, `time_period`; `legacy/gpt_storyteller/graph.py` reads `themes`.
   - Web: `apps/web/types.ts` uses `track`, `time`, `attributes`.
   - Motif names also drifted: `ShortFork` / `LongFork` in `python/meta/narrative_context_*.json`, `EarlyTurn` / `LateTurn` in `apps/web/constants.ts`.
5. **Key exposure in the web app.** `apps/web/vite.config.ts` inlines `GEMINI_API_KEY` into the client bundle. Do not deploy publicly until users bring their own key or a proxy holds it.
6. **`apps/web/README.md`** is still the AI Studio template.
7. **No LICENSE.** The old `python/README.md` claimed MIT.
8. **More loose ends in `python/`:** `narrative_alignmenter.py` stops with `NameError` when run directly; `story_packer.py` runs on import and moves files into `arc/` folders; 80 of the committed sample stories use an older schema (`event`/`topics` instead of `title`/`Topic`).

## Planned moves

- [ ] Define `schema/` and generate TS types and pydantic models from it.
- [ ] Move `python/` into an installable package; replace LangChain with plain provider clients.
- [ ] Lift `gpt_cartographer.py`, `gpt_journalist.py` and `graph.py` out of `legacy/gpt_storyteller`; drop `__archive__`, `narrative_deducer copy 2.py` and the notebooks.
- [ ] Connect the editor to the writer: edit a graph in the browser, then generate the chapters.
- [ ] Move curated stories and graphs into `examples/`.
- [ ] Pick a license and a final name.
