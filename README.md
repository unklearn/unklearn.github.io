# Scout Foundations · Unklearn

An interactive article about an agent runtime. The browser owns the loop, message
history, selected tools, and authoritative picnic world. Three.js renders events.
Mock and Replay work on a static host without Ollama, a backend, or a key.

## Open it

Node 22.12+ is needed for building. After `npm ci`:

```sh
npm start
```

Open **http://127.0.0.1:4333/**. This builds and serves the static files. For editing,
use `npm run dev`. `npm run build` produces an independently hostable `dist/` with
relative asset paths, local geometry, lesson content, and example recordings.
Every registered article’s slides and code excerpts are rendered into the HTML
at build time, so crawlers can read them without a separate Article mode or JavaScript.
Serve that folder over HTTP; `file://` is not supported.

## Follow the lesson

Slides start expanded. **Start lesson** starts Scout’s patrol; **Post a notice**
posts the notice directly. Patrol and posting use no model calls or tools. Next
adds the reading tool, execution, feedback, and finally the picnic.

Step 2’s **Approve** changes the authored teaching stage; it does not execute the
read or install a runtime permission system. Step 3 executes `read_notice` and
holds the result. Step 4 appends the assistant request and matching observation,
then evaluates again with the actual notice in context.

Slides collapse through the top-bar book button. Scrolling reads the current slide;
Previous, Next and TOC change steps. Navigation, scrolling and
panels never initiate inference. Changing steps cancels unfinished
execution and retains settled snapshots; **Run** starts a fresh experiment.

Settings, Status and History are the top-right icons. Short public replies can open the terminal; long observations and experiment
context wait behind the activity notification badge. It shows public responses, requests, observations, and
activity during actual provider calls. Mock dialogue is authored, not model
reasoning. Live shows public output/action summaries, never private thinking.
The amber board light stays on until a successful read.

## Reproduce the picnic comparison

Select **5. Complete the picnic** in TOC. Keep **Mock** and the default notice:

> Pack one item for the picnic. Prefer an apple, but leave at least one apple in the pantry. Otherwise take one carrot. Deliver it to the picnic basket.

1. Settings → **2 apples · 2 carrots** → close. **Run picnic**, then **Continue**
   after inspection. Basket: one apple. Pantry: one apple, two carrots.
2. Settings → change only the preset to **1 apple · 2 carrots** → close.
   **Run picnic**, then **Continue**. Basket: one carrot. Pantry: one apple, one carrot.

Each Run resets the world, basket, conversation and trace. To run without the
inspection pause, uncheck that option in Settings. Posting prepares a fresh notice
without inference; Run explicitly starts the experiment.

For the third case, use two apples and change the notice to **Deliver one carrot
to the picnic basket.** Post, Run, Continue. One carrot is delivered.

For stale observations, use two apples, Run, then **Empty apple shelf** at the
inspection pause and Continue. The cached observation still says two apples.
Pickup returns `out_of_stock`; Mock receives the failure, reinspects, and takes a
carrot. The world has no “leave the last apple” rule. It enforces only proximity,
stock, and possession.

## Execution modes and recordings

- **Mock** runs the real harness and tools with a deterministic provider. Its only
  inputs are messages and active schemas. It learns the exact notice through
  reading and stock through inspection. It supports the two orders above and
  explains unsupported orders.
- **Replay** renders recorded snapshots and movements. It has no provider or tool
  executor. Select a bundled/local recording in Settings; use Play/Pause and
  Restart. History → Export JSON offers a download and copyable JSON. Import JSON
  loads that recording in Replay. The last twelve completed experiments are saved
  locally when browser storage is available.
- **Live** replaces only the provider. Set the Ollama URL and a tool-capable model
  in Settings, then explicitly Run. Errors remain visible; there is no fallback.
  Private provider thinking is preserved only in internal provider conversation,
  excluded from exported traces and the terminal.

Configure Ollama to allow your article’s browser origin using its
[official browser-origin instructions](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama).
The adapter preserves `stream: false`, `think: false`, temperature 0 and a 4096-token
context. Browser HTTPS/local-network restrictions may require an HTTPS gateway.

An optional gateway endpoint accepts `{model, messages, tools, stream: false}` and
returns `{message: {role: 'assistant', content, tool_calls?}}` in Ollama’s shape.
It may translate another provider’s responses and hold its API key. It never owns
the world or executes tools. No key is embedded in the static build.

Film view hides the lesson and controls. Escape restores them.

## Edit the lesson and runtime

