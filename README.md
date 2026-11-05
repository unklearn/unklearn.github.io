# Scout’s picnic · Unklearn

A small isometric world for teaching an agent loop. Scout reads a notice, walks to the pantry, inspects its stock, picks up a snack, and delivers it to the picnic basket. The **browser runs the loop, tools, and authoritative world**. Three.js draws what happens.

## Open the world

Node 22.12+ is needed only for local development/building. In this folder:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:4333/**. It starts in **Mock**. You need no Ollama, backend, account, API key, or environment file.

For editing with live reload: `npm run dev`.

## The teaching moment

Leave the default notice unchanged:

> Pack one item for the picnic. Prefer an apple, but leave at least one apple in the pantry. Otherwise take one carrot. Deliver it to the picnic basket.

1. Select **2 apples · 2 carrots** and click **Post order**. Scout delivers an apple; the pantry has one apple and two carrots left.
2. Select **1 apple · 2 carrots**, change nothing else, and post again. Scout delivers a carrot; the pantry has one apple and one carrot left.
3. Select the first preset and replace the notice with **Deliver one carrot to the picnic basket.** Post again: Scout delivers a carrot despite the two apples.

Every post resets Scout, the basket, conversation, and stock. Film view hides the article and controls; Escape brings them back. The notebook below the world shows the ordered trace. **Save trace** opens the complete JSON, including initial/final inventories, with a download link and a copyable fallback. The six most recent runs are also saved in this browser and appear in Replay’s saved-take selector.

## Three modes

**Mock** is a deterministic teaching provider, not a language model. It receives the same messages and tool definitions as a live provider. It reads the notice through `read_notice`, learns counts through `inspect_pantry`, and chooses its next tool from successful observations. It has no world reference, stock preset, or turn-indexed action list. It understands the two notice formats above; other orders produce an explanation. Pickup and delivery are real runtime operations.

**Replay** plays bundled or imported traces. Choose a saved take, then play/pause or restart. No provider, agent loop, or tools run. Recorded snapshots and movements drive the scene, and the radio is labeled as recorded activity. Alongside the two Mock examples is an actual browser/Ollama recording: **Ollama · took the last apple**. Import a saved trace with **Open trace**; imported traces are data, never executable code.

**Live** swaps only the provider. Select local Ollama, enter its URL and an installed tool-capable model (defaults: `http://127.0.0.1:11434`, `qwen3:14b`), and post. Scout uses exactly the same browser world and tools as Mock. The model may choose badly or stop early: the basket and trace show the actual result. A failed connection stays an error; there is no silent fallback to Mock.

Ollama must allow requests from the article’s origin. Local `127.0.0.1` origins work by default; for another origin, consult [Ollama’s browser-origin instructions](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama) and configure `OLLAMA_ORIGINS` for that specific site. An HTTPS article may need an HTTPS provider gateway rather than direct access to a local HTTP service, depending on browser restrictions.

For another model provider, select **Provider gateway** and give its complete chat endpoint. The gateway receives `{model, messages, tools, stream: false}` and returns `{message: {role: 'assistant', content, tool_calls?}}`, using the same tool-call shape as Ollama. It can translate a hosted API and keep its key on the server. No hosted keys are included in this static build. A gateway is optional and is not needed for Mock or Replay.

## Publish as a static article

```sh
npm run build
```

Host the contents of `dist/` on any static host, including a subdirectory. All geometry, styles, code, and bundled traces are local build assets; there are no CDNs or remote fonts. The static host only serves files. Mock and Replay do not make provider or backend requests.

To check that exact build locally, run `npm run preview`. Stop Ollama and any gateway, then reproduce the two default-order takes above. Static hosting is required; opening `index.html` through `file://` is not supported.

## Build the runtime incrementally

| Location | What to explore |
| --- | --- |
| `runtime/types.ts` | Messages, events, snapshots, named places/paths, and a small injectable clock. |
| `runtime/world.ts` | Authoritative state and five tools. No graphics, DOM, or server dependencies. |
| `runtime/loop.ts` | Notice notification → provider → tool dispatch → observation → next turn. |
| `runtime/providers.ts` | Deterministic Mock and fetch-based Ollama/gateway providers. |
| `runtime/replay.ts` | A playhead over saved events; no world or provider to execute. |
| `scene/` | Village/Scout geometry, event-driven animation, article UI, and application wiring. |
| `traces/` | Example Mock recordings generated through the real runtime. |

The tools are `read_notice()`, `walk_to({place})`, `inspect_pantry()`, `take_one({item})`, and `deliver_item()`. Places are `noticeboard`, `pantry`, and `picnic_basket`. Walking resolves after arrival. The world checks proximity, available stock, and whether Scout holds an item. **Taking the last apple is legal.** The preference belongs in the notice and its provider interpretation, never in the world rules.

Provider input starts with only a generic courier prompt and “a new notice exists.” Reading returns the exact posted text. Only inspection returns pantry counts. Scene snapshots and trace metadata are kept separate from provider messages. Radio activity surrounds actual provider calls; Mock’s short pacing delay makes its decisions visible. Private provider thinking stays in internal conversation history and is excluded from exported traces.

## Small checks

```sh
npm test
```

Three focused checks use the same TypeScript runtime as the browser: all three teaching takes and information flow; physical transfers including the last apple; and replay without tool/provider execution. The injected clock skips animation waits in Node.

To regenerate bundled traces: `npm run record`.

To exercise actual Ollama through the same runtime without waiting for animations:

```sh
npm run verify:live
```

This runs all three orders sequentially, prints actual actions/inventories, and saves JSON traces in `verification/`. It reads the existing `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_THINK`, and `OLLAMA_TIMEOUT_MS` settings from `.env` when present. A nonzero exit means a run did not match the expected teaching result; it does not replace the model’s choice.

During verification with `qwen3:14b`, thinking disabled and temperature zero, the two-apple and carrot-only cases matched expectations. **The one-apple case did not:** the model inspected the stock, took the last apple, and delivered it. The browser Live run reproduced that mistake; its unmodified trace is bundled for Replay. This is model behavior, not a world-rule failure. Mock demonstrates the intended policy deterministically; Live is an experiment.
