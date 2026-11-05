import type { Message } from './types.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runScout } from '../article-sets/scout-foundations/experiment.ts';
import { mockProvider } from '../article-sets/scout-foundations/mock.ts';
import { createWorld } from '../article-sets/scout-foundations/world.ts';
import { createReplay } from './replay.ts';
import { carrotOrder, defaultOrder } from '../article-sets/scout-foundations/types.ts';
import type { Snapshot } from '../article-sets/scout-foundations/types.ts';

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
  const replay = createReplay<Snapshot>(JSON.parse(JSON.stringify(trace)), event => { state = event.state; });
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


test('selected tools gate dispatch; returned notice is not knowledge until feedback is appended', async () => {
  const { createAgent } = await import('./loop.ts');
  const { createExperiment } = await import('../article-sets/scout-foundations/experiment.ts');
  const signal = new AbortController().signal;
  const forbidden = createAgent({ provider: mockProvider, messages: [], tools: [], signal });
  const denied = await forbidden.execute({ role: 'assistant', content: '', tool_calls: [{ function: { name: 'take_one', arguments: { item: 'apple' } } }] });
  assert.equal(denied?.value.reason, 'tool_unavailable');
  const exp = createExperiment({ order: defaultOrder, pantry: { apple: 2, carrot: 2 }, provider: mockProvider, activeTools: ['read_notice'], clock: instantClock() });
  const reply = await exp.agent.evaluate();
  const feedback = await exp.agent.execute(reply);
  assert(feedback);
  assert.equal(feedback.value.notice, defaultOrder);
  assert(!JSON.stringify(exp.agent.messages).includes(defaultOrder));
  assert.equal((await exp.agent.evaluate()).tool_calls?.[0].function.name, 'read_notice', 'without feedback the provider still needs to read');
  exp.agent.append(feedback);
  assert.deepEqual(exp.agent.messages.slice(-2), [reply, feedback.result]);
  assert((await exp.agent.evaluate()).content.includes(defaultOrder));
});

test('three unappended evaluations have identical inputs; stale pickup fails then Mock reinspects', async () => {
  const { createAgent } = await import('./loop.ts');
  const { initialMessages, createExperiment } = await import('../article-sets/scout-foundations/experiment.ts');
  const inputs: string[] = [];
  const agent = createAgent({ messages: initialMessages(), tools: [], signal: new AbortController().signal,
    provider: async (...args) => { inputs.push(JSON.stringify(args[0])); return mockProvider(...args); } });
  for (let n = 0; n < 3; n++) await agent.evaluate();
  assert.equal(new Set(inputs).size, 1);
  const exp = createExperiment({ order: defaultOrder, pantry: { apple: 2, carrot: 2 }, provider: mockProvider, clock: instantClock() });
  let changed = false;
  await exp.agent.run(async feedback => { if (!changed && feedback.result.tool_name === 'inspect_pantry') { changed = true; exp.world.emptyApples(); } });
  const results = exp.trace.events.filter(e => e.kind === 'tool_result');
  assert(results.some(e => e.result?.reason === 'out_of_stock'));
  assert.equal(results.filter(e => e.tool?.name === 'inspect_pantry').length, 2);
  assert.deepEqual(exp.world.snapshot().basket, { apple: 0, carrot: 1 });
});

