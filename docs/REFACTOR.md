# Refactor plan: the ship of Theseus

The goal is to combine the Python story engine (`python/`) with the graph editor (`apps/web/`) without ever stopping the ship. Parts are replaced one at a time, and after every commit both halves still work.

## Rules

1. **No commit leaves the repo broken.** Python tests pass and the web app type-checks and builds.
2. **New part first, old part second.** A replacement is built next to the old one, proven equal on the same sample data, switched over, and only then is the old one deleted.
3. **Shared sample data decides.** Python and TypeScript must agree on the same fixture files, not on each other's descriptions of them.
4. **Tests assert properties, not random draws.** `random.sample` sequences are not stable across Python versions, so a frozen snapshot would fail for no reason.
5. **Nothing here talks to a real API.** Tests block sockets and DNS, and the OpenAI request is checked against a faked HTTP layer.

## Checks to run before every commit

```bash
# Python
cd python
pip install -r requirements-dev.txt
python -m pytest

# Web
cd apps/web
npm ci
npm run typecheck
npm test
npm run build
```

`.github/workflows/ci.yml` runs the same two jobs. It has not run on GitHub yet; it was written on a local branch and only checked as YAML.

## Stages

| Stage | What is replaced | How we know the ship still floats | State |
|---|---|---|---|
| 0. Keel | Nothing changes behaviour. Add the test net, fix the web type check, add CI | The tests below pass on the current code | done (`refactor/stage-0-keel`) |
| 1. Shared contract | Define the graph and story JSON in `schema/`. Move the web's edge rule into a pure function and write the same rule in Python | Both read the same fixtures and derive identical edges | done (`refactor/stage-1-contract`), except that the story is not yet mapped to the graph |
| 2. Aligner | The aligner reads a TTNG graph. Nodes that already carry entities keep them; only missing ones are sampled | The nine existing structures, turned into graphs, align exactly as the old aligner does | done (`refactor/stage-2-aligner`), as a new module next to the old aligner; nothing is switched over yet |
| 3. Writer | A swappable LLM client, prompts moved to files, the deprecated community `ChatOpenAI` replaced | The wire test still sees `gpt-4`, temperature 0.5 and the parent chapter text | |
| 4. Connect | A small local service wraps the Python engine; the editor gets a "write story" action that fills `node.content` | Build a graph in the editor, get chapters back | |
| 5. Retire | Delete `legacy/` and the flat scripts, decide the fate of `python/*/arc` data, choose a license and a name, stop inlining the Gemini key | Everything deleted is already covered by a new part | |

## What the test net covers today

- **Aligner** (`tests/test_alignment.py`): for all nine structures and three seeds: every node aligned once, parents before children, `Prev` matches the edges, themes and time slices stay in range, each child shares an entity with its parents, same seed gives the same result.
- **Writer** (`tests/test_writer.py`): chapter order, theme and time period in every prompt, parent text carried forward (including a merge with two parents), `gpt-4` at temperature 0.5, the result validates as a `Story`.
- **End to end** (`tests/test_storytale_flow.py`): `generate_story_files` writes the alignment, story and log for every structure.
- **Wire** (`tests/test_openai_wire.py`): the real `ChatOpenAI` and openai SDK send one `POST /v1/chat/completions` with `model` `gpt-4` and no stray fields.
- **Packer** (`tests/test_story_packer.py`): `story_packer.py` bundles the stories and then moves every file into `arc/`.
- **Guards** (`tests/test_guards.py`): sockets and DNS are blocked, and the writer must not go back to `langchain.llms.OpenAI`.
- **Edge rule** (`python/tests/test_edges.py`, `apps/web/tests/computeEdges.test.ts`): 23 hand-written and 30 random cases from `schema/fixtures/`. Both sides must produce the same edges in the same order, leave the input untouched, and give edges that fit the graph schema.
- **Graph aligner** (`python/tests/test_align_graph.py`): for all nine structures and three seeds, the graph of a structure aligns to exactly what `align_theme_entity` gives (same node order, same fields, same entities). Also: given entities are kept, a node that shares nothing with its parent gets one, parents come from declared edges or else the edge rule, time comes from the node or from slicing the topic's range, off-grid nodes are left out, bad graphs are refused with a reason, the writer accepts the result, and the command line works.
- **Schemas** (`python/tests/test_schema.py`, `apps/web/tests/schema.test.ts`): the schemas are valid, the good graphs and stories are accepted, 18 bad documents are refused, and what the pipeline writes matches `story.schema.json`.

