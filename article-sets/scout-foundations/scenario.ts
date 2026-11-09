import { createWorld } from './world.ts';
import type { PickupPolicy } from './world.ts';
import { initialMessages } from './conversation.ts';
import { selectTools } from './tools.ts';
import { mockProvider } from './mock.ts';
import type {
  Scenario,
  ExecutionSettings,
  StepMeta as Meta,
} from '../../runtime/session.ts';
import type { Snapshot, Inventory, Item, Place } from './types.ts';
export interface Settings extends ExecutionSettings {
  order: string;
  apples: number;
}
export interface Initial {
  notice?: string;
  pantry?: Inventory;
  pickupPolicy?: PickupPolicy;
}
export type StepMeta = Meta<Initial>;
const helpers = ({
  world,
  signal,
  settings,
}: {
  world: () => ReturnType<typeof createWorld>;
  signal: () => AbortSignal;
  settings: () => Settings;
}) => ({
  snapshot: () => world().snapshot(),
  postNotice(text = settings().order) {
    if (settings().mode !== 'replay') world().postNotice(text);
  },
  patrol: (requestSignal = signal()) => world().patrol(requestSignal),
  readNotice: (requestSignal = signal()) =>
    world().execute({ name: 'read_notice', arguments: {} }, requestSignal),
  walkTo: (place: Place, requestSignal = signal()) =>
    world().execute({ name: 'walk_to', arguments: { place } }, requestSignal),
  inspectPantry: (requestSignal = signal()) =>
    world().execute({ name: 'inspect_pantry', arguments: {} }, requestSignal),
  takeOne: (item: Item, requestSignal = signal()) =>
    world().execute({ name: 'take_one', arguments: { item } }, requestSignal),
  deliverItem: (requestSignal = signal()) =>
    world().execute({ name: 'deliver_item', arguments: {} }, requestSignal),
  setPantry: (stock: Inventory) => world().setPantry(stock),
});
export const picnicScenario: Scenario<
  Snapshot,
  ReturnType<typeof createWorld>,
  ReturnType<typeof helpers>,
  Settings,
  Initial
> = {
  createWorld: ({ settings, initial, clock, snapshot, emit }) =>
    createWorld({
      notice: initial.notice ?? settings.order,
      pantry: initial.pantry ?? { apple: settings.apples, carrot: 2 },
      clock,
      initial: snapshot,
      pickupPolicy: initial.pickupPolicy,
      emit,
    }),
  helpers,
  selectTools,
  initialMessages,
  mockProvider,
};
