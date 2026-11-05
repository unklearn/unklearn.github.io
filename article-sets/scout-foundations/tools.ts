import type { Tool, ToolDefinition } from '../../runtime/types.ts';
import type { World } from './world.ts';

const emptyArgs = { type: 'object', properties: {}, additionalProperties: false };
const readNotice: ToolDefinition = { type: 'function', function: {
  name: 'read_notice', description: 'Read the nearby noticeboard. Returns its exact text.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
} };
const definitions = [
  readNotice,
  { type: 'function', function: { name: 'walk_to', description: 'Walk a named path; returns after arrival.', parameters: { type: 'object', properties: { place: { type: 'string', enum: ['noticeboard', 'pantry', 'picnic_basket'] } }, required: ['place'], additionalProperties: false } } },
  { type: 'function', function: { name: 'inspect_pantry', description: 'Inspect the nearby pantry to learn stock counts.', parameters: emptyArgs } },
  { type: 'function', function: { name: 'take_one', description: 'Pick up one available item nearby. Carry at most one.', parameters: { type: 'object', properties: { item: { type: 'string', enum: ['apple', 'carrot'] } }, required: ['item'], additionalProperties: false } } },
  { type: 'function', function: { name: 'deliver_item', description: 'Put the carried item in the nearby picnic basket.', parameters: emptyArgs } },
] satisfies ToolDefinition[];
export const allTools = definitions.map(d => d.function.name);
export const readSchema = readNotice;
export function selectTools(world: World, ids: readonly string[]): Tool[] {
  return ids.map(id => {
    const definition = definitions.find(d => d.function.name === id);
    if (!definition) throw new Error(`Unknown tool: ${id}`);
    return { definition, execute: (args, signal) => world.execute({ name: id, arguments: args }, signal) };
  });
}
