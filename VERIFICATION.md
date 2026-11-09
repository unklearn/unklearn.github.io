# Lesson 01 verification — 2026-11-05

The pending in-world terminal toggle was committed first as `9ee988c`.

## Executable teaching boundaries

`npm test`: 17 focused checks pass. `npm run build`: TypeScript, all 11 stored
MDX runtime/configuration/experiment blocks, Vite static bundling, and lesson
HTML pre-rendering pass. Vite reports its existing large Three.js bundle warning.

Checks cover exact stored/compiler source identity; invocation without dispatch
or feedback; schema approval without execution; a real held notice remaining
absent from provider input until matching request/result feedback is appended;
dynamic tool changes on the same runtime, with pending-turn dispatch retaining
its offered handlers; real transfers, physical failures, last-apple legality;
checkpoint restoration, cancellation, recording aliases, private-thinking
redaction, and pure Replay including exact sequence seeking.

All three final-runtime cases completed autonomously through real inspection,
pickup, and delivery:

| Order           | Initial apples / carrots | Basket | Remaining apples / carrots |
| --------------- | ------------------------ | ------ | -------------------------- |
| Default picnic  | 2 / 2                    | apple  | 1 / 2                      |
| Same default    | 1 / 2                    | carrot | 1 / 1                      |
| Explicit carrot | 2 / 2                    | carrot | 2 / 1                      |

The first two runs have identical initial provider messages. Stock enters model
history through the inspection result, before stock-informed selection.

## Browser

Served `dist/` from Vite preview at port 4334, without an application backend.
Temporarily suspended the existing Ollama server during static acceptance and
restored it afterward. Mock completed both apple-count presets without Continue.
Verified scripted patrol/posting, notice light, actual provider bubble, approval,
request/execute separation, held feedback, append, dynamic capabilities, and
actual inventories. Verified the final rebuilt runtime's autonomous delivery.

Reviewed the reader's actual completed run in Step 8. Recorded context contains
the pantry observation and matching assistant requests, beside the executable
append method. Annotation seeking is read-only and uses event sequence as well
as timestamp. Exported the browser's one-apple run, imported its JSON through
History, and played it to completion in Replay. Browser Status showed basket 1 carrot,
pantry 1 apple / 1 carrot, empty hands, and zero Replay execution. Node Replay
checks also compare final snapshots.

Verified MDX dev refresh at port 4333 by changing prose, observing its automatic
appearance, then restoring the source. No probe remains in the lesson. Slides
remain expanded, with TOC, explicit collapse, in-world terminal toggle, and
optional narration transcript. No pinned-scroll presentation or Lesson 02 was
added.

## Live

`npm run verify:live` exercised local Ollama `qwen3:14b` using the final evolving
MDX runtime. Actual outcomes matched all three rows above. Each used
`read_notice`, `walk_to`, `inspect_pantry`, `take_one`, and `deliver_item`.
Full actual traces were saved to ignored `verification/{two-apples,last-apple,
carrot-order}.json`. Live retains actual provider outcomes without Mock fallback.

## Reproduce

`npm ci` once, then `npm start`. TOC → **07 Autonomous picnic**, keep Mock and
the default order. Select **2 apples, 2 carrots**, Run picnic. Then select
**1 apple, 2 carrots**, Run picnic. Both finish without an intermediate action.
Use `npm run dev` for editing; `npm run build` for static hosting.

## Prediction feedback

Choices now require an ID, label, and explanation. Each MDX interaction owns its
selected answer and supplies its settled observed outcome. Feedback renders the
observed choice’s explanation with green/red blockquote borders for matching/
differing predictions, or neutral feedback when unanswered. No outcome means no
verdict. The picnic comparison derives its outcome from both saved completed
runs, including actual Live differences.

Browser-checked red and green feedback in the real patrol experiment, retained
selection across navigation, and zero provider calls/tools after changing
predictions. Two focused rendering checks cover correct/incorrect, pending,
unanswered, and unsupported outcomes. Formatting and static build pass.

## Step 1 workflow rewire

Step 1 now contains the guided human-rule workflow and the single-decision AI
workflow, with no displayed source or initial prediction. The common header is
STEP 1/8, with one title below. The first model-directed runtime starts in
Step 2, Giving Scout control, from a fresh conversation and posted notice.

Focused checks cover real scripted transfers without provider calls, unchanged
stock during hypothetical examples, the history-only workflow Mock receiving
actual notice/stock with only pickup available, cancellation of patrol/timers,
and retaining completed run status when stopping background patrol. Existing
three autonomous-agent picnic cases and pure Replay checks continue to pass.

Browser walkthrough verified repeating patrol, delayed notice, physical read,
board indicator clearing, pantry walk/inspection, wrong-answer retry and all
three practice examples, actual pickup/delivery and return, and automatic
scripted repeats with depleted stock and zero provider calls. The AI comparison
restored 2 apples / 2 carrots, empty hands/basket, and zero calls before Take item.
Inline Mock/Live changes preserved progress and made no request.

Local Ollama qwen3:14b was exercised separately for the new one-shot decision:
with 2 apples it chose an apple; with 1 apple it also chose an apple, taking the
last apple. Each used exactly one call. Both actual outcomes were preserved;
no replacement choice or Mock fallback occurred. Actual traces are in ignored
verification/workflow-{2,1}-apples.json. These one-shot workflow results are
separate from the full agent-loop Live runs above.

The final static browser take completed the single-decision Mock delivery while
Ollama was suspended: before the call, pantry 2 apples / 2 carrots, empty hands
and basket, zero calls; after Take item, one call and one pickup, one apple
delivered. Give Scout control opened Step 2 without inference. Returning retained
Step 1 progress and offered explicit Resume patrol. Bundled Replay completed
with the original final inventories and zero new provider/tool executions.
Ollama was restored afterward.

