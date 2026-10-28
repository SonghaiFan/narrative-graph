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
| 3. Writer | A swappable LLM client, prompts moved to files, the deprecated community `ChatOpenAI` replaced | The wire test still sees `gpt-4`, temperature 0.5 and the parent chapter text | done (`refactor/stage-3-writer`) |
| 4. Connect | The editor's JSON file is the hand-over: Python reads it, writes the chapters into `node.content` and gives the file back for import. No service; the editor's export and import code is pulled out into tested functions and the file gets a schema | A file in the editor's export shape goes through `python -m ttng_story` and comes out as a valid file with text in every node | done (`refactor/stage-4-connect`); the text is made by a command, not by a button |
| 5. Retire | Delete `legacy/` and the flat scripts, decide the fate of `python/*/arc` data, choose a license and a name, stop inlining the Gemini key | Everything deleted is already covered by a new part | partly done (`refactor/stage-5-retire`): the Gemini key is no longer built into the bundle, the MIT license and the name (ttng, Time Track Narrative Graph) are chosen, and the `arc` run output is moved to a private repository. `legacy/` stays until its useful modules are lifted out, and the GitHub repository has since been renamed to `narrative-graph` |

## What the test net covers today

- **Aligner** (`tests/test_alignment.py`): for all nine structures and three seeds: every node aligned once, parents before children, `Prev` matches the edges, themes and time slices stay in range, each child shares an entity with its parents, same seed gives the same result.
- **Writer** (`tests/test_writer.py`): chapter order, theme and time period in every prompt, parent text carried forward (including a merge with two parents), `gpt-4` at temperature 0.5, the result validates as a `Story`.
- **End to end** (`tests/test_storytale_flow.py`): `generate_story_files` writes the alignment, story and log for every structure.
- **Wire** (`tests/test_openai_wire.py`, `tests/test_llm.py`): the real writer, `OpenAIClient` and openai SDK send one `POST /v1/chat/completions` with `model` `gpt-4`, temperature 0.5, the parent chapter's text and no stray fields.
- **Prompt** (`tests/test_prompts.py`): `prompts/chapter.md` renders to exactly the text the old f-string produced, with and without a parent chapter. The reference is `tests/golden/chapter_prompt.json`, captured from the old code before it was moved.
- **Packer** (`tests/test_story_packer.py`): `story_packer.py` bundles the stories and then moves every file into `arc/`.
- **Guards** (`tests/test_guards.py`): sockets and DNS are blocked, the writer must not go back to a LangChain model wrapper, and the prompt text must stay out of the code.
- **Edge rule** (`python/tests/test_edges.py`, `apps/web/tests/computeEdges.test.ts`): 23 hand-written and 30 random cases from `schema/fixtures/`. Both sides must produce the same edges in the same order, leave the input untouched, and give edges that fit the graph schema.
- **Graph aligner** (`python/tests/test_align_graph.py`): for all nine structures and three seeds, the graph of a structure aligns to exactly what `align_theme_entity` gives (same node order, same fields, same entities). Also: given entities are kept, a node that shares nothing with its parent gets one, parents come from declared edges or else the edge rule, time comes from the node or from slicing the topic's range, off-grid nodes are left out, bad graphs are refused with a reason, the writer accepts the result, and the command line works.
- **Schemas** (`python/tests/test_schema.py`, `apps/web/tests/schema.test.ts`): the schemas are valid, the good graphs, graph files and stories are accepted, 22 bad documents are refused, and what the pipeline writes matches `story.schema.json`.
- **Graph file** (`apps/web/tests/graphFile.test.ts`): `buildGraphFile` writes what the schema accepts, leaves edges out, keeps every node and its text, and does not change its input; `parseGraphFile` reads it back (the edges return by the rule), accepts a bare graph, and refuses what has no nodes.
- **Text back into the graph** (`python/tests/test_ttng_story.py`): a file in the editor's shape aligns, gets one chapter per node by position (not by the id in the model's reply), keeps its layout and metadata, stays a valid file, and the command line works with a period or with a context.

Each of these was checked by putting the bug back in a scratch copy: the old `theme=` argument, the old `langchain.llms.OpenAI` call, a silent drop to `gpt-3.5-turbo`, a writer that forgets the parent chapter, an aligner that stops linking children to parents, time slices running backwards, and a packer that stops moving files. Every one made tests fail.

Stage 1 was checked in two more ways. The original inline code in `GraphContext.tsx`, the extracted `computeEdges` and the Python rule agreed on 10,000 random graphs, down to the id and the order of every edge. And 14 planted deviations in the rule, 7 in each language, were each caught by the tests of the language they were planted in, while the other language's tests kept passing.

