import { distance, paths, places } from './types.ts';
import { realClock } from '../../runtime/types.ts';
import type { Clock, ToolCall } from '../../runtime/types.ts';
import type {
  Inventory,
  Item,
  Place,
  Point,
  Snapshot,
  WorldEvent,
} from './types.ts';

export function createWorld({
  notice,
  pantry,
  clock = realClock,
  emit = () => {},
  initial,
}: {
  notice: string;
  pantry: Inventory;
  clock?: Clock;
  emit?: (event: WorldEvent) => void;
  initial?: Snapshot;
}) {
  const state: Snapshot = {
    notice,
    unread: !!notice,
    pantry: { ...pantry },
    basket: { apple: 0, carrot: 0 },
    carried: null,
    place: 'noticeboard',
    position: [...places.noticeboard],
  };
  if (initial) Object.assign(state, structuredClone(initial));
  const snapshot = (): Snapshot => structuredClone(state);
  const show = (
    kind: string,
    text: string,
    movement?: WorldEvent['movement'],
  ) =>
    emit({ kind, text, state: snapshot(), ...(movement ? { movement } : {}) });
  const near = (place: Place) =>
    distance(state.position, places[place]) < 0.9 && state.place === place;
  const fail = (reason: string) => ({ ok: false, reason });

  async function execute(
    call: ToolCall['function'],
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    const args = call.arguments;
    if (!args || typeof args !== 'object' || Array.isArray(args))
      return fail('Expected tool arguments.');
    if (call.name === 'walk_to') {
      const place = args.place as Place;
      if (!Object.hasOwn(places, place))
        return fail('Choose noticeboard, pantry, or picnic_basket.');
      if (near(place)) return { ok: true, place };
      const from = state.place;
      if (!from) return fail('Scout is already walking.');
      const route: Point[] = [
        state.position,
        ...paths[from].slice(0, -1).reverse(),
        ...paths[place].slice(1),
      ];
      const path = route.filter(
        (p, i) => i === 0 || distance(p, route[i - 1]) > 0.01,
      );
      const length = path
        .slice(1)
        .reduce((sum, p, i) => sum + distance(path[i], p), 0);
      const duration = (length / 1.65) * 1000;
      state.place = null;
      show('walk_start', `Walking to ${place.replaceAll('_', ' ')}`, {
        path,
        duration,
      });
      try {
        await clock.sleep(duration, signal);
        signal.throwIfAborted();
      } catch (error) {
        state.place = from;
        show('walk_cancelled', 'Walk cancelled');
        throw error;
      }
      state.position = [...places[place]];
      state.place = place;
      show('walk_end', `Arrived at ${place.replaceAll('_', ' ')}`);
      return { ok: true, place };
    }
    if (call.name === 'read_notice') {
      if (!near('noticeboard')) return fail('Walk to the noticeboard first.');
      show('read', 'Reading the posted notice');
      await clock.sleep(1100, signal);
      state.unread = false;
      show('notice_read', 'Notice read; board light cleared');
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
      if (item !== 'apple' && item !== 'carrot')
        return fail('Choose apple or carrot.');
      if (state.carried) return fail('Scout is already carrying an item.');
      if (state.pantry[item] < 1) return fail('out_of_stock');
      await clock.sleep(650, signal);
      signal.throwIfAborted();
      if (state.pantry[item] < 1) return fail('out_of_stock');
      // Physical availability is the only stock rule. The last apple is legal.
      state.pantry[item]--;
      state.carried = item;
      show('pickup', `Picked up one ${item}`);
      return { ok: true, item, carried: item };
    }
    if (call.name === 'deliver_item') {
      if (!near('picnic_basket'))
        return fail('Walk to the picnic basket first.');
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
  function postNotice(text: string) {
    state.notice = text;
    state.unread = true;
    show('notice_posted', 'New notice posted; amber light on');
  }
  function setPantry(stock: Inventory) {
    state.pantry = { ...stock };
    show(
      'shelf_change',
      'Reader changed the pantry. Scout has not observed this change.',
    );
  }
  function emptyApples() {
    state.pantry.apple = 0;
    show(
      'shelf_change',
      'Reader emptied the apple shelf. Scout has not observed this change.',
    );
  }
  async function patrol(signal: AbortSignal) {
    signal.throwIfAborted();
    if (!near('noticeboard'))
      await execute(
        { name: 'walk_to', arguments: { place: 'noticeboard' } },
        signal,
      );
    const path: Point[] = [
      [-4.1, 0.45, 1.6],
      [-2.2, 0.45, 2.5],
      [-4.6, 0.45, 3.1],
      [-4.1, 0.45, 1.6],
    ];
    state.place = null;
    show('walk_start', 'Scripted patrol', { path, duration: 7000 });
    try {
      await clock.sleep(7000, signal);
      signal.throwIfAborted();
    } catch (error) {
      state.place = 'noticeboard';
      state.position = [...places.noticeboard];
      show('walk_cancelled', 'Patrol cancelled');
      throw error;
    }
    state.place = 'noticeboard';
    state.position = [...places.noticeboard];
    show('patrol_pass', 'Scout passed the noticeboard without reading.');
  }
  return { snapshot, execute, postNotice, setPantry, emptyApples, patrol };
}

export type World = ReturnType<typeof createWorld>;
