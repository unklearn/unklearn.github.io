import type { Message, Provider, RuntimeEvent, Tool } from './types.ts';
export interface Feedback { request: Message; result: Message; value: Record<string, unknown> }
export interface RuntimeOptions {
  provider: Provider; messages: Message[]; tools: readonly Tool[]; signal: AbortSignal;
  emit: (event: RuntimeEvent) => void;
}
export interface RuntimeInstance {
  evaluate(): Promise<Message>;
  execute?(request: Message): Promise<Feedback | null>;
  append?(feedback: Feedback): void;
  run?(afterTool?: (feedback: Feedback) => Promise<boolean | void>): Promise<string>;
}
export interface StoredCode {
  id: string; kind: 'runtime' | 'setup'; source: string;
  module: { AgentRuntime?: new (options: RuntimeOptions) => RuntimeInstance; tools?: readonly string[] };
}
