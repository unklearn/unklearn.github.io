import type { Trace, TraceEvent } from './types.ts';

export type ReplayCue = Pick<TraceEvent<unknown>, 'at' | 'seq'>;

// Replay owns a playhead, not a World or a Provider. No tools can run from here.
export function createReplay<State>(
  trace: Trace<State>,
  emit: (event: TraceEvent<State>, elapsed: number) => void,
) {
  let elapsed = 0,
    cursor = 0,
    playing = false;
  let cue: ReplayCue | undefined;
  let pausedAtCue = false;
  const duration = trace.events.at(-1)?.at ?? 0;
  const flush = () => {
    while (
      cursor < trace.events.length &&
      trace.events[cursor].at <= elapsed &&
      trace.events[cursor].seq <= (cue?.seq ?? Infinity)
    ) {
      const event = trace.events[cursor++];
      emit(structuredClone(event), elapsed - event.at);
    }
  };
  function advance(ms: number) {
    if (!playing) return;
    elapsed = Math.min(cue?.at ?? duration, elapsed + Math.max(0, ms));
    flush();
    if (cue && elapsed >= cue.at) {
      playing = false;
      pausedAtCue = true;
      cue = undefined;
    } else if (elapsed >= duration) playing = false;
  }
  function play() {
    pausedAtCue = false;
    playing = true;
    advance(0);
  }
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
    get currentEvent() {
      return trace.events[cursor - 1];
    },
    get pausedAtCue() {
      return pausedAtCue;
    },
    play,
    playTo(target: ReplayCue) {
      cue = target;
      play();
    },
    pause() {
      playing = false;
    },
    restart() {
      elapsed = 0;
      cursor = 0;
      playing = false;
      cue = undefined;
      pausedAtCue = false;
      flush();
    },
    seek(at: number, seq = Infinity) {
      elapsed = Math.max(0, Math.min(duration, at));
      cursor = 0;
      playing = false;
      cue = undefined;
      pausedAtCue = false;
      while (
        cursor < trace.events.length &&
        trace.events[cursor].at <= elapsed &&
        trace.events[cursor].seq <= seq
      ) {
        const event = trace.events[cursor++];
        emit(structuredClone(event), elapsed - event.at);
      }
    },
    advance,
  };
}