test('lesson patrol can receive a post while running; approval changes tools without executing them', async () => {
  const { createLessonDriver } = await import('../article-sets/scout-foundations/driver.ts');
  const { createSteps } = await import('../article-sets/scout-foundations/articles/what-makes-scout-an-agent/steps.ts');
  const steps = createSteps({});
  const driver = createLessonDriver({ steps, settings: () => ({ mode: 'mock', order: defaultOrder, apples: 2, pauseInspection: false, live: { endpoint: '', model: '' } }), clock: instantClock(), changed() {}, event() {} });
  const patrol = driver.action('start');
  await driver.action('post'); await patrol;
  assert(driver.take.experiment.world.snapshot().unread);
  assert.equal(driver.take.phase, 'passed');
  assert(!driver.take.experiment.trace.events.some(e => ['model_start','tool_start'].includes(e.kind)));
  driver.select(steps.findIndex(step => step.id === 'tool'));
  await driver.action('approve');
  assert.deepEqual(driver.stage.tools, [], 'approval is offered after the missing-tool experiment');
  await driver.action('run');
  assert.equal(driver.take.phase, 'needs-tool');
  assert(driver.take.experiment.trace.events.some(event => event.kind === 'capability_missing'));
  assert(!driver.take.experiment.trace.events.some(event => event.kind === 'tool_start'));
  assert(driver.take.experiment.world.snapshot().unread);
  await driver.action('approve');
  assert.deepEqual(driver.stage.tools, ['read_notice']);
  assert(!driver.take.experiment.trace.events.some(e => ['model_start','tool_start'].includes(e.kind)));
});


test('article registry loads independent content; reordered steps retain context, labels and replay identity', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { articleRegistry, loadArticles, selectArticle, recordingArticle, replayStepIndex } = await import('../article-sets/registry.ts');
  const definition = articleRegistry[0];
  const second = { ...definition, id: 'second-article', title: 'Second article', directory: 'test-articles/second' };
  const markdown: Record<string, string> = {};
  for (const file of readdirSync(definition.directory).filter(file => /^\d.*\.md$/.test(file))) {
    markdown[`${definition.directory}/${file}`] = readFileSync(`${definition.directory}/${file}`, 'utf8');
    markdown[`${second.directory}/${file}`] = `Second article: ${file}`;
  }
  const articles = loadArticles(markdown, [definition, second]);
  assert.equal(selectArticle(articles, second.id).steps[0].markdown, 'Second article: 01-meet.md');
  assert(!articles[0].steps[0].markdown.includes('Second article:'));
  const { renderSlides } = await import('../presentation/lesson-markup.ts');
  const markup = articles.map(article => renderSlides(article.steps.map(step => ({ ...step, markdown: 'Example prose' })), {}, article.id)).join('');
  const headingIds = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(headingIds).size, headingIds.length, 'article headings have distinct DOM identities');
  assert.equal(recordingArticle(articles, { article: second.id, stepId: 'meet', step: 1, stage: 'ready' })?.id, second.id);
  assert.equal(recordingArticle(articles)?.id, definition.id, 'legacy recordings belong to the original article');
  const first = articles[0];
  assert.equal(replayStepIndex(first, { stepId: 'turn', step: 2, stage: 'done' }), first.steps.findIndex(step => step.id === 'tool'));
  first.steps.reverse();
  assert.equal(first.steps[0].id, 'picnic');
  assert.equal(first.steps[0].actionLabels?.run, 'Run picnic');
  assert.equal(first.steps[0].context, 'pantry-observation');
  assert.equal(replayStepIndex(first, { article: first.id, stepId: 'picnic', step: 7, stage: 'done' }), 0);
  assert.equal(replayStepIndex(first, { step: 7, stage: 'done' }), 0, 'old numbered recordings use the original ID mapping');
  assert.equal(replayStepIndex(first), 0, 'recordings without lesson metadata use the article replay step');
  const { createLessonDriver } = await import('../article-sets/scout-foundations/driver.ts');
  const { defaultOrder } = await import('../article-sets/scout-foundations/types.ts');
  const driver = createLessonDriver({ steps: first.steps, articleId: first.id, clock: instantClock(), settings: () => ({ mode: 'mock', order: defaultOrder, apples: 1, pauseInspection: false, live: { endpoint: '', model: '' } }), changed() {}, event() {} });
  await driver.action('run');
  assert.deepEqual(driver.take.experiment.world.snapshot().basket, { apple: 0, carrot: 1 });
  assert.equal(driver.take.experiment.trace.lesson?.stepId, 'picnic');
  assert(driver.context.includes('"apple":1'));
});