## Inline outcomes and manual terminal

Important results now stay in the lesson: the exact notice, inspected pantry,
actual pickup, delivery, and inventories. Step 1 keeps one current outcome
instead of opening a terminal or accumulating a log in the slide. Model public
responses, reading requests/results, and execution errors are also shown inline.
System terminal activity only updates its badge; opening is an explicit learner
action. Raw results and the ordered History trace remain available.

Browser-checked reading, inspection, pickup, and delivery with the terminal
closed. The inline pickup was “Scout took 1 apple”; delivery showed basket
1 apple / 0 carrots and pantry 1 apple / 2 carrots. Explicitly opening the
terminal exposed the original read, inspection, pickup, and delivery JSON.
Closing it retained the inline outcome. Existing 17 checks, static build, and
formatting pass; no agent decision or physical world rules changed.

## Simple lesson presentation

Restart step sits at the bottom-right of the content pane. Narration/transcript
controls and their metadata are removed from all eight steps. The typewriter
experiment was removed; prose, instructions, and actions appear immediately.
Browser-checked the static build and Restart placement. All 17 checks, the
static build, and formatting pass.

## Step 2: brain, runtime, and a missing reading tool

Step 2 now opens with authoritative idle patrol and explains the runtime before
the invocation-only source excerpt. Its explicit experiment posts a notice
after 2–4 seconds, finishes the patrol at the board, then makes one model call.
The next mini-step explains the real reading schema without enabling it. No
prediction interaction, tool dispatch, feedback cycle, or later curriculum was
added to Step 2.

Browser verification from the static build showed zero calls/tools during
patrol. After Run, Mock said “I need to read the noticeboard,” Scout stood at
the board with the question cloud, and Status showed one call, zero tools,
unread notice, no notice in context, and unknown stock. The schema and its
description wrapped within the content pane; System terminal remained closed.
The browser logged no errors or warnings.

All 18 focused checks, formatting, and the static build pass. The new check
executes the stored notice experiment, confirms no notice text or schemas enter
the call, preserves the board light, and prevents a late call after navigation.
Existing checks still verify early runtime boundaries, cancellation, all three
autonomous picnic outcomes, source identity, and pure Replay.

## Mini-step navigation

Article-step arrows now sit beside STEP n/8. Footer Previous/Next changes the
current MDX mini-page, using `useMiniSteps` presentation state. Step 2 has five
pages and shows its actual response in place of its introduction. No visible
mini-step numbers compete with the article-step count: a 2px footer-edge line
shows progress and respects reduced motion.

Browser checks confirmed zero calls while browsing to the experiment, disabled
Next until a real response exists, backward/forward review without rerunning,
and retained response/page after a header-arrow visit to Step 3 and back. Status
still showed one call and zero tools. The progress line grew from 20% to 100%
and the footer contained only Previous/Next text. The static build and existing
18 focused checks pass. The footer portal mounts after static-HTML hydration;
a fresh browser run logged no errors or warnings.

## Step 1 mini-pages and retained outcomes

Step 1 uses the shared footer navigation for twelve pages. Only the current
page’s prose, instruction, and outcome render. Completed actions become
read-only; practice answers and real observations remain available for review.
Guided, repeated scripted, and AI outcomes are stored separately, so starting
the AI comparison does not overwrite the guided observations. Restart explicitly
clears page progress and results alongside the world.

Browser-checked the complete guided workflow, wrong-answer retry, retained
correct answers, and both backward/forward review. After pickup, reviewing the
inspection kept Scout carrying the apple with pantry 1 apple / 2 carrots and
zero provider calls. The old page showed its recorded 2 apples / 2 carrots and
no Take action. Delivery could not be repeated from its earlier page.

An explicitly posted scripted repeat delivered a carrot with pantry 1 apple /
1 carrot and basket 1 apple / 1 carrot, without overwriting the guided pickup.
The AI comparison restored the original stock and empty basket with zero calls
before Take item. It completed with one provider call, one pickup, an apple in
the basket, and pantry 1 apple / 2 carrots. Reviewing its observation and result
kept those counts unchanged and exposed no duplicate Take action. System terminal
stayed closed and the browser logged no errors or warnings.

The existing 18 focused checks, formatting, and static build pass. No shared
runtime, provider, tool handler, world rule, or later step was changed.

## The Last Apple lab

`npm run build` emitted both `dist/index.html` and
`dist/labs/last-apple/index.html` with relative assets. Served that directory
with Python's static HTTP server and verified direct lab load, refresh, and
the link back to Scout Foundations. The lab and Foundations logged no errors
or warnings in the browser. At 390px wide, the timeline stacked without
horizontal overflow. Keyboard activation advanced the recording, ran an
experiment, and opened Under the Hood.

The recorded tool result stayed unchanged: one apple entered Scout's hands,
zero apples remained in the pantry, and the subsequent report claimed
delivery as instructed. Replay returned to the original inventory. In the
simulation, guidance allowed the transfer, post-action evaluation detected
the violation after the transfer, the dispatcher guard skipped the operation,
and domain enforcement called the operation and refused the write. Carrot
continuation succeeded, the no-carrot case was blocked, and two apples
allowed a guarded apple withdrawal. Reset and input changes clear the
simulation result independently of the recording.

All 25 checks, formatting, and the static build pass. The added tests cover
the recorded evidence, immutable replay snapshots, and deterministic
simulation outcomes. No Foundations runtime or recording was modified.
