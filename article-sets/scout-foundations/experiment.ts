import { createTrace } from '../../runtime/trace.ts';
import { createAgent } from '../../runtime/loop.ts';
import { realClock } from '../../runtime/types.ts';
import type { Clock, Message, Provider, RuntimeEvent } from '../../runtime/types.ts';
import { createWorld } from './world.ts';
import { allTools, selectTools } from './tools.ts';
import type { Inventory, Snapshot, Trace, TraceEvent } from './types.ts';

export const initialMessages = (): Message[] => [
  { role: 'system', content: 'You are Scout, a village courier. Use only the tools offered. You start beside the noticeboard. Places: noticeboard, pantry, picnic_basket. Choose one tool per turn and wait for its result. Read notices to learn jobs. Pantry stock is unknown until inspected. Report what you actually did. If you lack a tool, explain what you need; do not invent observations.' },
  { role: 'user', content: 'A new notice has been posted on the noticeboard.' },
];

export function createExperiment({ order, pantry, provider, activeTools = allTools, mode = 'mock', providerLabel = 'Mock', clock = realClock, signal = new AbortController().signal, onEvent = () => {}, step = 7, initial }: {
  order: string; pantry: Inventory; provider: Provider; activeTools?: readonly string[];
  mode?: 'mock' | 'live'; providerLabel?: string; clock?: Clock; signal?: AbortSignal;
  onEvent?: (event: TraceEvent) => void; step?: number; initial?: Snapshot;
}) {
  const world = createWorld({ notice: order, pantry, clock, initial, emit: event => recording.record(event) });
  const recording = createTrace({ initial: world.snapshot(), mode, provider: providerLabel, clock, emit: onEvent });
  const trace: Trace = Object.assign(recording.trace, { order, lesson: { step, stage: 'ready' } });
  const show = (event: RuntimeEvent) => recording.record({ ...event, state: world.snapshot() });
  const agent = createAgent({ provider, messages: initialMessages(), tools: selectTools(world, activeTools), signal, emit: show });
  show({ kind: 'run_start', text: 'Fresh checkpoint beside the noticeboard' });
  function finish(status: string) {
    recording.finish(world.snapshot(), status);
    return trace;
  }
  return { world, trace, agent, show, finish };
}
export type Experiment = ReturnType<typeof createExperiment>;

export async function runScout(options: Parameters<typeof createExperiment>[0]): Promise<Trace> {
  const experiment = createExperiment(options);
  try { return experiment.finish(await experiment.agent.run()); }
  catch (error) {
    experiment.show({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    return experiment.finish(options.signal?.aborted ? 'cancelled' : 'error');
  }
}
