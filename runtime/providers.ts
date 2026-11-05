import { carrotOrder, defaultOrder } from './types.ts';
import type { Message, Provider } from './types.ts';

const action = (name: string, args: Record<string, unknown> = {}): Message => ({
  role: 'assistant', content: '', tool_calls: [{ function: { name, arguments: args } }],
});
const report = (content: string): Message => ({ role: 'assistant', content });
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.!]$/, '');

// This is deliberately a small, explainable provider, not a language model.
// Every decision is derived from messages. No world, preset, or step counter enters here.
export const mockProvider: Provider = async (messages, _tools, signal) => {
  signal.throwIfAborted();
  const observations = messages.filter(m => m.role === 'tool').map(m => ({
    name: m.tool_name, result: JSON.parse(m.content),
  }));
  const last = observations.at(-1);
  if (last?.result.ok === false) return report(`I stopped: ${last.result.reason}`);
  const observed = (name: string) => observations.findLast(o => o.name === name && o.result.ok)?.result;
  const notice = observed('read_notice')?.notice as string | undefined;
  if (notice === undefined) return action('read_notice');
  const order = normalize(notice);
  if (order !== normalize(defaultOrder) && order !== normalize(carrotOrder)) {
    return report('Mock understands the picnic preference and “Deliver one carrot to the picnic basket.” Try either, or use Live for another order.');
  }
  const delivered = observed('deliver_item');
  if (delivered) return report(`I delivered one ${delivered.item} to the picnic basket.`);
  const location = observed('walk_to')?.place ?? 'noticeboard';
  const pickup = observed('take_one');
  if (pickup) return location === 'picnic_basket' ? action('deliver_item') : action('walk_to', { place: 'picnic_basket' });
  if (location !== 'pantry') return action('walk_to', { place: 'pantry' });
  const stock = observed('inspect_pantry')?.pantry;
  if (!stock) return action('inspect_pantry');
  // The mock interprets the supported notice here. The world has no preference rule.
  const item = order === normalize(carrotOrder) ? 'carrot' : stock.apple > 1 ? 'apple' : 'carrot';
  return stock[item] > 0 ? action('take_one', { item }) : report(`There is no ${item} available for this order.`);
};

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
    const endpoint = settings.transport === 'gateway' ? settings.endpoint : new URL('/api/chat', settings.endpoint).href;
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(settings.timeoutMs ?? 180000)]),
      body: JSON.stringify({
        model: settings.model, messages, tools, stream: false,
        ...(settings.transport === 'gateway' ? {} : { think: settings.think ?? false, options: { temperature: 0, num_ctx: 4096 } }),
      }),
    });
    if (!response.ok) throw new Error(`Provider ${response.status}: ${(await response.text()).slice(0, 250)}`);
    const data = await response.json();
    if (data.error || data.message?.role !== 'assistant') throw new Error(data.error || 'Missing assistant message.');
    if (data.done_reason === 'length') throw new Error('Provider reached its output limit; no partial action executed.');
    // Preserve the original reply in conversation history, including provider thinking.
    // The loop never copies private thinking into the public trace.
    return data.message;
  };
}
