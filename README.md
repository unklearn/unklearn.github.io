# Scout Foundations · Unklearn

A static, interactive article about building an agent runtime. The browser owns
Scout’s world, provider calls, tools, and conversation. Mock and Replay need no
backend, model, or key.

## Run

Node 22.12+ and `npm ci`, then:

```sh
npm start
```

Open http://127.0.0.1:4333/. This builds and serves `dist/`.
Use `npm run dev` when editing: MDX changes refresh the browser and reset the take.
`npm run build` produces the independently hostable static site with relative URLs
and pre-rendered lesson HTML. Serve it over HTTP; `file://` is unsupported.

## Contribute a step

Open `article-sets/scout-foundations/articles/what-makes-scout-an-agent/`.
Each numbered `.mdx` is one step: its prose, React state, buttons, runtime code,
and configuration examples live together. `article.ts` imports the files and
sets their order. There is no step generator, prompt brief, or dispatch driver.

To add a step, copy an MDX file, give its exported `meta` a unique `id` and title,
and add its import to `article.ts`. Keep interactions in event handlers, never in
render functions or mount effects. The React component can advance through as
many local mini-steps as the lesson needs.

A small authored interaction looks like this inside MDX:

```jsx
export function Walk() {
  const scout = useScoutStep();
  const [arrived, setArrived] = useState(false);
  return <>
    <Action onClick={() => scout.act(async () => {
      await scout.world.walkTo('pantry');
      setArrived(true);
    })}>Walk to the pantry</Action>
    {arrived && <p>Scout has arrived. This movement was scripted.</p>}
  </>;
}

<Walk />
```

Import `useState` from React and `Action`, `useScoutStep`, `RuntimeChange`, and
`useLessonPresentation` from `presentation/lesson-ui.tsx` using the relative path
shown in the existing lessons. Helpers are session-scoped, not globals.

### Executable code blocks

A fence beginning with **`ts runtime="invoke"`** contains a complete TypeScript
module exporting `AgentRuntime`. A **`ts setup="reader"`** fence contains executable
configuration, such as `export const tools = ['read_notice'];`.

The build extracts each named block into a module and exposes it inside the MDX:

```jsx
const runtime = scout.runtime(blocks.invoke);
await runtime.evaluate();
scout.setTools(blocks.reader.module.tools);

<RuntimeChange from={previous.invoke} to={blocks.offer} />
```

`blocks.invoke.source` is the exact stored text compiled for execution.
`RuntimeChange` compares those texts, showing additions/removals with context and
an expandable full snapshot. Write the explanation next to it. Blocks do not
render automatically. Complete snapshots are authoritative; diffs are visual
only. Import `blocks` from an earlier MDX file to reuse a runtime or compare it.

The five steps add invocation → schemas → dispatch → feedback → looping.
The first runtime has no dispatch, append, or loop methods. Adding another tool
changes configuration rather than runtime code. Only the selected snapshot runs.
The build type-checks every stored TypeScript block before bundling it.

### Helpers

- `scout.world`: `postNotice`, `walkTo`, `patrol`, `inspectPantry`, `takeOne`,
  `deliverItem`, `setPantry`, and `snapshot`. These use the real world rules.
- `scout.runtime(block)`: constructs that block’s runtime against the current
  messages, selected tools, cancellation signal, and instrumented provider.
- `scout.act(async () => …)`: busy state, cancellation, errors, and trace saving.
  Reset or restore before calling `act`; keep the work inside its callback.
- `scout.reset({ notice, pantry, tools })`, `resetContext`, and `setTools`.
  Reset the component’s local React state in the same Reset handler.
- `saveCheckpoint(name, data)` and `restoreCheckpoint(name)` preserve the world,
  conversation, selected tools, and held feedback. They do not evaluate a model.
- `showContext(value)`, `showQuestion(text)`, `clearQuestion()`, and `mark(stage)`.
- `useLessonPresentation().renderSystemTerminal(ReactNode)` displays authored UI.
  Public provider speech and actual tool results are recorded separately.

Leaving a step cancels unfinished work. Visited components stay mounted, retaining
mini-step progress and settled state. A canceled action can be restarted using
its Run/Reset controls. Mode changes reset the lesson. Replay disables lesson
actions and only renders recordings; it never constructs a runtime.

## Picnic comparison

TOC → **Complete the picnic**. Keep Mock and the default notice:

> Pack one item for the picnic. Prefer an apple, but leave at least one apple in the pantry. Otherwise take one carrot. Deliver it to the picnic basket.

1. Settings → **2 apples · 2 carrots** → close. Run picnic → Continue after inspection.
   Basket: one apple. Pantry: one apple, two carrots.
2. Change only the starting apples to **1**. Run picnic → Continue.
   Basket: one carrot. Pantry: one apple, one carrot.
3. Use two apples, post **Deliver one carrot to the picnic basket.**, then Run picnic.
   Basket: one carrot. Pantry: two apples, one carrot.

Each Run starts a clean take. After inspection, Empty apple shelf then Continue
shows stale observations: pickup fails, the failure enters context, and Mock
inspects again. Taking the last apple is legal in the world.

Settings, Status, and History are behind icons. History exports/imports JSON;
Replay plays saved or bundled traces. Thinking bubbles mark actual provider calls.
Question clouds mark unavailable capabilities, never private model reasoning.

## Live

Settings → Live → configure Ollama URL/model or a provider gateway.
[Ollama browser origins](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama)
must allow the static site’s origin. The gateway may hold API keys, but owns no
world and executes no tools. Errors stay visible; Live never falls back to Mock.
Mock supports the default order and explicit carrot order; other orders explain
that limitation. Live retains the model’s actual decisions.

## Verification

`npm test` checks world rules, the extracted MDX runtimes, feedback boundaries,
three picnic outcomes, stale stock, cancellation, and Replay. `npm run build`
type-checks the MDX blocks and pre-renders the lesson without executing actions.
The plain TypeScript world remains usable from Node with an injectable clock.

`npm run record` regenerates the two bundled Mock traces using the final MDX
runtime. `npm run verify:live` runs all three orders against local Ollama using
that same snapshot and writes actual results to the ignored `verification/`
folder. It supports `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_THINK`, and
`OLLAMA_TIMEOUT_MS` from `.env` or the environment.
