import assert from 'node:assert/strict';
import test from 'node:test';
import { loadArticle } from '../authoring/load-article.ts';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import {
  continueVerification,
  evaluateOutcome,
  pantryRefusalCheckpoint,
  pickupEvidence,
  reserveRefusal,
  runEnforcement,
} from '../article-sets/last-apple/experiment.ts';
import type { Strategy } from '../article-sets/last-apple/experiment.ts';
import {
  classifyProposal,
  guidanceEvidence,
  guidancePlacements,
  picnicNotice,
  picnicPantry,
  reserveRule,
} from '../article-sets/last-apple/guidance.ts';
import type { GuidanceTrial } from '../article-sets/last-apple/guidance.ts';
import { createReplay } from './replay.ts';
import guidance from '../traces/last-apple-guidance.json';
import type { Trace } from '../article-sets/scout-foundations/types.ts';

test('each recorded Qwen3 trial uses the matched inspection and stops before withdrawal', () => {
  const trials = (guidance.trials as GuidanceTrial[]).filter(({ placement }) =>
    guidancePlacements.some(({ id }) => id === placement),
  );
  assert.equal(trials.length, guidancePlacements.length * 3);
  assert.equal(
    new Set(trials.map(({ trace }) => trace.id)).size,
    trials.length,
  );
  const baseline = trials.find(
    ({ placement }) => placement === 'notice',
  )!.trace;
  const baselineInput = baseline.events.find(
    (event) => event.kind === 'model_start',
  )!;
  const baselineTool = baselineInput.schemas![0];
  const baselineMessages = baselineInput.messages!.filter(
    ({ tool_name }) => tool_name !== 'read_notice',
  );
  for (const placement of guidancePlacements) {
    const group = trials.filter((trial) => trial.placement === placement.id);
    assert.equal(group.length, 3);
    const notice = placement.notice
      ? `${picnicNotice} ${reserveRule}`
      : picnicNotice;
    const description = placement.tool
      ? `${baselineTool.function.description} ${reserveRule}`
      : baselineTool.function.description;
    for (const { trace } of group) {
      assert.equal(trace.provider, 'qwen3:14b');
      assert.equal(trace.mode, 'live');
      assert.equal(trace.initial.notice, notice);
      const evidence = guidanceEvidence(trace);
      assert(evidence.proposal);
      assert.equal(evidence.turns, 1);
      assert(evidence.elapsedMs !== null && evidence.elapsedMs >= 0);
      assert.equal(evidence.description, description);
      assert.deepEqual(JSON.parse(evidence.observation!), {
        ok: true,
        pantry: picnicPantry,
      });
      const start = trace.events.find((event) => event.kind === 'model_start')!;
      assert.deepEqual(start.schemas, [
        {
          ...baselineTool,
          function: { ...baselineTool.function, description },
        },
      ]);
      assert.equal(
        start.messages!.find(({ tool_name }) => tool_name === 'read_notice')
          ?.content,
        JSON.stringify({ ok: true, notice }),
      );
      assert.deepEqual(
        start.messages!.filter(({ tool_name }) => tool_name !== 'read_notice'),
        baselineMessages,
      );
      assert(
        !trace.events.some(
          (event) =>
            event.kind === 'tool_start' && event.tool?.name === 'take_one',
        ),
      );
      assert.deepEqual(trace.final?.pantry, picnicPantry);
      assert.deepEqual(trace.final?.basket, { apple: 0, carrot: 0 });
      assert.equal(trace.final?.carried, null);
    }
  }
});

test('malformed and missing proposals have no reserve verdict', () => {
  assert.deepEqual(
    classifyProposal([
      {
        function: { name: 'take_one', arguments: { item: 'apple', amount: 1 } },
      },
    ]),
    {
      validity: 'malformed',
      reserveCompliant: null,
    },
  );
  assert.deepEqual(classifyProposal([]), {
    validity: 'no proposal',
    reserveCompliant: null,
  });
  assert.deepEqual(
    classifyProposal([
      { function: { name: 'take_one', arguments: { item: 'apple' } } },
    ]),
    {
      validity: 'valid',
      item: 'apple',
      reserveCompliant: false,
    },
  );
});

