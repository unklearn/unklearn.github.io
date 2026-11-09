import { rename, rm, writeFile } from 'node:fs/promises';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import { articleIds } from '../routes.ts';
import {
  guidanceEvidence,
  guidancePlacements,
  informStepId,
  picnicNotice,
  picnicPantry,
  runGuidanceTrial,
} from '../article-sets/last-apple/guidance.ts';
import type { GuidanceTrial } from '../article-sets/last-apple/guidance.ts';

const model = 'qwen3:14b';
const live = {
  endpoint: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  model,
  think: false,
};
const trials: GuidanceTrial[] = [];
for (let repeat = 0; repeat < 3; repeat++) {
  for (const placement of guidancePlacements) {
    let offset = 0;
    const host = createLessonHost({
      articleId: articleIds.lastApple,
      steps: [{ id: informStepId, title: 'Inform' }],
      settings: () => ({
        mode: 'live',
        order: picnicNotice,
        apples: picnicPantry.apple,
        live,
      }),
      clock: {
        now: () => Date.now() + offset,
        async sleep(ms, signal) {
          signal.throwIfAborted();
          offset += ms;
        },
      },
    });
    await runGuidanceTrial(host.current, placement);
    const trace = host.current.trace;
    const evidence = guidanceEvidence(trace);
    if (!evidence.proposal)
      throw new Error(
        `${placement.label}, trial ${repeat + 1}: ${host.current.error ?? trace.status}`,
      );
    trials.push({ placement: placement.id, trace });
    console.log(
      `${placement.label}, trial ${repeat + 1}:`,
      evidence.decision,
      `${evidence.elapsedMs} ms`,
    );
  }
}

const fixture = new URL('../traces/last-apple-guidance.json', import.meta.url);
const temporary = new URL(
  `../traces/.last-apple-guidance-${process.pid}.tmp`,
  import.meta.url,
);
try {
  await writeFile(temporary, `${JSON.stringify({ trials }, null, 2)}\n`);
  await rename(temporary, fixture);
} finally {
  await rm(temporary, { force: true });
}
