import type { ToolCall } from '../../runtime/types.ts';

export type Item = 'apple' | 'carrot';
export type Stock = Readonly<Record<Item, number>>;
export interface InventoryState {
  readonly pantry: Stock;
  readonly scout: Stock;
  readonly basket?: Stock;
}
export type Strategy = 'guidance' | 'evaluate' | 'guard' | 'domain';
export interface ExperimentConfig {
  apples: 1 | 2 | 3;
  carrots: 0 | 2;
  strategy: Strategy;
  proposal: Item;
  continueAfterRejection: boolean;
}
export const defaultConfig: Readonly<ExperimentConfig> = Object.freeze({
  apples: 1,
  carrots: 2,
  strategy: 'guidance',
  proposal: 'apple',
  continueAfterRejection: false,
});
export const reservedMinimum = 1;
export const simulationNotice =
  'Pack one item for the picnic. Prefer an apple, but leave at least one apple in the pantry. Otherwise take one carrot.';

export type Execution =
  | 'pending'
  | 'succeeded'
  | 'invalid-request'
  | 'dispatcher-rejected'
  | 'inventory-rejected';
export type Outcome =
  'pending' | 'complete' | 'violated' | 'incomplete' | 'blocked';
export interface Evidence {
  readonly execution: Execution;
  readonly transfer: 'pending' | 'verified' | 'none' | 'unverified';
  readonly outcome: Outcome;
}
export const pendingEvidence: Evidence = Object.freeze({
  execution: 'pending',
  transfer: 'pending',
  outcome: 'pending',
});
export interface Frame {
  readonly kind:
    | 'notice'
    | 'inspection'
    | 'request'
    | 'result'
    | 'policy'
    | 'delivery'
    | 'report';
  readonly title: string;
  readonly description: string;
  readonly state: InventoryState;
  readonly evidence: Evidence;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly source?: string;
}
export interface ExperimentRun {
  readonly id: string;
  readonly frames: readonly Frame[];
}

export function immutable<T extends object>(value: T): Readonly<T> {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Object.isFrozen(child))
      immutable(child);
  }
  return Object.freeze(value);
}

// excerpt:outcome
export function evaluateOutcome(state: InventoryState): Outcome {
  if (state.pantry.apple < reservedMinimum) return 'violated';
  const collected =
    state.scout.apple +
    state.scout.carrot +
    (state.basket?.apple ?? 0) +
    (state.basket?.carrot ?? 0);
  if (collected === 1) return 'complete';
  if (
    collected === 0 &&
    state.pantry.apple === reservedMinimum &&
    state.pantry.carrot === 0
  )
    return 'blocked';
  return 'incomplete';
}
// end:outcome

export function verifiedPickup(
  before: InventoryState,
  after: InventoryState,
  item: Item,
) {
  return (['apple', 'carrot'] as const).every((kind) => {
    const amount = kind === item ? 1 : 0;
    return (
      before.pantry[kind] - after.pantry[kind] === amount &&
      after.scout[kind] - before.scout[kind] === amount &&
      (before.basket?.[kind] ?? 0) === (after.basket?.[kind] ?? 0)
    );
  });
}

type Withdrawal =
  | { ok: true; item: Item; operationCalled: true }
  | {
      ok: false;
      operationCalled: boolean;
      source: 'validation' | 'dispatcher' | 'inventory';
      reason:
        | 'invalid_arguments'
        | 'unknown_tool'
        | 'reserve_minimum'
        | 'out_of_stock'
        | 'already_carrying';
    };

export function createInventory(initial: Stock, enforceReserve: boolean) {
  const pantry = { ...initial },
    scout = { apple: 0, carrot: 0 };
  // excerpt:withdraw
  function withdraw(item: Item): Withdrawal {
    const refuse = (
      reason: 'already_carrying' | 'out_of_stock' | 'reserve_minimum',
    ): Withdrawal => ({
      ok: false,
      source: 'inventory',
      reason,
      operationCalled: true,
    });
    if (scout.apple + scout.carrot > 0) return refuse('already_carrying');
    if (pantry[item] < 1) return refuse('out_of_stock');
    if (
      enforceReserve &&
      item === 'apple' &&
      pantry.apple - 1 < reservedMinimum
    )
      return refuse('reserve_minimum');
    pantry[item]--;
    scout[item]++;
    return { ok: true, item, operationCalled: true };
  }
  // end:withdraw
  return {
    snapshot: (): InventoryState =>
      immutable({ pantry: { ...pantry }, scout: { ...scout } }),
    withdraw,
  };
}

// excerpt:arguments
function itemArgument(args: unknown): Item | undefined {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return;
  if (!('item' in args) || Object.keys(args).length !== 1) return;
  if (args.item === 'apple' || args.item === 'carrot') return args.item;
}
// end:arguments

