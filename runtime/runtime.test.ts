import test from 'node:test';
import assert from 'node:assert/strict';
import { runScout } from './loop.ts';
import { mockProvider } from './providers.ts';
import { createWorld } from './world.ts';
import { createReplay } from './replay.ts';
import { carrotOrder, defaultOrder } from './types.ts';
import type { Message, Snapshot } from './types.ts';

const instantClock = () => { let now = 0; return { now: () => now, sleep: async (ms: number) => { now += ms; } }; };

test('same real loop, observed stock, pickup and delivery: three teaching takes', async () => {
  const firstInputs: Message[][] = [];
  for (const [apple, order, basket, remaining] of [
    [2, defaultOrder, { apple: 1, carrot: 0 }, { apple: 1, carrot: 2 }],
    [1, defaultOrder, { apple: 0, carrot: 1 }, { apple: 1, carrot: 1 }],
    [2, carrotOrder, { apple: 0, carrot: 1 }, { apple: 2, carrot: 1 }],
  ] as const) {
    let inspected = false;
    const trace = await runScout({ order, pantry: { apple, carrot: 2 }, clock: instantClock(), provider: async (messages, tools, signal) => {
      if (messages.length === 2) firstInputs.push(structuredClone([...messages]));
      const observations = messages.filter(m => m.role === 'tool');
      inspected ||= observations.some(m => m.tool_name === 'inspect_pantry');
      if (!inspected) assert(!observations.some(m => Object.hasOwn(JSON.parse(m.content), 'pantry')));
      const reply = await mockProvider(messages, tools, signal);
      if (reply.tool_calls?.[0].function.name === 'take_one') assert(inspected);
      return reply;
    } });
    assert.equal(trace.status, 'reported');
    assert.deepEqual(trace.final?.basket, basket);
    assert.deepEqual(trace.final?.pantry, remaining);
    assert.equal(trace.final?.carried, null);
    assert(trace.events.some(e => e.kind === 'pickup'));
    assert(trace.events.some(e => e.kind === 'delivery'));
  }
  assert.deepEqual(firstInputs[0], firstInputs[1], 'starting stock must not change the initial provider input');
  assert(!firstInputs[0].some(m => m.content.includes(defaultOrder)), 'notice must be learned through a tool');
});

test('world enforces physical rules, conserves items, and permits taking the last apple', async () => {
  const world = createWorld({ notice: ' exact text\n', pantry: { apple: 1, carrot: 2 }, clock: instantClock() });
  const signal = new AbortController().signal;
  const tool = (name: string, args = {}) => world.execute({ name, arguments: args }, signal);
  assert.equal((await tool('read_notice')).notice, ' exact text\n');
  assert.equal((await tool('take_one', { item: 'apple' })).ok, false);
  await tool('walk_to', { place: 'pantry' });
  assert.equal((await tool('take_one', { item: 'apple' })).ok, true);
  assert.equal(world.snapshot().pantry.apple, 0);
  assert.equal((await tool('take_one', { item: 'carrot' })).ok, false);
  assert.equal((await tool('deliver_item')).ok, false);
  await tool('walk_to', { place: 'picnic_basket' });
  await tool('deliver_item');
  assert.deepEqual(world.snapshot().basket, { apple: 1, carrot: 0 });
  assert.equal((await tool('deliver_item')).ok, false);
  assert.deepEqual(world.snapshot().pantry, { apple: 0, carrot: 2 });
});

test('replay renders a trace through its playhead without a provider or tool executor', async () => {
  let providerCalls = 0;
  const trace = await runScout({ order: defaultOrder, pantry: { apple: 2, carrot: 2 }, clock: instantClock(), provider: (...args) => { providerCalls++; return mockProvider(...args); } });
  const callsBeforeReplay = providerCalls;
  let state: Snapshot | undefined;
  const replay = createReplay(JSON.parse(JSON.stringify(trace)), event => { state = event.state; });
  replay.play(); replay.advance(replay.duration / 2); replay.pause();
  const pausedAt = replay.elapsed;
  replay.advance(99999);
  assert.equal(replay.elapsed, pausedAt);
  replay.play(); replay.advance(99999);
  assert.deepEqual(state, trace.final);
  assert.equal(providerCalls, callsBeforeReplay);
  replay.restart();
  assert.deepEqual(state, trace.initial);
});
