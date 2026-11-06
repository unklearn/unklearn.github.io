# Lesson 01 — From a Model to an AI Agent

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

## Formatting

Prettier formats TypeScript, React, CSS, HTML, Markdown, and MDX, including the
lessons’ executable code blocks.

```sh
npm run format        # Format the repository
npm run format:check  # Check formatting without changing files
```

Generated builds, saved traces, verification recordings, and the lockfile are
excluded in `.prettierignore`.

## Step 1: From a script to an AI workflow

Start patrol. After a random 2–4 seconds, a notice arrives. Read it, inspect the
pantry, and supply the item rule through three explicitly hypothetical examples.
Incorrect choices explain the mismatch and allow another attempt. The examples
configure a human-authored rule; they do not train a model or change real stock.
Apply the rule, pick up the actual item, and deliver it. Scout walks back and
resumes patrol. **Post another notice** repeats the scripted workflow without
intermediate buttons, preserving inventory depletion and making zero provider
calls.

**Add an AI model to this workflow** offers an inline Mock/Live choice. **Start AI
workflow** restores the starting stock and clears hands, basket, and conversation
after Scout returns to the board. Reading, inspection, and navigation stay
scripted. At the pantry, **Take item** makes one provider call with the exact
notice and observed stock, offering only pickup. The provider's actual choice is
executed, delivered, and recorded. Live choices are never corrected silently.

Step 1 shows no code. **Give Scout control** enters Step 2, where a fresh model
turn receives only a notice notification and the executable runtime begins.

Step 2 introduces Scout’s brain, then explains what a runtime does before showing
the invocation-only code. Scout patrols while the reader explores the prose.
**Run notice experiment** starts a random 2–4 second delay, posts the notice,
finishes the patrol at the board, and makes one provider call. The model receives
the notification without the notice text or tools. Mock says “I need to read the
noticeboard”; Live preserves its actual public response. A following mini-step
explains the real reading schema without offering or executing it yet. Step 2
has no prediction controls.

The arrows beside **STEP 2/8** navigate article steps. Footer **Previous/Next**
navigate the current step’s mini-pages, with a thin progress line along the top
of the footer. Step 2 replaces its introduction with runtime, experiment,
response, and schema pages. Revisiting a response never calls the provider again.

Step 1 uses the same footer navigation for its guided actions, three practice
examples, rule, delivery, provider choice, and AI comparison. Successful actions
unlock later pages; correct practice answers unlock the next example. Earlier
pages retain their observations and choices, with completed actions read-only.
The guided observations also survive the AI comparison’s explicit world reset.
Back/Next changes the displayed page without rewinding Scout or repeating work.
**Restart step** explicitly clears the take, saved page outcomes, and progress.

## Contribute a step

Open `article-sets/scout-foundations/articles/what-makes-scout-an-agent/`.
Each numbered `.mdx` is one step: its prose, React state, buttons, runtime code,
and configuration examples live together. `article.ts` imports the files and
sets their order. There is no step generator, prompt brief, or dispatch driver.

To add a step, copy an MDX file, give its exported `meta` a unique `id` and title,
and add its import to `article.ts`. Keep provider calls and job execution in
event handlers. A cancellable idle patrol can start when the step becomes active;
it must make no provider calls. The React component can advance through as many
local mini-steps as the lesson needs.

Use `const [page, setPage] = useMiniSteps(5)` to connect ordinary React state to
the footer. Render each page conditionally. Optional `canNext: page => …` waits
for real outcomes; Step 2 waits for a response before enabling its response page.
Only an explicit `Action` runs an experiment. A completed experiment may call
`setPage` to show its result. Browsing pages retains world state and results;
leaving the article step still cancels unfinished work. Steps without this hook
remain single pages, with disabled footer navigation. Header arrows and TOC
always navigate article steps.

A small authored interaction looks like this inside MDX:

```mdx
export function Walk() {
  const scout = useScoutStep();
  const [arrived, setArrived] = useState(false);
  return (
    <>
      <Action
        onClick={() =>
          scout.act(async () => {
            await scout.world.walkTo('pantry');
            setArrived(true);
          })
        }
      >
        Walk to the pantry
      </Action>
      {arrived && <p>Scout has arrived. This movement was scripted.</p>}
    </>
  );
}

<Walk />
```

Import `useState` from React, `useScoutStep` from the Foundations `authoring.ts`,
and UI helpers from `presentation/lesson-ui.tsx`, using the paths in existing
steps. Helpers are session-scoped, not globals.

### Predictions

Each MDX interaction owns its prediction in React state and passes `value` and
`onChange` to `Prediction`. Choices require `{ id, label, explanation }`.
After the experiment settles, pass the observed choice ID as `outcome`; use
`null` while pending, cancelled, or inconclusive.

The component shows the **observed choice’s explanation**, with a green
blockquote border for a matching prediction and red for a different prediction.
Without a prediction it shows neutral outcome feedback. Changing an answer only
updates React state; it never executes the experiment. See the later MDX steps for comparisons driven by actual execution events.
Step 1 instead uses button choices to configure its scripted rule.

### Executable code blocks

