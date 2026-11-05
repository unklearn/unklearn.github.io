# Scout Foundations verification — 5 November 2026

The static `dist/` was served at `http://127.0.0.1:4333/` using Vite preview.
There is no application backend. Ollama’s original restart processes were
briefly paused and its service stopped for the offline acceptance walkthrough;
`/api/tags` returned `ECONNREFUSED`. Mock and exported-trace Replay completed in
that state. The original processes were resumed afterward; `/api/tags` returned
200 before the separate Live checks.

## Browser lesson

- Initial Slides are expanded; Start lesson is visible. Collapse happens only
  through its button. The former Article presentation has been removed.
- Patrol and posting: zero provider calls, zero tool requests. The board lights
  on posting and Scout passes without reading.
- One model turn: tools empty, order absent; Mock says it needs a way to read.
- Repetition: three provider calls, byte-identical message inputs, zero tools.
- Approve: active reading tool appears, zero calls and zero handler executions.
- Execute: one real `read_notice` result contains the exact notice; no feedback
  append occurs. The board’s light clears.
- Feedback: the matching assistant request and tool result are appended. The
  next recorded provider input contains the notice. Mock responds to that order.
- A direct entry to step 6 first uses the real reading handler before Append.
- Before Article mode was removed, switching presentations during a Mock picnic preserved the experiment:
  it finishes `reported`, seven provider calls, one carrot delivered, no duplicate
  transfer. Scrolling/selecting steps starts no evaluations.
- Eight displayed snippet instances were compared with their marked executable
  regions, ignoring formatting whitespace; all match. The feedback addition is
  highlighted. There is no inspector/full-source panel.

Browser-exported evidence is in ignored `verification/lesson-*.json`, including
patrol, repetition, approval, held result, feedback and presentation switching.

## Offline browser Mock outcomes

| Notice | Starting pantry | Basket | Remaining pantry |
| --- | --- | --- | --- |
| Default | 2 apples, 2 carrots | 1 apple | 1 apple, 2 carrots |
| Identical default | 1 apple, 2 carrots | 1 carrot | 1 apple, 1 carrot |
| Deliver one carrot to the picnic basket. | 2 apples, 2 carrots | 1 carrot | 2 apples, 1 carrot |

The first two runs changed only starting apple count. Their traces contain
`inspect_pantry` before `take_one`, and successful real pickup/delivery events.

At the inspection pause, emptying the apple shelf leaves the model’s observation
at two apples while the actual shelf has zero. Continue produces a failed
`take_one(apple)` with `out_of_stock`, another inspection, then a carrot delivery.
The remaining pantry is zero apples and one carrot. This is recorded in
`verification/lesson-stale-stock.json`.

## Replay and presentation

The exported carrot-order browser trace was imported through History and played
to its end with Ollama still stopped. Replay final state matched: basket one
carrot, pantry two apples and one carrot. The replay module accepts only a trace
and event sink, and has no provider or executor. Recorded activity is labeled.

Responsive checks at 320, 768, 1024 and 1440 pixels found no horizontal overflow.
Browser console reported no errors or warnings. Screenshots include
`verification/lesson-article.jpg`, showing the executable feedback lines and exact
notice beside the village. Settings, Status and History are icon panels.

## Actual Live Ollama

`npm run verify:live` exercised the same browser-safe harness and real world tools
through the fetch adapter with `qwen3:14b`, thinking disabled, temperature zero.
All three runs in this pass matched:

| Run | Basket | Remaining pantry |
| --- | --- | --- |
| Two apples | 1 apple | 1 apple, 2 carrots |
| One apple | 1 carrot | 1 apple, 1 carrot |
| Explicit carrot order | 1 carrot | 2 apples, 1 carrot |

The command exited zero and saved actual traces in `verification/two-apples.json`,
`verification/last-apple.json` and `verification/carrot-order.json`. The browser Live connection also completed the one-apple case: one carrot
delivered, one apple and one carrot remaining; its actual trace is
`verification/lesson-browser-live-one-apple.json`. Live outcomes are observations,
not guarantees. The older `traces/ollama-last-apple.json` remains
an unmodified recording of a prior mistake, labeled as such in Replay.

## Focused checks

`npm test`: six checks pass using the same plain TypeScript as the browser.
They cover selected-tool gating; the held-result/context boundary; identical
repetition; observed-stock choice; real transfers allowing the last apple;
stale pickup failure and reinspection; patrol/approval; and Replay isolation.

Removing the observation append was also checked as a temporary mutation; the
focused checks failed as expected, and the original executable source was restored.

`npm run build`: TypeScript and Vite static build pass. Vite reports its normal
large-chunk advisory for the bundled Three.js engine and local recordings; no
backend, external fonts or CDN assets are required.

## Slide-only presentation update

Removed the floating terminal icon and computer object; provider activity opens
the terminal popup. The
notice label uses the camera-projected axes of the board rather than a flat
screen angle. Article controls and scroll-based step selection are removed. All
seven slides and the same executable excerpts are emitted into `dist/index.html`
for crawlers and readers without JavaScript; there is no duplicate crawler page.

Browser checks for this update confirmed automatic terminal display on a real Mock
turn, no Article switch or terminal icon, and seven hydrated slide sections.
Scrolling step 6 kept it selected with zero provider calls and zero tool executions.
No browser console errors/warnings were reported. The notice label and clear
courtyard are shown in `verification/scout-slides-only.jpg`.


## Article authoring structure update

Moved this article’s brief, steps and Markdown into
`article-sets/scout-foundations/articles/what-makes-scout-an-agent/`. World tools,
experiments, Mock and geometry remain shared at the set level. The browser and
static build load article manifests from `article-sets/registry.ts`.

- Seven focused checks pass, including two independent article fixtures,
  distinct DOM heading IDs, reordered context/action labels, a real reordered
  picnic run, and stable Replay IDs for both new and legacy traces.
- In Vite dev mode on a temporary port, changing a `steps.ts` title appeared in
  the browser without manual refresh. Changing Markdown prose did too. Both
  temporary edits were restored.
- A temporary second registry entry appeared in the article selector and opened
  through its query URL. Switching made zero provider calls and executed zero
  tools. That test entry was removed; only the real article is shipped.
- `npm start` retains its build-and-preview behavior; `npm run dev` is the live
  authoring command. Briefs remain guidance, with no automatic generation.

### Compact lesson and embodied activity (November 5)

- The article now has five steps. Standalone model-turn and repetition slides are
  retired; old recordings resolve those IDs to the reading-tool step.
- Browser-checked direct posting during patrol without opening Settings, compact
  TOC navigation, and the persistent top-bar book collapse/expand control.
- Observed a thinking bubble during a real Mock provider request, followed by a
  question cloud when the reading capability is absent. Approval clears the cloud
  and displays a short context popup without executing the reading handler.
- Executed `read_notice` in the browser: the amber light clears, JSON stays behind
  the unread badge, and the held notice is inspectable in the Context tab.
- `npm test`: seven focused checks pass, now using the actual authored steps for
  the patrol/approval boundary. `npm run build` passes.
