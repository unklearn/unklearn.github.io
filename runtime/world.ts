import { distance, paths, places, realClock } from './types.ts';
import type { Clock, Inventory, Item, Place, Point, Snapshot, ToolCall, WorldEvent } from './types.ts';

export function createWorld({ notice, pantry, clock = realClock, emit = () => {} }: {
  notice: string; pantry: Inventory; clock?: Clock; emit?: (event: WorldEvent) => void;
}) {
  const state: Snapshot = {
    notice, pantry: { ...pantry }, basket: { apple: 0, carrot: 0 },
    carried: null, place: 'noticeboard', position: [...places.noticeboard],
  };
  const snapshot = (): Snapshot => structuredClone(state);
  const show = (kind: string, text: string, movement?: WorldEvent['movement']) => emit({ kind, text, state: snapshot(), ...(movement ? { movement } : {}) });
  const near = (place: Place) => distance(state.position, places[place]) < 0.9 && state.place === place;
  const fail = (reason: string) => ({ ok: false, reason });

  async function execute(call: ToolCall['function'], signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    const args = call.arguments;
    if (!args || typeof args !== 'object' || Array.isArray(args)) return fail('Expected tool arguments.');
    if (call.name === 'walk_to') {
      const place = args.place as Place;
      if (!Object.hasOwn(places, place)) return fail('Choose noticeboard, pantry, or picnic_basket.');
      if (near(place)) return { ok: true, place };
      const from = state.place;
      if (!from) return fail('Scout is already walking.');
      const route: Point[] = [state.position, ...paths[from].slice(0, -1).reverse(), ...paths[place].slice(1)];
      const path = route.filter((p, i) => i === 0 || distance(p, route[i - 1]) > 0.01);
      const length = path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
      const duration = length / 1.65 * 1000;
      state.place = null;
      show('walk_start', `Walking to ${place.replaceAll('_', ' ')}`, { path, duration });
      await clock.sleep(duration, signal);
      signal.throwIfAborted();
      state.position = [...places[place]];
      state.place = place;
      show('walk_end', `Arrived at ${place.replaceAll('_', ' ')}`);
      return { ok: true, place };
    }
    if (call.name === 'read_notice') {
      if (!near('noticeboard')) return fail('Walk to the noticeboard first.');
      show('read', 'Reading the posted notice');
      await clock.sleep(1100, signal);
      return { ok: true, notice: state.notice };
    }
    if (call.name === 'inspect_pantry') {
      if (!near('pantry')) return fail('Walk to the pantry first.');
      show('inspect', 'Looking inside the pantry');
      await clock.sleep(1300, signal);
      return { ok: true, pantry: { ...state.pantry } };
    }
    if (call.name === 'take_one') {
      if (!near('pantry')) return fail('Walk to the pantry first.');
      const item = args.item as Item;
      if (item !== 'apple' && item !== 'carrot') return fail('Choose apple or carrot.');
      if (state.carried) return fail('Scout is already carrying an item.');
      if (state.pantry[item] < 1) return fail('That item is out of stock.');
      await clock.sleep(650, signal);
      signal.throwIfAborted();
      // Physical availability is the only stock rule. The last apple is legal.
      state.pantry[item]--;
      state.carried = item;
      show('pickup', `Picked up one ${item}`);
      return { ok: true, item, carried: item };
    }
    if (call.name === 'deliver_item') {
      if (!near('picnic_basket')) return fail('Walk to the picnic basket first.');
      if (!state.carried) return fail('Scout has nothing to deliver.');
      await clock.sleep(650, signal);
      signal.throwIfAborted();
      const item = state.carried;
      state.basket[item]++;
      state.carried = null;
      show('delivery', `Delivered one ${item} to the picnic basket`);
      return { ok: true, item, basket: { ...state.basket }, carried: null };
    }
    return fail('Unknown tool.');
  }
  return { snapshot, execute };
}

export type World = ReturnType<typeof createWorld>;
