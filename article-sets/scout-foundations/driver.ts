import { describeContext } from './context.ts';
import type { Feedback } from '../../runtime/loop.ts';
import { realClock } from '../../runtime/types.ts';
import type { Clock } from '../../runtime/types.ts';
import { liveProvider } from '../../runtime/providers.ts';
import type { LiveSettings } from '../../runtime/providers.ts';
import type { TeachingStep } from '../../presentation/teaching.ts';
import { createExperiment } from './experiment.ts';
import type { Experiment } from './experiment.ts';
import { createMockProvider } from './mock.ts';
import type { Mode, Snapshot, Trace, TraceEvent } from './types.ts';

export interface Settings { mode: Mode; order: string; apples: number; pauseInspection: boolean; live: LiveSettings }
export interface Take { experiment: Experiment; abort: AbortController; phase: string; busy: boolean; pending?: Feedback; continue?: () => void }

// Scout experiments live here, not in the shared agent harness or presentation.
export function createLessonDriver({ steps, articleId, settings, clock = realClock, changed, event, saved = () => {} }: {
  steps: readonly TeachingStep[]; articleId?: string; settings: () => Settings; clock?: Clock;
  changed: () => void; event: (event: TraceEvent) => void; saved?: (trace: Trace) => void;
}) {
  const takes = new Map<number, Take>();
  let index = 0;
  function make(step: number, initial?: Snapshot, tools?: readonly string[]): Take {
    const config = settings(), abort = new AbortController();
    const active = tools ?? steps[step].stages[0].tools;
    let listening = false;
    const mock = createMockProvider(steps[step].terminalDialogue);
    const experiment = createExperiment({ order: steps[step].checkpoint === 'empty-board' ? '' : config.order, pantry: { apple: config.apples, carrot: 2 },
      activeTools: active, mode: config.mode === 'live' ? 'live' : 'mock', providerLabel: config.mode === 'live' ? config.live.model : 'Mock',
      provider: config.mode === 'live' ? liveProvider(config.live) : async (...args) => {
        await clock.sleep(650, args[2]); return mock(...args);
      }, signal: abort.signal, clock, initial, step: step + 1,
      onEvent: e => { if (listening && index === step && takes.get(step)?.experiment === experiment) { event(e); changed(); } },
    });
    experiment.trace.lesson = { article: articleId, stepId: steps[step].id, step: step + 1, stage: 'ready' };
    listening = true;
    return { experiment, abort, phase: 'ready', busy: false };
  }
  function current(): Take { if (!takes.has(index)) takes.set(index, make(index)); return takes.get(index)!; }
  function cancel() {
    const take = takes.get(index);
    if (take?.busy) { take.abort.abort(new Error('Experiment cancelled by navigation or mode change')); take.continue?.(); }
  }
  function select(next: number) {
    cancel(); index = next;
    if (steps[index].experiment === 'feedback' && !takes.has(index)) {
      const reading = takes.get(steps.findIndex(step => step.experiment === 'execute'));
      if (reading?.pending) {
        const take = make(index, reading.experiment.world.snapshot());
        take.pending = structuredClone(reading.pending); take.phase = 'held'; takes.set(index, take);
      }
    }
    current(); changed();
  }
  async function action(id: string) {
    if (settings().mode === 'replay') return;
    let take = current();
    const experimentId = steps[index].experiment;
    const activeStage = steps[index].stages.find(stage => stage.id === take.phase) ?? steps[index].stages[0];
    if (id !== 'post' && !activeStage?.actions.includes(id)) return;
    if (id === 'continue') { take.continue?.(); return; }
    if (id === 'empty-apples') { take.experiment.world.emptyApples(); changed(); return; }
    if (take.busy && id !== 'post') return;
    if (take.busy && id === 'post' && experimentId !== 'patrol') cancel();
    if (id === 'approve') {
      take = make(index, take.experiment.world.snapshot(), steps[index].stages.find(stage => stage.id === 'approved')?.tools ?? []); takes.set(index, take);
      take.phase = 'approved'; take.experiment.show({ kind: 'lesson_approval', text: 'Reader approved the reading-tool lesson stage. No handler executed.' }); changed(); return;
    }
    if (id === 'post') {
      if (experimentId === 'patrol') {
        take.experiment.world.postNotice(settings().order); take.phase = take.busy ? 'posted' : 'ready'; changed(); return;
      }
      take = make(index); takes.set(index, take); take.experiment.world.postNotice(settings().order); changed(); return;
    }
    if (id !== 'append' && id !== 'start') { take = make(index); takes.set(index, take); }
    const runningIndex = index;
    const { experiment: exp, abort } = take;
    take.busy = true; exp.trace.status = 'running'; changed();
    try {
      if (experimentId === 'patrol') {
        take.phase = 'patrolling'; changed();
        do { await exp.world.patrol(abort.signal); } while (!exp.world.snapshot().unread);
        take.phase = 'passed'; exp.finish('completed');
      } else if (experimentId === 'approve') {
        await exp.agent.evaluate();
        take.phase = 'needs-tool';
        exp.show({ kind: 'capability_missing', text: 'No reading tool is available. The notice is still unread.' });
        exp.finish('needs-tool');
      } else if (experimentId === 'execute' || (experimentId === 'feedback' && id !== 'append')) {
        const reply = await exp.agent.evaluate();
        const feedback = await exp.agent.execute(reply);
        take.pending = feedback?.result.tool_name === 'read_notice' && feedback.value.ok === true && typeof feedback.value.notice === 'string' ? feedback : undefined;
        take.phase = take.pending ? 'held' : 'no-read'; exp.finish(take.phase);
      } else if (experimentId === 'feedback' && take.pending) {
        exp.agent.append(take.pending);
        take.pending = undefined;
        await exp.agent.evaluate(); // Deliberately stop before another tool execution.
        take.phase = 'done'; exp.finish('completed');
      } else if (experimentId === 'picnic') {
        take.phase = 'running'; changed();
        let paused = false;
        const status = await exp.agent.run(async feedback => {
          if (settings().pauseInspection && !paused && feedback.result.tool_name === 'inspect_pantry' && feedback.value.ok) {
            paused = true; take.phase = 'inspected'; exp.trace.status = 'paused'; changed();
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => { cleanup(); reject(abort.signal.reason); };
              const cleanup = () => { take.continue = undefined; abort.signal.removeEventListener('abort', onAbort); };
              take.continue = () => { cleanup(); resolve(); };
              abort.signal.addEventListener('abort', onAbort, { once: true });
            });
            abort.signal.throwIfAborted(); take.phase = 'running'; exp.trace.status = 'running'; changed();
          }
        });
        take.phase = 'done'; exp.finish(status);
      } else {
        throw new Error(`Unknown Scout experiment: ${experimentId}`);
      }
    } catch (error) {
      exp.show({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
      take.phase = abort.signal.aborted ? 'cancelled' : 'error'; exp.finish(take.phase);
    } finally {
      take.busy = false; exp.trace.lesson = { article: articleId, stepId: steps[runningIndex].id, step: runningIndex + 1, stage: take.phase };
      saved(structuredClone(exp.trace)); changed();
    }
  }
  function stageFor(take: Take) {
    const authored = steps[index].stages.find(stage => stage.id === take.phase);
    if (authored) return authored;
    return { ...steps[index].stages[0], instruction: take.busy ? 'Scout is running. Watch the terminal.' : 'This experiment stopped. The terminal and History show its actual outcome. Run starts a fresh take.', actions: take.busy ? [] : steps[index].stages[0].actions };
  }
  return {
    select, action, cancel,
    reset() { cancel(); takes.clear(); current(); changed(); },
    get take() { return current(); },
    get stage() { return stageFor(current()); },
    get context() { const take = current(); return describeContext(steps[index], take, stageFor(take)); },
  };
}