// excerpt:guard
export function dispatch(
  inventory: ReturnType<typeof createInventory>,
  strategy: Strategy,
  request: { name: string; arguments: unknown },
): Withdrawal {
  if (request.name !== 'take_one')
    return {
      ok: false,
      source: 'validation',
      reason: 'unknown_tool',
      operationCalled: false,
    };
  const item = itemArgument(request.arguments);
  if (!item)
    return {
      ok: false,
      source: 'validation',
      reason: 'invalid_arguments',
      operationCalled: false,
    };
  if (
    strategy === 'guard' &&
    item === 'apple' &&
    inventory.snapshot().pantry.apple - 1 < reservedMinimum
  )
    return {
      ok: false,
      source: 'dispatcher',
      reason: 'reserve_minimum',
      operationCalled: false,
    };
  return inventory.withdraw(item);
}
// end:guard

function takeRequest(item: Item): ToolCall['function'] {
  return { name: 'take_one', arguments: { item } };
}

// This script consumes the observation and the rejection; its first proposal is a fixture.
function scriptedAgent(config: ExperimentConfig) {
  return {
    inspect: { name: 'inspect_pantry', arguments: {} },
    propose(observation: { pantry: Stock }) {
      return {
        request: takeRequest(config.proposal),
        observedStock: observation.pantry,
      };
    },
    continue(observation: { pantry: Stock }, result: Withdrawal) {
      if (
        config.continueAfterRejection &&
        config.proposal === 'apple' &&
        !result.ok &&
        observation.pantry.carrot > 0
      )
        return takeRequest('carrot');
    },
  };
}

export function runExperiment(
  config: Readonly<ExperimentConfig>,
): ExperimentRun {
  const inventory = createInventory(
    { apple: config.apples, carrot: config.carrots },
    config.strategy === 'domain',
  );
  const agent = scriptedAgent(config);
  const frames: Frame[] = [];
  let evidence = pendingEvidence;
  const record = (
    kind: Frame['kind'],
    title: string,
    description: string,
    payload?: Frame['payload'],
  ) =>
    frames.push(
      immutable({
        kind,
        title,
        description,
        state: inventory.snapshot(),
        evidence,
        ...(payload ? { payload: structuredClone(payload) } : {}),
      }),
    );
  record(
    'notice',
    'Job received',
    'The reserve rule is in the agent’s instructions in every strategy.',
  );
  const observation = { ok: true, pantry: inventory.snapshot().pantry };
  record(
    'inspection',
    'Pantry inspected',
    'The script receives the stock counts before proposing a withdrawal.',
    { request: agent.inspect, result: observation },
  );
  const proposal = agent.propose(observation);
  function withdraw(request: ToolCall['function'], continuation = false) {
    const before = inventory.snapshot();
    record(
      'request',
      continuation ? 'Carrot requested' : 'Withdrawal requested',
      continuation
        ? 'The script received a refusal and saw carrots in its inspection.'
        : 'The first proposal is fixed by the experiment controls.',
      { request, observedStock: proposal.observedStock },
    );
    const result = dispatch(inventory, config.strategy, request);
    const after = inventory.snapshot();
    evidence = {
      execution: result.ok
        ? 'succeeded'
        : result.source === 'validation'
          ? 'invalid-request'
          : result.source === 'dispatcher'
            ? 'dispatcher-rejected'
            : 'inventory-rejected',
      transfer: result.ok
        ? verifiedPickup(before, after, result.item)
          ? 'verified'
          : 'unverified'
        : 'none',
      outcome: evaluateOutcome(after),
    };
    const description = result.ok
      ? 'One item left the shelf and entered Scout’s inventory. The transfer alone says nothing about the reserve.'
      : result.source === 'dispatcher'
        ? 'The dispatcher rejected the request before calling the inventory operation. Nothing moved.'
        : result.reason === 'reserve_minimum'
          ? 'The inventory operation checked its own stock and refused the write. Nothing moved.'
          : result.reason === 'out_of_stock'
            ? 'The requested item was unavailable. Nothing moved.'
            : 'The request was refused. Nothing moved.';
    record(
      'result',
      result.ok ? 'Withdrawal succeeded' : 'Withdrawal refused',
      description,
      result,
    );
    if (config.strategy === 'evaluate') {
      const reserveHeld = after.pantry.apple >= reservedMinimum;
      record(
        'policy',
        'Post-action check',
        reserveHeld
          ? 'The evaluator checked the inventory after the operation. The reserve held.'
          : 'The evaluator detected the broken reserve after the write. The apple is already gone.',
        { reserveHeld, remainingApples: after.pantry.apple, reservedMinimum },
      );
    }
    return result;
  }
  let result = withdraw(proposal.request);
  const next = agent.continue(observation, result);
  if (next) result = withdraw(next, true);
  const report = result.ok
    ? 'I picked up one ' + result.item + '.'
    : evidence.outcome === 'blocked'
      ? 'No snack can be collected while keeping the reserve.'
      : 'The withdrawal was refused. I did not collect a snack.';
  record('report', 'Scripted report', report, { report });
  const id = [
    'last-apple',
    config.apples,
    config.carrots,
    config.strategy,
    config.proposal,
    Number(config.continueAfterRejection),
  ].join(':');
  return immutable({ id, frames });
}
