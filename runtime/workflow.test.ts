import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import { defaultOrder } from '../article-sets/scout-foundations/types.ts';
import {
  chooseAndTake,
  picnicRule,
  ruleExamples,
  scriptedObservation,
} from '../article-sets/scout-foundations/workflow.ts';

function host(apples = 2) {
  let time = 0;
  return createLessonHost({
    articleId: 'workflow-test',
    steps: [
      { id: 'meet', title: 'Workflow', initial: { notice: '', tools: [] } },
      { id: 'next', title: 'Next' },
    ],
    settings: () => ({
      mode: 'mock',
      apples,
      order: defaultOrder,
      live: { endpoint: '', model: '' },
    }),
    clock: {
      now: () => time,
      sleep: async (ms, signal) => {
        signal.throwIfAborted();
        time += ms;
      },
    },
  });
}

test('scripted actions and hypothetical rule choices never evaluate a provider or mutate practice stock', async () => {
  const h = host(),
    s = h.current;
  s.world.postNotice(defaultOrder);
  await s.act(async () => {
    await s.world.patrol();
    const read = await scriptedObservation(s, 'read_notice', () =>
      s.world.readNotice(),
    );
    assert.equal(read.notice, defaultOrder);
    assert.equal(s.world.snapshot().unread, false);
    await s.world.walkTo('pantry');
    const inspection = await s.world.inspectPantry();
    const before = s.world.snapshot();
    for (const example of ruleExamples)
      assert.equal(picnicRule(example.pantry), example.item);
    assert.deepEqual(s.world.snapshot(), before);
    assert.deepEqual(inspection.pantry, { apple: 2, carrot: 2 });
    await s.world.takeOne(
      picnicRule(inspection.pantry as { apple: number; carrot: number })!,
    );
    await s.world.walkTo('picnic_basket');
    await s.world.deliverItem();
    await s.world.walkTo('noticeboard');
  });
  assert.equal(s.trace.status, 'ready');
  assert(
    !s.trace.events.some((e) => ['model_start', 'tool_start'].includes(e.kind)),
  );
  assert.deepEqual(s.world.snapshot().basket, { apple: 1, carrot: 0 });
  assert.equal(s.world.snapshot().place, 'noticeboard');
});

test('workflow AI chooses once from actual observations, with only pickup available', async () => {
  for (const apples of [2, 1]) {
    const s = host(apples).current;
    s.world.postNotice(defaultOrder);
    await s.act(async () => {
      const read = await s.world.readNotice();
      await s.world.walkTo('pantry');
      const stock = await s.world.inspectPantry();
      const item = await chooseAndTake(
        s,
        read.notice as string,
        stock.pantry as { apple: number; carrot: number },
      );
      assert.equal(item, apples === 2 ? 'apple' : 'carrot');
      await s.world.walkTo('picnic_basket');
      await s.world.deliverItem();
      await s.world.walkTo('noticeboard');
    });
    assert.notEqual(
      s.trace.status,
      'error',
      s.trace.events.findLast((e) => e.kind === 'error')?.text,
    );
    const calls = s.trace.events.filter((e) => e.kind === 'model_start');
    assert.equal(calls.length, 1);
    assert.deepEqual(
      calls[0].schemas?.map((tool) => tool.function.name),
      ['take_one'],
    );
    assert.deepEqual(JSON.parse(calls[0].messages![1].content), {
      notice: defaultOrder,
      pantry: { apple: apples, carrot: 2 },
    });
    assert.equal(
      s.trace.events.filter((e) => e.kind === 'tool_start').length,
      1,
    );
    assert.equal(
      s.world.snapshot().basket[apples === 2 ? 'apple' : 'carrot'],
      1,
    );
    assert.deepEqual(s.trace.final, s.trace.events.at(-1)?.state);
  }
});

test('leaving a step cancels idle background patrol and delayed notices', async () => {
  const pending: { signal: AbortSignal; resolve: () => void }[] = [];
  const h = createLessonHost({
    articleId: 'background-test',
    steps: [
      { id: 'meet', title: 'Patrol', initial: { notice: '' } },
      { id: 'next', title: 'Next' },
    ],
    settings: () => ({
      mode: 'mock',
      apples: 2,
      order: defaultOrder,
      live: { endpoint: '', model: '' },
    }),
    clock: {
      now: () => 0,
      sleep: (_ms, signal) =>
        new Promise<void>((resolve, reject) => {
          signal.throwIfAborted();
          pending.push({ signal, resolve });
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    },
  });
  const s = h.current;
  const patrol = s.background((signal) => s.world.patrol(signal));
  const notice = s.background(async (signal) => {
    await s.sleep(3000, signal);
    s.world.postNotice(defaultOrder);
  });
  await Promise.resolve();
  assert.equal(s.world.snapshot().place, null);
  assert.equal(s.busy, false);
  assert.equal(s.backgroundActive, true);
  h.select(1);
  await Promise.all([patrol.done, notice.done]);
  assert(pending.every((task) => task.signal.aborted));
  assert.equal(s.world.snapshot().unread, false);
  assert.equal(s.backgroundActive, false);
  assert.equal(s.world.snapshot().place, 'noticeboard');
  h.select(0);
  assert(s.interrupted);
  assert(!s.backgroundActive);
});

test('stopping patrol preserves a completed delivery status and records the settled world', async () => {
  let moving = false;
  const h = createLessonHost({
    articleId: 'finished-patrol',
    steps: [
      { id: 'meet', title: 'Workflow' },
      { id: 'next', title: 'Next' },
    ],
    settings: () => ({
      mode: 'mock',
      apples: 2,
      order: defaultOrder,
      live: { endpoint: '', model: '' },
    }),
    clock: {
      now: () => 0,
      sleep: (_ms, signal) =>
        new Promise<void>((_resolve, reject) => {
          moving = true;
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    },
  });
  const s = h.current;
  await s.act(() => s.mark('ai-done'));
  const task = s.background((signal) => s.world.patrol(signal));
  await Promise.resolve();
  assert(moving);
  h.select(1);
  await task.done;
  assert.equal(s.trace.status, 'ai-done');
  assert.equal(s.trace.final?.place, 'noticeboard');
  assert.deepEqual(s.trace.final, s.trace.events.at(-1)?.state);
});
