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

1. **`python` cannot run.** `create_story` in `python/narrative_deducer.py:93-102` calls `make_chapter(theme=...)`, but the function takes a required `topic` and has no `theme` parameter, so the call raises `TypeError`.
2. **`python/README.md` describes files that do not exist:** `src/generate_story.py`, `src/evaluate.py`, `examples/`, `tests/` and a `LICENSE`.
3. **Dependencies:** the code uses the deprecated `langchain.llms.OpenAI`, and `python/requirements.txt` lists two unpinned packages.
4. **Two shapes for the same data.**
   - Python: `python/meta/types.py` uses `Topic`, `index`, `time_period`; `legacy/gpt_storyteller/graph.py` reads `themes`.
   - Web: `apps/web/types.ts` uses `track`, `time`, `attributes`.
   - Motif names also drifted: `ShortFork` / `LongFork` in `python/meta/narrative_context_*.json`, `EarlyTurn` / `LateTurn` in `apps/web/constants.ts`.
5. **Key exposure in the web app.** `apps/web/vite.config.ts` inlines `GEMINI_API_KEY` into the client bundle. Do not deploy publicly until users bring their own key or a proxy holds it.
6. **`apps/web/README.md`** is still the AI Studio template.
7. **No LICENSE.** `python/README.md` claims MIT.

## Planned moves

- [ ] Define `schema/` and generate TS types and pydantic models from it.
- [ ] Move `python/` into an installable package; replace LangChain with plain provider clients.
- [ ] Lift `gpt_cartographer.py`, `gpt_journalist.py` and `graph.py` out of `legacy/gpt_storyteller`; drop `__archive__`, `narrative_deducer copy 2.py` and the notebooks.
- [ ] Connect the editor to the writer: edit a graph in the browser, then generate the chapters.
- [ ] Move curated stories and graphs into `examples/`.
- [ ] Pick a license and a final name.
