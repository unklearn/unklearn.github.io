# Lesson 01 verification — 2026-11-05

The pending in-world terminal toggle was committed first as `9ee988c`.

## Executable teaching boundaries

`npm test`: 11 focused checks pass. `npm run build`: TypeScript, all 12 stored
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
