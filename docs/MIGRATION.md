# Migration notes

## Where everything came from

| Path here | Upstream repo | Upstream HEAD at import | Commits |
|---|---|---|---|
| `apps/web` | `SonghaiFan/ttng-constructor` | `9ca7fe1` | 23 |
| `python` | `SonghaiFan/gpt_storytale` | `8d3ee69` | 8 |
| `legacy/gpt_storyteller` | `SonghaiFan/gpt_storyteller` | `56ea6ca` | 31 |

`apps/web` and `legacy/gpt_storyteller` were imported with their paths rewritten under the prefix and joined with `git merge --allow-unrelated-histories`, so `git log -- apps/web` and `git log -- legacy/gpt_storyteller` show each project's own history. `python` is the original `gpt_storytale` history, unchanged: its files were moved into `python/` in a single rename commit, so older commits sit at the old root paths and `git log --follow python/<file>` follows a file across the move.

At the moment of import `apps/web` and `python` were byte-identical to the upstream HEADs, and so was `legacy/gpt_storyteller` apart from the exclusion below.

- **Hashes:** `python` keeps its original commit hashes. `apps/web` and `legacy/gpt_storyteller` were rewritten by the path move, so their hashes differ from the upstream repos.
- **`legacy/gpt_storyteller` leaves out `__archive__/`.** That folder was a scratch area holding a copy of a third-party course repository, which also sat at the repo root in early commits. Both locations were removed from the imported history on purpose.
- **Authorship is preserved,** including two commits by Simon D Angus in `gpt_storytale`. Check with them before changing the name or the license.
- **Not imported:** uncommitted working-tree edits in the original folders. The only real one was `ttng-constructor/package-lock.json` (9 lines of `peer` flags removed, probably npm noise); the rest were `.DS_Store` files.
- `.DS_Store` and `.pyc` files that upstream had tracked were deleted in their own commit.

## Known problems to fix first

1. **Fixed:** `create_story` called `make_chapter(theme=...)` although the function takes `topic`, so every run raised `TypeError`. It now passes `topic=`.
2. **Fixed:** `python/README.md` described files that did not exist (`src/generate_story.py`, `src/evaluate.py`, `examples/`, `tests/`, `LICENSE`). It was rewritten from the actual files.
3. **Fixed:** `python/requirements.txt` is pinned: langchain-core 0.3.86, openai 3.39.0 and python-dotenv 1.2.4. Unpinned, `pip install langchain` gives 1.x, which has no `langchain.output_parsers`. In `narrative_deducer.py`, `langchain.llms.OpenAI(model_name="gpt-4")` had become `OpenAIChat`, which ignored the model name (it sent `gpt-3.5-turbo`) and fails on openai 1.x or newer. It went through the deprecated community `ChatOpenAI` for a while and is now `llm.OpenAIClient`, a thin call to the openai SDK. No real OpenAI call has been tried.
4. **Two shapes for the same data.**
   - Python: `python/meta/types.py` uses `Topic`, `index`, `time_period`; `legacy/gpt_storyteller/graph.py` reads `themes`.
   - Web: `apps/web/types.ts` uses `track`, `time`, `attributes`.
   - Motif names also drifted: `ShortFork` / `LongFork` in `python/meta/narrative_context_*.json`, `EarlyTurn` / `LateTurn` in `apps/web/constants.ts`.
5. **Fixed:** the web app no longer builds `GEMINI_API_KEY` into the client bundle. The AI dialog asks users for their own key, which stays in session storage. The Gemini call itself has not been run.
6. **Fixed:** `apps/web/README.md` was the AI Studio template; it now describes the editor.
7. **Fixed:** MIT `LICENSE` added. Two commits in the history are by Simon D Angus; the license has not been checked with them.
8. **More loose ends in `python/`:** `narrative_alignmenter.py` stops with `NameError` when run directly; `story_packer.py` runs on import and moves files into `arc/` folders; the root `story.json` uses an older schema (`event`/`topics` instead of `title`/`Topic`). The 276 files of earlier run output in `python/{alignment,stories,logs}/arc` were moved to the private `Frankfsh/ttng-run-archive` (copied byte for byte, checked by hash from a fresh clone, then deleted here); they remain in this repository's git history.

## Planned moves

The staged plan for these moves, and the checks that keep the repo working while they happen, is in [REFACTOR.md](REFACTOR.md).

- [x] Define `schema/` for the graph and the story, with fixtures both test suites read.
- [ ] Generate TS types and pydantic models from the schemas.
- [ ] Move `python/` into an installable package; replace LangChain with plain provider clients.
- [ ] Lift `gpt_cartographer.py`, `gpt_journalist.py` and `graph.py` out of `legacy/gpt_storyteller`; drop `narrative_deducer copy 2.py` and the notebooks.
- [x] Connect the editor to the writer by file: export from the editor, `python -m ttng_story`, import the result. A button inside the editor is not built.
- [ ] Move curated stories and graphs into `examples/`.
- [x] Pick a license (MIT) and a name (ttng). Renaming the GitHub repository from `gpt_storytale` to `ttng` is not done.