A fence beginning with **`ts runtime="invoke"`** contains a complete TypeScript
module exporting `AgentRuntime`. A **`ts setup="reader"`** fence contains executable
configuration, such as `export const tools = ['read_notice'];`. A
**`ts experiment="patrol"`** fence exports `run(session)` for an authored experiment;
its displayed script is also its executed implementation.

The build extracts each named block into a module and exposes it inside the MDX:

```mdx
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

The eight steps form one article: scripted/AI workflows → model control → tool request and dispatch →
held result → feedback and loop → dynamic capabilities → autonomous picnic →
model and harness review. Predictions are optional and never execute actions.
The first runtime has no dispatch, append, or loop methods. The final snapshot
resolves `getTools()` before each evaluation and retains that selection for
matching dispatch. Adding a tool changes configuration on the same instance.
Only the selected snapshot runs; the session host never fills in missing logic.
The build type-checks every stored TypeScript block before bundling it.

The first snapshot uses `model(messages)`, a connection to the instrumented
provider with no tools and the session’s cancellation signal already bound.
Later snapshots use `provider(messages, schemas, signal)` as capabilities grow.
Both go through the same provider activity and trace recording; neither
connection supplies dispatch, feedback, or looping behavior.

`runtime/session.ts` is generic infrastructure. The article manifest supplies
`scenario`, defined in Foundations `scenario.ts`: world creation, authoritative
tool bindings, initial conversation, typed helpers, and history-driven Mock.
Future article sets can supply another scenario without teaching the host new
tool names. `article.ts` also owns lesson number/title, ordering, final runtime,
and recording aliases. Existing article URL and stable step identities remain.

### Helpers

- `scout.world`: `postNotice`, `readNotice`, `walkTo`, `patrol`, `inspectPantry`, `takeOne`,
  `deliverItem`, `setPantry`, and `snapshot`. These use the real world rules.
- `scout.background(async signal => …)` scopes patrol/timer work to the active
  step without blocking learner actions. `scout.sleep(ms, signal)` is cancellable.
  Stop patrol at a circuit boundary before foreground movement. Navigation
  cancels background work; resumption requires an explicit learner action.
- `scout.callProvider(messages, schemas, mock?)` instruments a single request,
  sharing the same cancellation and activity events as runtime snapshots. It
  supplies no dispatch or loop. Foundations owns the workflow decision Mock.
- `scout.runtime(block)`: constructs that block’s runtime against the current
  messages, selected tools, cancellation signal, and instrumented provider.
- `scout.act(async () => …)`: busy state, cancellation, errors, and trace saving.
  Reset or restore before calling `act`; keep the work inside its callback.
- `scout.reset({ notice, pantry, tools })`, `resetContext`, and `setTools`.
  Reset the component’s local React state in the same Reset handler.
- `saveCheckpoint(name, data)` and `restoreCheckpoint(name)` preserve the world,
  conversation, selected tools, and held feedback. They do not evaluate a model.
- `remember(name, value)` / `recall(name)` retain actual comparison runs across steps.
- `showContext(value)`, `showQuestion(text)`, `clearQuestion()`, and `mark(stage)`.
- `useLessonPresentation().renderSystemTerminal(ReactNode)` queues authored UI
  behind the terminal's notification badge. The learner opens System terminal
  explicitly; provider calls, script results, and errors never open it.
  Show important outcomes inline in MDX; keep raw results in the terminal and
  complete trace in History. Public provider speech and actual results remain
  recorded separately.

Leaving a step cancels unfinished work. Visited components stay mounted, retaining
mini-step progress and settled state. A canceled action can be restarted using
its Run/Reset controls. Mode changes reset the lesson. Replay disables lesson
actions and only renders recordings; it never constructs a runtime.

## Picnic comparison

TOC → **07 Autonomous picnic**. Keep Mock and the default notice:

> Pack one item for the picnic. Prefer an apple, but leave at least one apple in the pantry. Otherwise take one carrot. Deliver it to the picnic basket.

1. Select **2 apples, 2 carrots** inline → **Run picnic**. It finishes autonomously.
   Basket: one apple. Pantry: one apple, two carrots.
2. Change only the inline starting apples to **1** → **Run picnic**.
   Basket: one carrot. Pantry: one apple, one carrot.
3. For the third check, Settings → use two apples and post
   **Deliver one carrot to the picnic basket.** Then Run picnic with two apples.
   Basket: one carrot. Pantry: two apples, one carrot.

Each Run starts a clean world and conversation. The comparison table uses saved
actual inventories. Step 8 replays and annotates your latest execution without
inference or tool execution. Taking the last apple is legal in the world.

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
three picnic outcomes, dynamic tool selection, cancellation, and Replay. `npm run build`
type-checks the MDX blocks and pre-renders the lesson without executing actions.
The plain TypeScript world remains usable from Node with an injectable clock.

`npm run record` regenerates the two bundled Mock traces using the final MDX
runtime. `npm run verify:live` runs all three orders against local Ollama using
that same snapshot and writes actual results to the ignored `verification/`
folder. It supports `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_THINK`, and
`OLLAMA_TIMEOUT_MS` from `.env` or the environment.

The guided workflow shows its latest completed result inline: exact notice text,
pickup, delivery, and inventories. These summaries come from real handler
results. Model public responses and execution errors are also shown in the
lesson; the terminal remains available for deeper inspection.
