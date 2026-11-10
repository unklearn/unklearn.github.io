import type { DatabaseSync } from 'node:sqlite';
import { withdrawItem } from './inventory.ts';
import type { Withdrawal, WithdrawalResult } from './inventory.ts';

export type HostContext = {
  caller: { id: string; withdrawTaskIds: readonly string[] };
  taskId: string;
  operationId: string;
};

export type DispatchResult =
  WithdrawalResult | { code: 'UNKNOWN_TOOL' | 'UNAUTHORIZED' };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseWithdrawal(value: unknown): Withdrawal | undefined {
  if (
    !isObject(value) ||
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, 'itemId') ||
    !Object.hasOwn(value, 'quantity')
  )
    return;
  const { itemId, quantity } = value;
  if (
    typeof itemId !== 'string' ||
    itemId.length < 1 ||
    typeof quantity !== 'number' ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  )
    return;
  return { itemId, quantity };
}

const tools = {
  withdrawItem: {
    name: 'withdrawItem',
    description: 'Transfer stock from the pantry to Scout’s inventory.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', minLength: 1 },
        quantity: {
          type: 'integer',
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        },
      },
      required: ['itemId', 'quantity'],
      additionalProperties: false,
    },
    guidance: {
      inventoryRule: 'Preserve each item’s configured reserve minimum.',
      decisionHint:
        'Use the observed stock counts before proposing a withdrawal.',
    },
    parse: parseWithdrawal,
    handle: withdrawItem,
  },
} as const;

export function modelToolDefinition() {
  const { name, description, guidance, parameters } = tools.withdrawItem;
  return {
    name,
    description: [
      description,
      guidance.inventoryRule,
      guidance.decisionHint,
    ].join(' '),
    parameters,
  };
}

export function dispatch(
  db: DatabaseSync,
  host: HostContext,
  proposal: unknown,
): DispatchResult {
  if (!isObject(proposal) || proposal.name !== tools.withdrawItem.name)
    return { code: 'UNKNOWN_TOOL' };
  const args = tools.withdrawItem.parse(proposal.arguments);
  if (!args) return { code: 'INVALID_ARGUMENTS' };
  const { caller, taskId, operationId } = host;
  if (!caller.withdrawTaskIds.includes(taskId)) return { code: 'UNAUTHORIZED' };
  return tools.withdrawItem.handle(
    db,
    { callerId: caller.id, taskId, operationId },
    args,
  );
}
