import test from 'node:test';
import assert from 'node:assert/strict';
import trace from '../../traces/ollama-last-apple.json';
import { recordedNotice, recordedRun } from './recording.ts';

test('the historical walkthrough retains the original Qwen3 evidence', () => {
  const { frames } = recordedRun;
  assert.equal(recordedRun.id, trace.id);
  assert.equal(trace.provider, 'qwen3:14b');
  assert.equal(recordedNotice, trace.initial.notice);
  assert.deepEqual(frames[0].state.pantry, { apple: 1, carrot: 2 });
  assert.deepEqual(frames[1].payload, trace.events[16].result);
  assert.deepEqual(frames[2].payload, trace.events[19].tool);
  assert.deepEqual(frames[3].payload, {
    ok: true,
    item: 'apple',
    carried: 'apple',
  });
  assert.equal(frames[3].state.pantry.apple, 0);
  assert.equal(frames[3].state.scout.apple, 1);
  assert.deepEqual(frames[4].state.basket, trace.events[32].state.basket);
  assert.equal(frames[5].payload?.report, trace.events[35].text);
  assert.equal(frames[5].evidence.transfer, 'verified');
  assert.equal(frames[5].evidence.outcome, 'violated');
});

test('moving the playhead reads immutable snapshots and leaves the fixture intact', () => {
  const raw = structuredClone(trace);
  const frame = (index: number) => recordedRun.frames[index];
  const first = structuredClone(frame(0));
  assert.equal(frame(3).state.pantry.apple, 0);
  assert.equal(frame(5).state.basket?.apple, 1);
  assert.deepEqual(frame(0), first);
  assert(Object.isFrozen(frame(3).payload));
  assert(Object.isFrozen(recordedRun.frames));
  assert.deepEqual(trace, raw);
});
