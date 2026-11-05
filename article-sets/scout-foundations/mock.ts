import type { Message, Provider } from '../../runtime/types.ts';
import { defaultOrder, carrotOrder } from './types.ts';
const action = (name: string, args: Record<string, unknown> = {}): Message => ({ role: 'assistant', content: '', tool_calls: [{ function: { name, arguments: args } }] });
const report = (content: string): Message => ({ role: 'assistant', content });
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.!]$/, '');

// Lesson-authored deterministic dialogue, not a language model or hidden reasoning.
// Its only inputs are the conversation and available tool schemas.
export function createMockProvider(unreadNoticeIntent = 'I need a way to read that notice.'): Provider {
  return async (messages, tools, signal) => {
    signal.throwIfAborted();
    const available = (name: string) => tools.some(t => t.function.name === name);
    const observations = messages.filter(m => m.role === 'tool').map(m => ({ name: m.tool_name, result: JSON.parse(m.content) }));
    const observed = (name: string) => observations.findLast(o => o.name === name && o.result.ok)?.result;
    const notice = observed('read_notice')?.notice as string | undefined;
    if (notice === undefined) return available('read_notice') ? action('read_notice') : report(unreadNoticeIntent);
    const order = normalize(notice);
    if (![normalize(defaultOrder), normalize(carrotOrder)].includes(order)) return report('Mock supports the default picnic order and “Deliver one carrot to the picnic basket.” Choose Live for another order.');
    if (!available('walk_to')) return report(`I can now read the order: “${notice}” I need movement and pantry tools to carry it out.`);
    const delivered = observed('deliver_item');
    if (delivered) return report(`I delivered one ${delivered.item} to the picnic basket.`);
    const location = observed('walk_to')?.place ?? 'noticeboard';
    if (observed('take_one')) return location === 'picnic_basket' ? action('deliver_item') : action('walk_to', { place: 'picnic_basket' });
    if (location !== 'pantry') return action('walk_to', { place: 'pantry' });
    const last = observations.at(-1);
    if (last?.result.reason === 'out_of_stock') return action('inspect_pantry');
    if (last?.result.ok === false) return report(`I stopped: ${last.result.reason}`);
    const stock = observed('inspect_pantry')?.pantry;
    if (!stock) return action('inspect_pantry');
    // The instruction belongs here, in the decision maker. Taking the last apple is legal in the world.
    const item = order === normalize(carrotOrder) ? 'carrot' : stock.apple > 1 ? 'apple' : 'carrot';
    return stock[item] > 0 ? action('take_one', { item }) : report(`There is no ${item} available for this order.`);
  };
  
}
export const mockProvider = createMockProvider();
