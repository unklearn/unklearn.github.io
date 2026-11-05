// The harness knows messages and selected tools, never Scout or pantry stock.
export interface ToolCall { function: { name: string; arguments: Record<string, unknown> } }
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'; content: string;
  tool_calls?: ToolCall[]; tool_name?: string; thinking?: string;
}
export interface ToolDefinition {
  type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> };
}
export type Provider = (messages: readonly Message[], tools: readonly ToolDefinition[], signal: AbortSignal) => Promise<Message>;
export interface Tool { definition: ToolDefinition; execute(args: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown>> }
export interface Clock { now(): number; sleep(ms: number, signal: AbortSignal): Promise<void> }
export interface Movement { path: [number, number, number][]; duration: number }
export interface RuntimeEvent {
  kind: string; text: string; turn?: number; tool?: ToolCall['function'];
  result?: Record<string, unknown>; messages?: Message[]; schemas?: ToolDefinition[];
}
export interface WorldEvent<State> extends RuntimeEvent { state: State; movement?: Movement }
export interface TraceEvent<State> extends WorldEvent<State> { seq: number; at: number }
export interface Trace<State> {
  version: 1; id: string; mode: 'mock' | 'live'; provider: string; startedAt: string;
  initial: State; events: TraceEvent<State>[]; final?: State; status: string;
  lesson?: { step: number; stage: string; article?: string; stepId?: string };
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep(ms, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  },
};