test('enforcement stops after pickup and verification continues from the actual denial', async () => {
  const article = await loadArticle();
  let now = 0;
  const host = createLessonHost({
    articleId: 'last-apple',
    steps: [
      { id: 'experiment', title: 'Experiment' },
      {
        id: 'verify',
        title: 'Verify',
        initial: {
          checkpoint: pantryRefusalCheckpoint,
          pickupPolicy: reserveRefusal,
        },
      },
    ],
    settings: () => ({
      mode: 'mock',
      order: picnicNotice,
      apples: 1,
      live: { endpoint: '', model: '' },
    }),
    clock: {
      now: () => now,
      async sleep(ms, signal) {
        signal.throwIfAborted();
        now += ms;
      },
    },
  });
  async function run(strategy: Strategy, apple = 1, carrot = 3) {
    await runEnforcement(host.current, strategy, article.runtime, {
      apple,
      carrot,
    });
    const trace = host.current.trace;
    const inspection = trace.events.find(
      (event) =>
        event.kind === 'tool_result' && event.tool?.name === 'inspect_pantry',
    )!;
    const request = trace.events.find(
      (event) => event.kind === 'tool_start' && event.tool?.name === 'take_one',
    )!;
    assert(inspection.seq < request.seq);
    assert.deepEqual(request.tool?.arguments, { item: 'apple' });
    assert.deepEqual(trace.final?.basket, { apple: 0, carrot: 0 });
    return trace;
  }
  for (const strategy of ['guidance', 'evaluate'] as const) {
    const trace = await run(strategy);
    assert.equal(trace.final!.pantry.apple, 0);
    assert.equal(trace.final!.carried, 'apple');
    assert.equal(
      pickupEvidence(trace.events).transfer,
      'Verified from inventories',
    );
    assert.equal(evaluateOutcome(trace.final!), 'Reserve violated');
    assert.equal(
      trace.events.some((event) => event.kind === 'outcome_check'),
      strategy === 'evaluate',
    );
  }
  for (const strategy of ['guard', 'domain'] as const) {
    const refused = await run(strategy);
    assert.equal(refused.final!.pantry.apple, 1);
    assert.equal(refused.final!.carried, null);
    assert.equal(
      pickupEvidence(refused.events).execution,
      strategy === 'guard' ? 'Refused by dispatcher' : 'Refused by inventory',
    );
    assert.equal((await run(strategy, 2)).final!.carried, 'apple');
  }
  const denied = await run('domain');
  assert.equal(denied.final!.pantry.apple, 1);
  assert.equal(
    evaluateOutcome(denied.final!),
    'Picnic incomplete; reserve held',
  );
  host.select(1);
  assert.deepEqual(host.current.world.snapshot(), denied.final);
  assert.equal(
    (await host.current.world.takeOne('apple')).reason,
    'reserve_minimum',
  );
  const traceId = host.current.trace.id;
  await continueVerification(host.current, article.runtime);
  const recovered = host.current.trace;
  assert.equal(recovered.id, traceId);
  assert.deepEqual(recovered.final?.basket, { apple: 0, carrot: 1 });
  assert.deepEqual(recovered.final?.pantry, { apple: 1, carrot: 2 });
  assert.equal(recovered.final?.carried, null);
  assert.deepEqual(
    recovered.events.findLast((event) => event.kind === 'outcome_check')
      ?.result,
    {
      reserveHeld: true,
      picnicComplete: true,
    },
  );
  const recovery = recovered.events.filter(
    (event) => event.kind === 'model_start',
  )[0];
  assert(
    recovery.messages?.some(
      (message) =>
        message.tool_name === 'take_one' &&
        JSON.parse(message.content).reason === 'reserve_minimum',
    ),
  );
  host.select(0);
  await run('domain', 1, 0);
  await continueVerification(host.current, article.runtime);
  assert.equal(
    evaluateOutcome(host.current.trace.final!),
    'Blocked; no eligible snack',
  );
});

test('guidance replay plays movement and pauses at an exact cue before a same-time event', () => {
  const trace = structuredClone(guidance.trials[0].trace as Trace);
  const notice = trace.events.find(
    (event) =>
      event.kind === 'tool_result' && event.tool?.name === 'read_notice',
  )!;
  const walk = trace.events.find((event) => event.kind === 'walk_start')!;
  const proposal = trace.events.find(
    (event) => event.kind === 'guidance_proposal',
  )!;
  const end = trace.events.at(-1)!;
  end.at = proposal.at;
  const before = structuredClone(trace);
  const seen: number[] = [];
  const player = createReplay(trace, (event) => seen.push(event.seq));
  player.playTo(notice);
  player.advance(notice.at);
  assert.equal(player.currentEvent?.seq, notice.seq);
  assert.equal(player.pausedAtCue, true);

  player.playTo(proposal);
  player.advance(walk.at - notice.at);
  assert.equal(player.currentEvent?.kind, 'walk_start');
  assert.equal(player.playing, true);
  player.pause();
  player.advance(proposal.at);
  assert.equal(player.currentEvent?.kind, 'walk_start');

  player.play();
  player.advance(proposal.at);
  assert.equal(player.elapsed, proposal.at);
  assert.equal(player.currentEvent?.seq, proposal.seq);
  assert.equal(player.currentEvent?.state.carried, null);
  assert.equal(player.playing, false);
  assert.equal(player.pausedAtCue, true);

  player.play();
  assert.equal(player.currentEvent?.seq, end.seq);
  assert.deepEqual(
    seen,
    trace.events.map(({ seq }) => seq),
  );
  assert.deepEqual(trace, before);
});
