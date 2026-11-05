import { createWorld } from './world.ts';
import { initialMessages } from './conversation.ts';
import { selectTools } from './tools.ts';
import { mockProvider } from './mock.ts';
import type { Scenario, ExecutionSettings, StepMeta as Meta } from '../../runtime/session.ts';
import type { Snapshot, Inventory, Item, Place } from './types.ts';
export interface Settings extends ExecutionSettings { order: string; apples: number }
export interface Initial { notice?: string; pantry?: Inventory }
export type StepMeta = Meta<Initial>;
const helpers = ({world,signal,settings}: {world:()=>ReturnType<typeof createWorld>;signal:()=>AbortSignal;settings:()=>Settings}) => ({
  snapshot: () => world().snapshot(),
  postNotice(text=settings().order) { if(settings().mode!=='replay') world().postNotice(text); },
  patrol: () => world().patrol(signal()),
  walkTo: (place:Place) => world().execute({name:'walk_to',arguments:{place}},signal()),
  inspectPantry: () => world().execute({name:'inspect_pantry',arguments:{}},signal()),
  takeOne: (item:Item) => world().execute({name:'take_one',arguments:{item}},signal()),
  deliverItem: () => world().execute({name:'deliver_item',arguments:{}},signal()),
  setPantry: (stock:Inventory) => world().setPantry(stock),
});
export const picnicScenario: Scenario<Snapshot,ReturnType<typeof createWorld>,ReturnType<typeof helpers>,Settings,Initial> = {
  createWorld: ({settings,initial,clock,snapshot,emit}) => createWorld({notice:initial.notice??settings.order,pantry:initial.pantry??{apple:settings.apples,carrot:2},clock,initial:snapshot,emit}),
  helpers, selectTools, initialMessages, mockProvider,
};