| Folder | Ownership |
| --- | --- |
| `runtime/` | Plain TypeScript harness, provider transport, messages, feedback, stopping, tracing types and Replay. No Scout or pantry imports. |
| `article-sets/scout-foundations/` | World, five tools, checkpoints, history-driven Mock, picnic experiments, village geometry and lesson. |
| `presentation/` | Shared lesson controller, slide player, Markdown/excerpt rendering, terminal and panels. |
| `scene/` | Browser application wiring, camera/rendering and styles. |
| `traces/` | Bundled recordings; including an actual earlier Live mistake. |

Articles have their own folders. The world and its capabilities are shared:

```text
runtime/
presentation/
article-sets/
  registry.ts
  scout-foundations/
    world.ts, tools.ts, mock.ts
    driver.ts, context.ts, capabilities.ts, catalogue.md
    scene/
    articles/
      what-makes-scout-an-agent/
        article.ts
        brief.md
        steps.ts
        01-meet.md ... 07-picnic.md
```

Edit these ordinary source files directly:

| File | Role |
| --- | --- |
| `brief.md` | Natural-language guidance for yourself or an AI helping author the article. It is not displayed or sent to Scout. |
| `steps.ts` | Step IDs, order, stages, tool availability, learner actions, context views, labels and optional narration. |
| Numbered Markdown files | The prose and executable-excerpt references displayed in slides. |
| `article.ts` | Article ID/title, content directory, step factory, available actions, source files and Replay defaults. |
| `article-sets/registry.ts` | The shared list of articles used by the browser and static build. |

An AI assistant can author or revise these files from the brief and the shared
`scout-foundations/catalogue.md`. **There is no automatic brief-to-code generator.**
Saving a brief does not regenerate `steps.ts`; direct edits are not overwritten.
There is no runtime lesson compiler.

For editing, run:

```sh
npm run dev
```

Stop a running `npm start` first; both commands request port 4333. Open the URL
printed by Vite. Saving `steps.ts` or numbered Markdown updates the browser automatically. Reloads
start a fresh take. Brief edits change authoring guidance only. **`npm start`
builds once and serves `dist/`; it does not watch source edits.**

To add another article within Scout Foundations:

1. Create `articles/<unique-article-id>/` with a brief, `steps.ts`, numbered
   Markdown, and an `article.ts` manifest. Reuse the shared world and tools.
2. Import the manifest in `article-sets/registry.ts` and add it to `articleRegistry`.
3. Open `/?article=<unique-article-id>`. When multiple articles are registered,
   an article selector appears above the step selector. No backend routes are needed.
   Keep `legacyStepIds` on the original article only; new articles use stable IDs.

Steps carry their own context-view names and optional action labels. Moving the
picnic step no longer changes its label or explanation. New traces record stable
article/step IDs; old numbered recordings retain their original ID mapping.
The focused registry check loads two independent articles and verifies reordered
steps still run the right experiment and Replay checkpoint.

Both schemas and dispatchable handlers come from the same active-tool selection.
The shared harness has explicit `evaluate`, `execute` and `append` operations so a
lesson can pause between execution and feedback. Marked `@excerpt` regions in that
executable implementation are extracted by Vite. Markdown references them with
`{{source:feedback}}`; `// +` highlights an added line. Missing regions fail the
build. There are no separate tutorial code copies or full-source inspector.

## Focused checks

```sh
npm test
npm run build
```

Seven small checks cover observed-stock decisions, physical transfers including the
last apple, pure Replay, selected-tool gating, held feedback versus model context,
identical repetition, stale-stock failure, patrol/approval boundaries, and article
loading with stable step identities. Node
uses the same TypeScript with an injectable clock; no DOM or Three.js is required.

Regenerate the bundled examples with `npm run record`. Exercise actual Ollama
without animation delays using:

```sh
npm run verify:live
```

This reads existing `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_THINK` and
`OLLAMA_TIMEOUT_MS` from `.env`, runs the three picnic cases, prints actual actions,
and saves traces in `verification/`. A mismatched delivery exits nonzero and
preserves the model’s choice. See `VERIFICATION.md` for the latest observed runs.

The five-step lesson uses **TOC** to jump between steps and the top-bar book to
show or hide the slides. Lesson posting is immediate; Settings remains available
for manual orders. Provider calls animate Scout’s thinking bubble. A question
cloud marks a missing capability, without displaying private reasoning. Activity
and experiment data live behind a badged toolbar button; long results stay folded.
Retired model-turn and repetition recordings still replay through their stable aliases.
