import type { Message, Provider, RuntimeEvent, Tool } from './types.ts';
export interface Feedback {
  request: Message;
  result: Message;
  value: Record<string, unknown>;
}
export interface RuntimeOptions {
  provider: Provider;
  messages: Message[];
  tools: readonly Tool[];
  signal: AbortSignal;
  getTools?: () => readonly Tool[];
  emit: (event: RuntimeEvent) => void;
}
export interface RuntimeInstance {
  evaluate(): Promise<Message>;
  execute?(request: Message): Promise<Feedback | null>;
  append?(feedback: Feedback): void;
  run?(): Promise<string>;
}
export interface StoredCode {
  id: string;
  kind: 'runtime' | 'setup' | 'experiment';
  source: string;
  module: {
    AgentRuntime?: new (options: RuntimeOptions) => RuntimeInstance;
    tools?: readonly string[];
    run?: (session: unknown, ...args: unknown[]) => Promise<unknown>;
  };
}
