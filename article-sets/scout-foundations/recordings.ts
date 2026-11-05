import type { Snapshot, Trace } from './types.ts';
// Imported recordings are data only; nothing in them is executable.
export function parseTrace(text: string): Trace {
  const trace = JSON.parse(text) as Trace;
  function snapshot(state: Snapshot) {
    return state && Array.isArray(state.position) && state.position.length === 3 && state.position.every(Number.isFinite)
      && [state.pantry?.apple, state.pantry?.carrot, state.basket?.apple, state.basket?.carrot].every(n => Number.isInteger(n) && n >= 0);
  }
  if (trace.version !== 1 || !snapshot(trace.initial) || !Array.isArray(trace.events) || !trace.events.every((e,i) => snapshot(e.state) && Number.isFinite(e.at) && e.at >= 0 && (i === 0 || e.at >= trace.events[i-1].at))) throw new Error('Choose a Scout trace with ordered events and village snapshots.');
  return trace;
}
