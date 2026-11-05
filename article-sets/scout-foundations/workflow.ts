import type { Inventory, Item } from './types.ts';
import { defaultOrder, carrotOrder } from './types.ts';
import type { Message, Provider } from '../../runtime/types.ts';
import type { ScoutStep } from './session.ts';

// A human-authored policy, deliberately outside the world's physical rules.
export function picnicRule(stock: Inventory): Item | null {
  return stock.apple > 1 ? 'apple' : stock.carrot > 0 ? 'carrot' : null;
}
export const ruleExamples = [
  {
    pantry: { apple: 3, carrot: 5 },
    item: 'apple',
    explanation: 'Three apples lets Scout take one and still leave an apple.',
  },
  {
    pantry: { apple: 1, carrot: 1 },
    item: 'carrot',
    explanation:
      'Taking the only apple would break the notice’s instruction. A carrot is available.',
  },
  {
    pantry: { apple: 0, carrot: 3 },
    item: 'carrot',
    explanation:
      'There are no apples, so the rule chooses an available carrot.',
  },
] as const;

export async function scriptedObservation<T extends Record<string, unknown>>(
  s: ScoutStep,
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  s.event({ kind: 'scripted_action', text: `Script: ${name}` });
  const result = await operation();
  s.event({ kind: 'scripted_result', text: JSON.stringify(result), result });
  if (!result.ok) throw new Error(String(result.reason ?? `${name} failed`));
  return result;
}

// The workflow supplies these observations. It does not ask the provider to plan a route.
export function decisionMessages(notice: string, pantry: Inventory): Message[] {
  return [
    {
      role: 'system',
      content:
        'Choose one item for this picnic order using the observations supplied by the workflow. Request take_one with apple or carrot. Choose one action only. You do not control reading, inspection, navigation, or delivery. If no item meets the order, explain why.',
    },
    { role: 'user', content: JSON.stringify({ notice, pantry }) },
  ];
}
export const workflowDecisionMock: Provider = async (
  messages,
  schemas,
  signal,
) => {
  signal.throwIfAborted();
  const input = messages.findLast((message) => message.role === 'user');
  const observed = input
    ? (JSON.parse(input.content) as { notice: string; pantry: Inventory })
    : null;
  if (
    !observed ||
    !schemas.some((schema) => schema.function.name === 'take_one')
  )
    return {
      role: 'assistant',
      content:
        'The workflow has not supplied an item choice capability and observations.',
    };
  const normalize = (text: string) =>
    text.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.!]$/, '');
  const order = normalize(observed.notice);
  if (![normalize(defaultOrder), normalize(carrotOrder)].includes(order))
    return {
      role: 'assistant',
      content:
        'Mock supports the default picnic order and the explicit carrot order.',
    };
  const item =
    order === normalize(carrotOrder)
      ? observed.pantry.carrot > 0
        ? 'carrot'
        : null
      : picnicRule(observed.pantry);
  return item
    ? {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'take_one', arguments: { item } } }],
      }
    : {
        role: 'assistant',
        content: 'There is no item available that meets this order.',
      };
};

export async function chooseAndTake(
  s: ScoutStep,
  notice: string,
  pantry: Inventory,
) {
  s.resetContext(decisionMessages(notice, pantry));
  s.setTools(['take_one']);
  const request = await s.callProvider(
    s.messages,
    s.schemas,
    workflowDecisionMock,
  );
  const calls = request.tool_calls ?? [];
  if (!calls.length)
    throw new Error(request.content || 'The provider did not choose an item.');
  if (calls.length !== 1 || calls[0].function.name !== 'take_one')
    throw new Error('The workflow offers one pickup action only.');
  const call = calls[0].function;
  s.event({ kind: 'tool_start', text: call.name, tool: call });
  const result = await s.world.takeOne(call.arguments.item as Item);
  s.event({
    kind: 'tool_result',
    text: JSON.stringify(result),
    tool: call,
    result,
  });
  s.messages.push(request, {
    role: 'tool',
    tool_name: call.name,
    content: JSON.stringify(result),
  });
  s.event({
    kind: 'context',
    text: 'The selected pickup result',
    messages: s.messages,
  });
  if (!result.ok) throw new Error(String(result.reason));
  return result.item as Item;
}
