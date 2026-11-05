import type { Provider } from './types.ts';

export interface LiveSettings {
  endpoint: string;
  model: string;
  think?: boolean;
  timeoutMs?: number;
  transport?: 'ollama' | 'gateway';
}

// A gateway accepts { model, messages, tools } and returns { message: AssistantMessage }.
// It may hold hosted credentials; it receives no authoritative world state.
export function liveProvider(settings: LiveSettings): Provider {
  return async (messages, tools, signal) => {
    const endpoint =
      settings.transport === 'gateway'
        ? settings.endpoint
        : new URL('/api/chat', settings.endpoint).href;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(settings.timeoutMs ?? 180000),
      ]),
      body: JSON.stringify({
        model: settings.model,
        messages,
        tools,
        stream: false,
        ...(settings.transport === 'gateway'
          ? {}
          : {
              think: settings.think ?? false,
              options: { temperature: 0, num_ctx: 4096 },
            }),
      }),
    });
    if (!response.ok)
      throw new Error(
        `Provider ${response.status}: ${(await response.text()).slice(0, 250)}`,
      );
    const data = await response.json();
    if (data.error || data.message?.role !== 'assistant')
      throw new Error(data.error || 'Missing assistant message.');
    if (data.done_reason === 'length')
      throw new Error(
        'Provider reached its output limit; no partial action executed.',
      );
    // Preserve the original reply in conversation history, including provider thinking.
    // The loop never copies private thinking into the public trace.
    return data.message;
  };
}