Each of these was checked by putting the bug back in a scratch copy: the old `theme=` argument, the old `langchain.llms.OpenAI` call, a silent drop to `gpt-3.5-turbo`, a writer that forgets the parent chapter, an aligner that stops linking children to parents, time slices running backwards, and a packer that stops moving files. Every one made tests fail.

Stage 1 was checked in two more ways. The original inline code in `GraphContext.tsx`, the extracted `computeEdges` and the Python rule agreed on 10,000 random graphs, down to the id and the order of every edge. And 14 planted deviations in the rule, 7 in each language, were each caught by the tests of the language they were planted in, while the other language's tests kept passing.

Stage 2 was checked by planting seven deviations in `ttng_align.py` (sample size, the parent entity, giving a parent entity to every node, dropping `Prev`, wrong time slice, keeping off-grid nodes, ignoring declared edges). Every one made tests fail; one first survived and got its own test.

## What the test net does not cover

- A real OpenAI call. Nothing in this repo has been run against the live API since the writer was fixed.
- The web app's behaviour beyond the edge rule. It builds and type-checks, but its components and the rest of the graph context have no tests.
- The CI workflow on GitHub itself.

## Facts that shape the next stages

- **The web derives its edges; it does not read them.** Importing a graph reads `nodes` and `sources` only. An edge `u -> v` exists when `v.time == u.time + 1`, the tracks differ by at most 1, and the two nodes share a value of the linking attribute (default `Entity`) (`apps/web/context/GraphContext.tsx`, `computeEdges`).
- **Python declares its edges.** The structure lists them, and the aligner makes each child share at least one entity with the union of its parents.
- **Node ids line up.** In the nine structures of `narrative_context_a.json` the letter is the theme (a track in the editor) and the digit is the time column.
- **Time periods do not line up yet.** The aligner cuts each theme's own date range into slices. The editor has one period per column, and only when the generator adds a `Time Period` attribute.
- **The editor already shows chapters.** `StorySidebar` renders `node.content` per time column, which is where Stage 4 writes the chapters back.
- **The web's type check was hollow.** The project had no `@types/react`, so React props were silently `any`. With the typings added the existing code type-checks cleanly.
- **The editor cannot export graph JSON.** It imports `{nodes, sources}` or `{graph: {...}}` and exports only PNG and SVG. Stage 4 needs a JSON export, otherwise a graph cannot leave the editor.
- **Graph and story are two different shapes.** `graph.schema.json` describes what the editor holds (nodes on a grid) and `story.schema.json` what the writer produces (chapters). `python/ttng_align.py` now maps the graph to the alignment the writer takes. Writing the chapters back into `node.content` is Stage 4.
- **The editor's edge rule cannot bootstrap a graph without entities.** It links nodes only through shared entities, so a graph whose nodes have none has no edges. The aligner therefore needs declared `edges` for such a graph. Exporting them from the editor is part of the JSON export Stage 4 needs.
- **Old aligner quirk kept on purpose:** the sampled entities are put through `list(set(...))`, so their order depends on string hashing and changes between runs. Tests compare them sorted.

## Decision needed before Stage 2

Where does the engine run once the two halves are connected?

- **A local service around the Python engine.** The research pipeline stays the single implementation and the editor stays thin. The price is a second process to run.
- **A TypeScript port of the writer in the browser.** Nothing extra to run and the user brings their own key. The price is two copies of the prompts and logic to keep in step.

## Known loose ends

- Pydantic's `.dict()` and the community `ChatOpenAI` both raise deprecation warnings in the test run.
- The web bundle is about 3.2 MB in one chunk.
- `apps/web/vite.config.ts` inlines `GEMINI_API_KEY` into the client bundle. Do not deploy publicly until that is replaced.
