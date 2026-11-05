import { realClock } from './types.ts';
import type { Clock, Trace, TraceEvent, WorldEvent } from './types.ts';

export function createTrace<State>({
  initial,
  mode,
  provider,
  clock = realClock,
  emit = () => {},
}: {
  initial: State;
  mode: 'mock' | 'live';
  provider: string;
  clock?: Clock;
  emit?: (event: TraceEvent<State>) => void;
}) {
  const start = clock.now();
  const trace: Trace<State> = {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mode,
    provider,
    startedAt: new Date().toISOString(),
    initial: structuredClone(initial),
    events: [],
    status: 'ready',
  };
  function record(event: WorldEvent<State>) {
    const entry = structuredClone({
      ...event,
      seq: trace.events.length,
      at: clock.now() - start,
    });
    trace.events.push(entry);
    emit(structuredClone(entry));
  }
  function finish(state: State, status: string) {
    trace.status = status;
    trace.final = structuredClone(state);
    record({ kind: 'run_end', text: `Experiment ${status}`, state });
  }
  return { trace, record, finish };
}
