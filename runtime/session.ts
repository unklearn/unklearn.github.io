import { liveProvider } from './providers.ts';
import type { LiveSettings } from './providers.ts';
import { createTrace } from './trace.ts';
import { realClock } from './types.ts';
import type {
  Clock,
  Message,
  RuntimeEvent,
  Tool,
  Provider,
  Trace,
  TraceEvent,
  WorldEvent,
} from './types.ts';
import type { StoredCode } from './lesson-types.ts';
export interface ExecutionSettings {
  mode: 'mock' | 'live' | 'replay';
  live: LiveSettings;
}
export interface StepMeta<Initial extends object = object> {
  id: string;
  title: string;
  question?: string;
  initial?: Initial & { tools?: readonly string[]; checkpoint?: string };
  narration?: { text: string; audio?: string };
}
export interface Scenario<State, World, Helpers, Config, Initial> {
  createWorld(options: {
    settings: Config;
    initial: Partial<Initial>;
    clock: Clock;
    snapshot?: State;
    emit: (event: WorldEvent<State>) => void;
  }): World;
  helpers(access: {
    world: () => World;
    signal: () => AbortSignal;
    settings: () => Config;
  }): Helpers;
  selectTools(world: World, ids: readonly string[]): Tool[];
  initialMessages(): Message[];
  mockProvider: Provider;
}
interface Checkpoint<State> {
  world: State;
  messages: Message[];
  data: Record<string, unknown>;
  tools: string[];
}
export function createSessionHost<
  State,
  World extends { snapshot(): State },
  Helpers,
  Config extends ExecutionSettings,
  Initial extends object,
