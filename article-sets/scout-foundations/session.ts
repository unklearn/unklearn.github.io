import { createWorld } from './world.ts';
import { initialMessages } from './conversation.ts';
import { selectTools } from './tools.ts';
import { createMockProvider } from './mock.ts';
import { liveProvider } from '../../runtime/providers.ts';
import type { LiveSettings } from '../../runtime/providers.ts';
import { createTrace } from '../../runtime/trace.ts';
import { realClock } from '../../runtime/types.ts';
import type { Clock, Message, RuntimeEvent } from '../../runtime/types.ts';
import type { StoredCode } from '../../runtime/lesson-types.ts';
import { defaultOrder } from './types.ts';
import type { Inventory, Item, Place, Snapshot, Trace, TraceEvent } from './types.ts';

export interface Settings { mode: 'mock' | 'live' | 'replay'; order: string; apples: number; pauseInspection: boolean; live: LiveSettings }
export interface StepMeta { id: string; title: string; initial?: { notice?: string; tools?: readonly string[]; checkpoint?: string } }
interface Checkpoint { world: Snapshot; messages: Message[]; data: Record<string, unknown>; tools: string[] }
export function createLessonHost({ articleId, steps, settings, clock = realClock, event = () => {}, changed = () => {}, saved = () => {} }: {
  articleId: string; steps: readonly StepMeta[]; settings: () => Settings; clock?: Clock;
  event?: (event: TraceEvent) => void; changed?: () => void; saved?: (trace: Trace) => void;
}) {
  const sessions = new Map<string, ReturnType<typeof makeSession>>(), checkpoints = new Map<string, Checkpoint>();
  let index = 0, revision = 0, epoch = 0;
  const subscribers = new Set<() => void>();
  const notify = () => { revision++; subscribers.forEach(fn => fn()); changed(); };
  function makeSession(meta: StepMeta) {
    let abort = new AbortController(), busy = false, generation = 0, turn = 0;
    let tools = [...(meta.initial?.tools ?? [])], messages = initialMessages(), data: Record<string, unknown> = {};
    let context = '', stage = 'ready';
    let world: ReturnType<typeof createWorld>, recording: ReturnType<typeof createTrace<Snapshot>>;
    const emit = (e: RuntimeEvent) => {
      if (abort.signal.aborted) return;
      const messages = e.messages?.map(({ role, content, tool_calls, tool_name }) => ({ role, content, ...(tool_calls ? { tool_calls } : {}), ...(tool_name ? { tool_name } : {}) }));
      recording.record({ ...e, ...(messages ? { messages } : {}), state: world.snapshot() });
    };
    function reset(options: { notice?: string; pantry?: Inventory; tools?: readonly string[]; checkpoint?: string } = {}) {
      abort.abort(new Error('Take reset')); abort = new AbortController(); generation++; busy = false;
      const config = settings(), checkpoint = checkpoints.get(options.checkpoint ?? '');
      tools = [...(options.tools ?? checkpoint?.tools ?? meta.initial?.tools ?? [])];
      messages = structuredClone(checkpoint?.messages ?? initialMessages()); data = structuredClone(checkpoint?.data ?? {});
      context = ''; stage = 'ready'; turn = 0;
      const token = generation;
      world = createWorld({ notice: options.notice ?? meta.initial?.notice ?? config.order, pantry: options.pantry ?? { apple: config.apples, carrot: 2 }, clock,
        initial: checkpoint?.world, emit: e => { if (token === generation && !abort.signal.aborted) recording.record(e); } });
      recording = createTrace({ initial: world.snapshot(), mode: config.mode === 'live' ? 'live' : 'mock', provider: config.mode === 'live' ? config.live.model : 'Mock', clock,
        emit: e => { if (token === generation && steps[index].id === meta.id) event(e); notify(); } });
      recording.trace.lesson = { article: articleId, stepId: meta.id, step: steps.findIndex(s => s.id === meta.id) + 1, stage };
      recording.record({ kind: 'checkpoint', text: 'Fresh take', state: world.snapshot() });
      notify();
    }
    // Construct state only. No evaluation, execution, or browser events on mount/SSR.
    const initial = meta.initial ?? {};
    world = createWorld({ notice: initial.notice ?? settings().order, pantry: { apple: settings().apples, carrot: 2 }, clock, emit: e => { if (generation === 0 && !abort.signal.aborted) recording.record(e); } });
    recording = createTrace({ initial: world.snapshot(), mode: settings().mode === 'live' ? 'live' : 'mock', provider: settings().mode === 'live' ? settings().live.model : 'Mock', clock,
      emit: e => { if (steps[index].id === meta.id) event(e); notify(); } });
    recording.trace.lesson = { article: articleId, stepId: meta.id, step: steps.findIndex(s => s.id === meta.id) + 1, stage };
    const session = {
      meta,
      reset,
      setTools(ids: readonly string[]) { tools = [...ids]; emit({ kind: 'tools_changed', text: `Available tools: ${tools.join(', ') || 'none'}` }); },
      resetContext(input = initialMessages()) { messages = structuredClone(input); context = ''; emit({ kind: 'context_reset', text: 'Fresh conversation' }); },
      showContext(value: unknown) { context = typeof value === 'string' ? value : JSON.stringify(value, (key, item) => key === 'thinking' ? undefined : item, 2); notify(); },
      showQuestion(text: string) { emit({ kind: 'capability_missing', text }); },
      clearQuestion() { emit({ kind: 'capability_available', text: 'Requested capability is available' }); },
      mark(value: string) { stage = value; recording.trace.lesson!.stage = value; notify(); },
      saveCheckpoint(name: string, extra: Record<string, unknown> = {}) {
        data = { ...data, ...extra }; checkpoints.set(name, structuredClone({ world: world.snapshot(), messages, data, tools }));
      },
      restoreCheckpoint(name: string) { if (!checkpoints.has(name)) return false; reset({ checkpoint: name }); return true; },
      runtime(block: StoredCode) {
        if (settings().mode === 'replay' || steps[index].id !== meta.id) throw new Error('This step is not active');
        const Constructor = block.module.AgentRuntime;
        if (!Constructor) throw new Error(`No AgentRuntime in ${block.id}`);
        const signal = abort.signal, token = generation;
        const assertActive = () => { signal.throwIfAborted(); if (generation !== token || steps[index].id !== meta.id) throw new Error('Take is no longer active'); };
        const mock = createMockProvider();
        const provider = settings().mode === 'live' ? liveProvider(settings().live) : mock;
        emit({ kind: 'runtime_selected', text: block.id });
        return new Constructor({ messages, tools: selectTools(world, tools), signal, emit: e => { assertActive(); emit(e); },
          provider: async (input, schemas, requestSignal) => {
            assertActive(); turn++;
            // This wrapper only observes requests; the selected snapshot supplies all agent behavior.
            emit({ kind: 'model_start', text: 'Provider call pending', turn, messages: structuredClone([...input]), schemas: structuredClone([...schemas]) });
            try {
              if (settings().mode === 'mock') await clock.sleep(650, requestSignal);
              const reply = await provider(input, schemas, requestSignal); assertActive();
              const publicReply = { role: reply.role, content: reply.content, tool_calls: reply.tool_calls };
              emit({ kind: 'assistant', text: reply.content || 'Tool requested', tool: publicReply.tool_calls?.[0]?.function, turn });
              return reply;
            } finally { if (!signal.aborted) emit({ kind: 'model_end', text: 'Provider call ended', turn }); }
          },
        });
      },
      async act(work: () => void | Promise<void>) {
        if (busy || settings().mode === 'replay' || steps[index].id !== meta.id) return;
        if (abort.signal.aborted) abort = new AbortController();
        const signal = abort.signal;
        busy = true; recording.trace.status = 'running'; notify();
        try { await work(); signal.throwIfAborted(); recording.finish(world.snapshot(), stage); }
        catch (error) {
          if (!signal.aborted) { emit({ kind: 'error', text: error instanceof Error ? error.message : String(error) }); stage = 'error'; recording.finish(world.snapshot(), 'error'); }
        } finally {
          if (signal === abort.signal) { busy = false; saved(structuredClone(session.trace)); notify(); }
        }
      },
      cancel() {
        if (busy) {
          abort.abort(new Error('Step left or mode changed')); busy = false;
          recording.finish(world.snapshot(), 'cancelled'); saved(structuredClone(session.trace)); notify();
        }
      },
      world: {
        snapshot: () => world.snapshot(),
        postNotice(text = settings().order) { if (settings().mode !== 'replay') world.postNotice(text); },
        patrol: () => world.patrol(abort.signal),
        walkTo: (place: Place) => world.execute({ name: 'walk_to', arguments: { place } }, abort.signal),
        inspectPantry: () => world.execute({ name: 'inspect_pantry', arguments: {} }, abort.signal),
        takeOne: (item: Item) => world.execute({ name: 'take_one', arguments: { item } }, abort.signal),
        deliverItem: () => world.execute({ name: 'deliver_item', arguments: {} }, abort.signal),
        setPantry(stock: Inventory) { world.setPantry(stock); },
      },
      get settings() { return settings(); },
      get trace(): Trace { return Object.assign(recording.trace, { order: world.snapshot().notice }); }, get busy() { return busy; }, get messages() { return messages; },
      get tools() { return tools; }, get schemas() { return selectTools(world, tools).map(tool => tool.definition); }, get data() { return data; }, get context() { return context; }, get stage() { return stage; },
    };
    return session;
  }
  function get(id: string) {
    if (!sessions.has(id)) { const meta = steps.find(s => s.id === id); if (!meta) throw new Error(`Unknown step: ${id}`); sessions.set(id, makeSession(meta)); }
    return sessions.get(id)!;
  }
  return {
    get, get current() { return get(steps[index].id); }, get index() { return index; },
    select(next: number) { if (index !== next) { this.current.cancel(); index = next; notify(); } },
    resetAll() { this.current.cancel(); sessions.clear(); checkpoints.clear(); epoch++; notify(); },
    subscribe(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    getRevision: () => revision, get epoch() { return epoch; },
    defaults: { order: defaultOrder },
  };
}
export type LessonHost = ReturnType<typeof createLessonHost>;
export type ScoutStep = LessonHost['current'];
