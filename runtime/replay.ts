import type { Trace, TraceEvent } from './types.ts';

// Replay owns a playhead, not a World or a Provider. No tools can run from here.
export function createReplay<State>(
  trace: Trace<State>,
  emit: (event: TraceEvent<State>, elapsed: number) => void,
) {
  let elapsed = 0,
    cursor = 0,
    playing = false;
  const duration = trace.events.at(-1)?.at ?? 0;
  const flush = () => {
    while (cursor < trace.events.length && trace.events[cursor].at <= elapsed) {
      const event = trace.events[cursor++];
      emit(structuredClone(event), elapsed - event.at);
    }
  };
  return {
    get playing() {
      return playing;
    },
    get elapsed() {
      return elapsed;
    },
    get duration() {
      return duration;
    },
    play() {
      playing = true;
      flush();
    },
    pause() {
      playing = false;
    },
    restart() {
      elapsed = 0;
      cursor = 0;
      playing = false;
      flush();
    },
    seek(at: number, seq = Infinity) {
      elapsed = Math.max(0, Math.min(duration, at));
      cursor = 0;
      playing = false;
      while (
        cursor < trace.events.length &&
        trace.events[cursor].at <= elapsed &&
        trace.events[cursor].seq <= seq
      ) {
        const event = trace.events[cursor++];
        emit(structuredClone(event), elapsed - event.at);
      }
    },
    advance(ms: number) {
      if (!playing) return;
      elapsed = Math.min(duration, elapsed + Math.max(0, ms));
      flush();
      if (elapsed >= duration) playing = false;
    },
  };
}