Stage 6, OpenRouter (`refactor/stage-6-openrouter`): the editor's AI generation no longer uses the Gemini SDK. `services/ai.ts` posts to OpenRouter's chat-completions endpoint with the user's key and a model id they choose, asks for a strict JSON schema (and tolerates models that wrap the JSON in a fence or a sentence), turns on the `web` plugin in Real News mode and reads the cited pages from `url_citation` annotations. The Python writer gets `OpenRouterClient`, `create_story(model_name=...)` and `ttng_story --provider/--model`. The OpenRouter client refuses to start without `OPENROUTER_API_KEY` instead of falling back to `OPENAI_API_KEY`, which would send the OpenAI key to a third party; a test pins that. The model ids offered were taken from OpenRouter's public model list. Tried in the editor with the network call stubbed: the dialog showed the key and model fields, Generate stayed disabled until both were filled, the request went to OpenRouter with the bearer key, the chosen model, the web plugin and a strict schema, and the reply (in a code fence) drew the graph and listed its source. **No real call was made to OpenRouter, so whether browser requests to it are accepted (CORS) and how real models answer are untested.** Seven deviations planted in `services/ai.ts` and six in the Python clients were each caught by tests; one test failure found that duplicate sources kept the last title, not the first, which is now fixed.

Stage 5 so far: `vite.config.ts` no longer defines `process.env.API_KEY` or `GEMINI_API_KEY`, `services/ai.ts` builds its client from a key passed in, and the AI dialog has a password field for it (kept in session storage, Generate is disabled without one). A build with a sentinel key held the key once before the change and not at all after; a unit test fails if the config defines anything from the environment. Tried in the editor with no key set: it loads (it used to crash at import), the dialog shows the field, and Generate stays disabled until a key is typed. The Gemini call itself was not run. This also fixes the crash at load that happened without a key.

The `arc` run output (93 alignment, 86 story and 97 log files) was copied to the private `Frankfsh/ttng-run-archive`, a fresh clone of it was compared with the originals by SHA-256 (276 files, no difference), and only then were the files deleted here. The tests never read them.

Stage 4 was also tried by hand in the editor (dev server, built-in browser): a graph was imported, the real JSON button produced a file in the schema's shape with no edges, `ttng_story` filled it using a stub model (no API call), and importing the result drew the graph and showed each chapter's text in the story sidebar. A file with no nodes, a file that is not JSON and `null` each gave "Invalid file" and left the graph alone. The dev server needs a `GEMINI_API_KEY` even to load (a dummy value will do), because `services/ai.ts` builds its client at import time; that is not a Stage 4 change.

Stage 4 was checked by planting six deviations in `ttng_story.py` and `ttng_align.py` (reversed chapters, matching by the model's id, editing the input in place, overwriting every node, a wrong time slice for the period, not unwrapping the file). Every one made tests fail. One behaviour changed in the editor: importing a valid JSON file that has no nodes now says "Invalid file" instead of doing nothing.

Stage 3 was checked by planting nine deviations in the writer, the client and the prompt file (temperature, default model, ignoring a handed-in client, not passing it on, the message role, a hard-coded temperature, a hard-coded model, a reworded prompt line, a dropped parent chapter). Every one made tests fail. The request body of the old and new paths was compared: the new one sends the same `model`, `temperature` and `messages`, and leaves out `n: 1` and `stream: false`, which are the API's defaults.

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
- **The editor does export graph JSON.** Its "JSON" button writes `narrative_graph.json`: `{graph: {nodes, sources}, layout, metadata}`, with the edges left out. Earlier versions of this file and of Stage 1's notes said it could not; that was wrong, and `schema/graph-file.schema.json` now describes the file.
- **Graph and story are two different shapes.** `graph.schema.json` describes what the editor holds (nodes on a grid) and `story.schema.json` what the writer produces (chapters). `python/ttng_align.py` now maps the graph to the alignment the writer takes. `python/ttng_story.py` writes the chapters back into `node.content` of the editor's file.
- **The editor's edge rule cannot bootstrap a graph without entities.** It links nodes only through shared entities, so a graph whose nodes have none has no edges. The editor's own export has no edges, so the aligner derives them; that works for graphs the editor makes, since their nodes carry entities. A graph without entities needs declared `edges`.
- **Old aligner quirk kept on purpose:** the sampled entities are put through `list(set(...))`, so their order depends on string hashing and changes between runs. Tests compare them sorted.

## Decision needed before Stage 2

Where does the engine run once the two halves are connected?

- **A local service around the Python engine.** The research pipeline stays the single implementation and the editor stays thin. The price is a second process to run.
- **A TypeScript port of the writer in the browser.** Nothing extra to run and the user brings their own key. The price is two copies of the prompts and logic to keep in step.

## Known loose ends

- Pydantic's `.dict()` and `Field(labels=...)` raise deprecation warnings in the test run.
- There is no "write story" button; the text comes from `python -m ttng_story`.
- `storytale.py` still calls `create_story` without a client, so it always uses `OpenAIClient`. Choosing another client from the command line is not built.
- The web bundle is about 3.2 MB in one chunk.
- `legacy/gpt_storyteller` cannot be deleted yet by rule 2: `gpt_cartographer.py`, `gpt_journalist.py`, `graph.py`, `motifs.py`, `storyteller.py`, `gpt_writer.py` and the graph samples have no replacement. Only its copies of the aligner, the writer and the packer are covered by `python/`.
