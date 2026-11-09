import type { StoredCode } from '../../runtime/lesson-types.ts';
import type { Message, Provider, Tool } from '../../runtime/types.ts';
import type { ScoutStep } from '../scout-foundations/session.ts';
import type {
  Inventory,
  Item,
  Snapshot,
  TraceEvent,
} from '../scout-foundations/types.ts';
import {
  classifyProposal,
  describePickup,
  picnicNotice,
  picnicPantry,
  prepareDecision,
} from './guidance.ts';

export type Strategy = 'guidance' | 'evaluate' | 'guard' | 'domain';
export const pantryRefusalCheckpoint = 'last-apple-pantry-refusal';

// excerpt:reserve
export function reserveRefusal(item: Item, pantry: Readonly<Inventory>) {
  if (item === 'apple' && pantry.apple <= 1) return 'reserve_minimum';
}
// end:reserve

function guidedTools(tools: readonly Tool[], observedStock?: Inventory) {
  return tools.map((tool) => {
    const definition = describePickup(tool.definition, true);
    if (definition === tool.definition) return tool;
    return {
      definition,
      execute(args: Parameters<Tool['execute']>[0], signal: AbortSignal) {
        signal.throwIfAborted();
        const reason =
          observedStock && reserveRefusal(args.item as Item, observedStock);
        if (reason)
          return Promise.resolve({ ok: false, reason, source: 'dispatcher' });
        return tool.execute(args, signal);
      },
    };
  });
}

function action(name: string, args: Record<string, unknown> = {}): Message {
  return {
    role: 'assistant',
    content: '',
    tool_calls: [{ function: { name, arguments: args } }],
  };
}

const proposeApple: Provider = async () =>
  action('take_one', { item: 'apple' });
const recoverPicnic: Provider = async (messages) => {
  const observations = messages.filter((message) => message.role === 'tool');
  const last = observations.at(-1);
  const result = last && JSON.parse(last.content);
  if (last?.tool_name === 'take_one') {
    if (result.ok) return action('walk_to', { place: 'picnic_basket' });
    const inspection = observations.findLast(
      (message) => message.tool_name === 'inspect_pantry',
    );
    const stock = inspection && JSON.parse(inspection.content);
    if (
      result.reason === 'reserve_minimum' &&
      result.source === 'inventory' &&
      stock?.ok &&
      stock.pantry.carrot > 0
    )
      return action('take_one', { item: 'carrot' });
  }
  if (
    last?.tool_name === 'walk_to' &&
    result.ok &&
    result.place === 'picnic_basket'
  )
    return action('deliver_item');
  return {
    role: 'assistant',
    content:
      last?.tool_name === 'deliver_item' && result.ok
        ? 'I delivered one carrot to the picnic basket.'
        : 'I stopped before completing the delivery.',
  };
};

export function evaluateOutcome(state: Snapshot) {
  if (state.pantry.apple < 1) return 'Reserve violated';
  if (state.basket.apple + state.basket.carrot === 1 && !state.carried)
    return 'Picnic complete; reserve held';
  if (state.pantry.apple === 1 && state.pantry.carrot === 0 && !state.carried)
    return 'Blocked; no eligible snack';
  return 'Picnic incomplete; reserve held';
}

export function pickupEvidence(events: readonly TraceEvent[]) {
  const result = events.findLast(
    (event) => event.kind === 'tool_result' && event.tool?.name === 'take_one',
  );
  if (!result)
    return {
      execution: 'No pickup result yet',
      transfer: 'No pickup recorded',
    };
  if (result.result?.ok !== true) {
    const source = result.result?.source;
    return {
      execution:
        source === 'dispatcher'
          ? 'Refused by dispatcher'
          : source === 'inventory'
            ? 'Refused by inventory'
            : 'Pickup failed',
      transfer: 'No item moved',
    };
  }
  const before = events.findLast(
    (event) =>
      event.seq < result.seq &&
      event.kind === 'tool_start' &&
      event.tool?.name === 'take_one',
  )?.state;
  const item = result.result.item as Item;
  const other = item === 'apple' ? 'carrot' : 'apple';
  const verified =
    before &&
    !before.carried &&
    result.state.carried === item &&
    before.pantry[item] - result.state.pantry[item] === 1 &&
    before.pantry[other] === result.state.pantry[other] &&
    before.basket.apple === result.state.basket.apple &&
    before.basket.carrot === result.state.basket.carrot;
  return {
    execution: 'Pickup succeeded',
    transfer: verified ? 'Verified from inventories' : 'Unverified',
  };
}

export async function runEnforcement(
  step: ScoutStep,
  strategy: Strategy,
  code: StoredCode,
  pantry: Inventory = picnicPantry,
) {
  if (!step.active || step.busy || step.settings.mode === 'replay') return;
  step.reset({
    notice: picnicNotice,
    pantry,
    tools: ['take_one'],
    pickupPolicy: strategy === 'domain' ? reserveRefusal : undefined,
  });
  await step.act(async () => {
    step.event({
      kind: 'enforcement',
      text: 'Enforcement strategy selected',
      result: { strategy },
    });
    const observed = await prepareDecision(step);
    step.messages.push({
      role: 'user',
      content:
        'Based on the notice and pantry inspection, propose one pickup using take_one.',
    });
    const runtime = step.runtime(code, {
      mock: proposeApple,
      mapTools: (tools) =>
        guidedTools(tools, strategy === 'guard' ? observed : undefined),
    });
    const request = await runtime.evaluate();
    const proposal = classifyProposal(request.tool_calls);
    if (proposal.validity !== 'valid') {
      step.event({
        kind: 'enforcement',
        text: 'No valid pickup request to check',
        result: proposal,
      });
      step.mark(proposal.validity);
      return;
    }
    const feedback = await runtime.execute!(request);
    if (!feedback) return;
    runtime.append!(feedback);
    if (strategy === 'evaluate') {
      const reserveHeld = step.world.snapshot().pantry.apple >= 1;
      step.event({
        kind: 'outcome_check',
        text: reserveHeld
          ? 'Post-action check found the reserve intact'
          : 'Post-action check detected the reserve violation',
        result: { reserveHeld },
      });
    }
    step.mark(
      feedback.value.ok === true ? 'pickup complete' : 'pickup refused',
    );
    if (
      feedback.value.source === 'inventory' &&
      feedback.value.reason === 'reserve_minimum'
    )
      step.saveCheckpoint(pantryRefusalCheckpoint, { pantryRefused: true });
  });
}

export async function continueVerification(step: ScoutStep, code: StoredCode) {
  if (
    !step.active ||
    step.busy ||
    step.settings.mode !== 'mock' ||
    step.data.pantryRefused !== true ||
    (step.stage !== 'ready' && step.stage !== 'pickup refused')
  )
    return;
  await step.act(async () => {
    step.setTools(['take_one', 'walk_to', 'deliver_item']);
    const runtime = step.runtime(code, {
      mock: recoverPicnic,
      mapTools: guidedTools,
    });
    await runtime.run!();
    const state = step.world.snapshot();
    const reserveHeld = state.pantry.apple >= 1;
    const picnicComplete =
      state.basket.apple + state.basket.carrot === 1 && !state.carried;
    step.event({
      kind: 'outcome_check',
      text: 'Verified the pantry, basket, and Scout’s hands',
      result: { reserveHeld, picnicComplete },
    });
    step.mark('verified');
  });
}