>({
  articleId,
  steps,
  scenario,
  settings,
  clock = realClock,
  event = () => {},
  changed = () => {},
  saved = () => {},
}: {
  articleId: string;
  steps: readonly StepMeta<Initial>[];
  scenario: Scenario<State, World, Helpers, Config, Initial>;
  settings: () => Config;
  clock?: Clock;
  event?: (event: TraceEvent<State>) => void;
  changed?: () => void;
  saved?: (trace: Trace<State>) => void;
}) {
  const sessions = new Map<string, ReturnType<typeof makeSession>>(),
    checkpoints = new Map<string, Checkpoint<State>>();
  let index = 0,
    revision = 0,
    epoch = 0;
  const visited = new Set([0]);
  const subscribers = new Set<() => void>();
  const artifacts = new Map<string, unknown>();
  const notify = () => {
    revision++;
    subscribers.forEach((fn) => fn());
    changed();
  };
  function makeSession(meta: StepMeta<Initial>) {
    let abort = new AbortController(),
      busy = false,
      generation = 0,
      turn = 0;
    let tools = [...(meta.initial?.tools ?? [])],
      messages = scenario.initialMessages(),
      data: Record<string, unknown> = {};
    let context = '',
      stage = 'ready';
    let world: World, recording: ReturnType<typeof createTrace<State>>;
    const emit = (e: RuntimeEvent) => {
      if (abort.signal.aborted) return;
      const messages = e.messages?.map(
        ({ role, content, tool_calls, tool_name }) => ({
          role,
          content,
          ...(tool_calls ? { tool_calls } : {}),
          ...(tool_name ? { tool_name } : {}),
        }),
      );
      recording.record({
        ...e,
        ...(messages ? { messages } : {}),
        state: world.snapshot(),
      });
    };
    function reset(
      options: Partial<Initial> & {
        tools?: readonly string[];
        checkpoint?: string;
      } = {},
      checkpointName = options.checkpoint,
    ) {
      abort.abort(new Error('Take reset'));
      abort = new AbortController();
      generation++;
      busy = false;
      const config = settings(),
        checkpoint = checkpoints.get(checkpointName ?? '');
      tools = [
        ...(options.tools ?? checkpoint?.tools ?? meta.initial?.tools ?? []),
      ];
      messages = structuredClone(
        checkpoint?.messages ?? scenario.initialMessages(),
      );
      data = structuredClone(checkpoint?.data ?? {});
      context = '';
      stage = 'ready';
      turn = 0;
      const token = generation;
      world = scenario.createWorld({
        settings: config,
        initial: { ...meta.initial, ...options },
        clock,
        snapshot: checkpoint?.world,
        emit: (e) => {
          if (token === generation && !abort.signal.aborted)
            recording.record(e);
        },
      });
      recording = createTrace({
        initial: world.snapshot(),
        mode: config.mode === 'live' ? 'live' : 'mock',
        provider: config.mode === 'live' ? config.live.model : 'Mock',
        clock,
        emit: (e) => {
          if (token === generation && steps[index].id === meta.id) event(e);
          notify();
        },
      });
      recording.trace.lesson = {
        article: articleId,
        stepId: meta.id,
        step: steps.findIndex((s) => s.id === meta.id) + 1,
        stage,
      };
      recording.record({
        kind: 'checkpoint',
        text: 'Fresh take',
        state: world.snapshot(),
      });
      notify();
    }
    // Construct state only. No evaluation, execution, or browser events on mount/SSR.
    const initial = meta.initial ?? {};
    world = scenario.createWorld({
      settings: settings(),
      initial,
      clock,
      emit: (e) => {
        if (generation === 0 && !abort.signal.aborted) recording.record(e);
      },
    });
    recording = createTrace({
      initial: world.snapshot(),
      mode: settings().mode === 'live' ? 'live' : 'mock',
      provider: settings().mode === 'live' ? settings().live.model : 'Mock',
      clock,
      emit: (e) => {
        if (steps[index].id === meta.id) event(e);
        notify();
      },
    });
    recording.trace.lesson = {
      article: articleId,
      stepId: meta.id,
      step: steps.findIndex((s) => s.id === meta.id) + 1,
      stage,
    };
    const session = {
      meta,
      reset,
      setTools(ids: readonly string[]) {
        tools = [...ids];
        emit({
          kind: 'tools_changed',
          text: `Available tools: ${tools.join(', ') || 'none'}`,
        });
      },
      resetContext(input = scenario.initialMessages()) {
        messages = structuredClone(input);
        context = '';
        emit({ kind: 'context_reset', text: 'Fresh conversation' });
      },
      showContext(value: unknown) {
        context =
          typeof value === 'string'
            ? value
            : JSON.stringify(
                value,
                (key, item) => (key === 'thinking' ? undefined : item),
                2,
              );
        notify();
      },
      showQuestion(text: string) {
        emit({ kind: 'capability_missing', text });
      },
      clearQuestion() {
        emit({
          kind: 'capability_available',
          text: 'Requested capability is available',
        });
      },
      mark(value: string) {
        stage = value;
        recording.trace.lesson!.stage = value;
        notify();
      },
      saveCheckpoint(name: string, extra: Record<string, unknown> = {}) {
        data = { ...data, ...extra };
        checkpoints.set(
          name,
          structuredClone({ world: world.snapshot(), messages, data, tools }),
        );
      },
      restoreCheckpoint(name: string) {
        if (!checkpoints.has(name)) return false;
        reset({}, name);
        return true;
      },
      runtime(block: StoredCode) {
        if (settings().mode === 'replay' || steps[index].id !== meta.id)
          throw new Error('This step is not active');
        const Constructor = block.module.AgentRuntime;
        if (!Constructor) throw new Error(`No AgentRuntime in ${block.id}`);
        const signal = abort.signal,
          token = generation;
        const assertActive = () => {
          signal.throwIfAborted();
          if (generation !== token || steps[index].id !== meta.id)
            throw new Error('Take is no longer active');
        };
        const mock = scenario.mockProvider;
        const provider =
          settings().mode === 'live' ? liveProvider(settings().live) : mock;
        emit({ kind: 'runtime_selected', text: block.id });
        return new Constructor({
          messages,
          tools: scenario.selectTools(world, tools),
          getTools: () => scenario.selectTools(world, tools),
          signal,
          emit: (e) => {
            assertActive();
            emit(e);
          },
          provider: async (input, schemas, requestSignal) => {
            assertActive();
            turn++;
            // This wrapper only observes requests; the selected snapshot supplies all agent behavior.
            emit({
              kind: 'model_start',
              text: 'Provider call pending',
              turn,
              messages: structuredClone([...input]),
              schemas: structuredClone([...schemas]),
            });
            try {
              if (settings().mode === 'mock')
                await clock.sleep(650, requestSignal);
              const reply = await provider(input, schemas, requestSignal);
              assertActive();
              const publicReply = {
                role: reply.role,
                content: reply.content,
                tool_calls: reply.tool_calls,
              };
              emit({
                kind: 'assistant',
                text: reply.content || 'Tool requested',
                tool: publicReply.tool_calls?.[0]?.function,
                turn,
              });
              return reply;
            } finally {
              if (!signal.aborted)
                emit({ kind: 'model_end', text: 'Provider call ended', turn });
            }
          },
        });
      },
      async act(work: () => void | Promise<void>) {
        if (busy || settings().mode === 'replay' || steps[index].id !== meta.id)
          return;
        if (abort.signal.aborted) abort = new AbortController();
        const signal = abort.signal;
        busy = true;
        recording.trace.status = 'running';
        notify();
        try {
          await work();
          signal.throwIfAborted();
          recording.finish(world.snapshot(), stage);
        } catch (error) {
          if (!signal.aborted) {
            emit({
              kind: 'error',
              text: error instanceof Error ? error.message : String(error),
            });
            stage = 'error';
            recording.finish(world.snapshot(), 'error');
          }
        } finally {
          if (signal === abort.signal) {
            busy = false;
            saved(structuredClone(session.trace));
            notify();
          }
        }
      },
      cancel() {
        if (busy) {
          abort.abort(new Error('Step left or mode changed'));
          busy = false;
          recording.finish(world.snapshot(), 'cancelled');
          saved(structuredClone(session.trace));
          notify();
        }
      },
      world: scenario.helpers({
        world: () => world,
        signal: () => abort.signal,
        settings,
      }),
      remember(name: string, value: unknown) {
        artifacts.set(name, structuredClone(value));
        notify();
      },
      recall<T>(name: string): T | undefined {
        const value = artifacts.get(name);
        return value === undefined ? undefined : (structuredClone(value) as T);
      },
      event: emit,
      get settings() {
        return settings();
      },
      get trace() {
        return recording.trace;
      },
      get busy() {
        return busy;
      },
      get messages() {
        return messages;
      },
      get tools() {
        return tools;
      },
      get schemas() {
        return scenario
          .selectTools(world, tools)
          .map((tool) => tool.definition);
      },
      get data() {
        return data;
      },
      get context() {
        return context;
      },
      get stage() {
        return stage;
      },
    };
    return session;
  }
  function get(id: string) {
    if (!sessions.has(id)) {
      const meta = steps.find((s) => s.id === id);
      if (!meta) throw new Error(`Unknown step: ${id}`);
      sessions.set(id, makeSession(meta));
    }
    return sessions.get(id)!;
  }
  return {
    get,
    get current() {
      return get(steps[index].id);
    },
    get index() {
      return index;
    },
    select(next: number) {
      if (index === next) return;
      this.current.cancel();
      index = next;
      const checkpoint = steps[next].initial?.checkpoint;
      if (!visited.has(next) && checkpoint && checkpoints.has(checkpoint))
        this.current.reset({}, checkpoint);
      visited.add(next);
      notify();
    },
    resetAll() {
      this.current.cancel();
      sessions.clear();
      checkpoints.clear();
      artifacts.clear();
      visited.clear();
      visited.add(index);
      epoch++;
      notify();
    },
    subscribe(fn: () => void) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    getRevision: () => revision,
    get epoch() {
      return epoch;
    },
  };
}
