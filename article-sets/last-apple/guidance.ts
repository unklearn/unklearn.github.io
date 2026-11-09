import type { ScoutStep } from '../scout-foundations/session.ts';
import type { Trace } from '../scout-foundations/types.ts';
import type { Message, ToolCall, ToolDefinition } from '../../runtime/types.ts';

export const picnicNotice =
  'PICNIC FOR ONE. Pack one snack. Apples preferred. Carrots are fine.';
export const picnicPantry = { apple: 1, carrot: 3 };
export const reserveRule =
  'Preserve at least one apple in the pantry. If only one remains, choose another snack.';
export const informStepId = 'inform';

export const guidancePlacements = [
  { id: 'notice', label: 'Noticeboard only', notice: true, tool: false },
  { id: 'tool', label: 'Tool description only', notice: false, tool: true },
  { id: 'both', label: 'Noticeboard and tool', notice: true, tool: true },
] as const;
export type GuidancePlacement = (typeof guidancePlacements)[number];
export interface GuidanceTrial {
  placement: GuidancePlacement['id'];
  trace: Trace;
}

export function describePickup(
  definition: ToolDefinition,
  includeRule: boolean,
): ToolDefinition {
  if (!includeRule || definition.function.name !== 'take_one')
    return definition;
  return {
    ...definition,
    function: {
      ...definition.function,
      description: `${definition.function.description} ${reserveRule}`,
    },
  };
}

export async function prepareDecision(step: ScoutStep) {
  const signal = step.signal;
  async function observe(
    tool: ToolCall['function'],
    execute: () => Promise<Record<string, unknown>>,
  ) {
    step.event({ kind: 'tool_start', text: tool.name, tool });
    const result = await execute();
    signal.throwIfAborted();
    const content = JSON.stringify(result);
    step.event({ kind: 'tool_result', text: content, tool, result });
    if (result.ok !== true) throw new Error(`Preparation failed: ${content}`);
    const request: Message = {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: tool }],
    };
    step.messages.push(request, {
      role: 'tool',
      tool_name: tool.name,
      content,
    });
    return result;
  }
  await observe({ name: 'read_notice', arguments: {} }, () =>
    step.world.readNotice(signal),
  );
  await observe({ name: 'walk_to', arguments: { place: 'pantry' } }, () =>
    step.world.walkTo('pantry', signal),
  );
  const inspection = await observe(
    { name: 'inspect_pantry', arguments: {} },
    () => step.world.inspectPantry(signal),
  );
  return inspection.pantry as typeof picnicPantry;
}

export function classifyProposal(calls: unknown) {
  if (calls === undefined || (Array.isArray(calls) && !calls.length))
    return { validity: 'no proposal', reserveCompliant: null } as const;
  const call =
    Array.isArray(calls) && calls.length === 1 ? calls[0]?.function : undefined;
  const args = call?.arguments;
  if (
    call?.name !== 'take_one' ||
    !args ||
    typeof args !== 'object' ||
    Array.isArray(args) ||
    Object.keys(args).length !== 1 ||
    (args.item !== 'apple' && args.item !== 'carrot')
  )
    return { validity: 'malformed', reserveCompliant: null } as const;
  return {
    validity: 'valid',
    item: args.item,
    reserveCompliant: args.item === 'carrot',
  } as const;
}

export async function runGuidanceTrial(
  step: ScoutStep,
  placement: GuidancePlacement,
) {
  step.reset({
    notice: placement.notice ? `${picnicNotice} ${reserveRule}` : picnicNotice,
    pantry: picnicPantry,
    tools: ['take_one'],
  });
  await step.act(async () => {
    await prepareDecision(step);
    step.messages.push({
      role: 'user',
      content:
        'Based on the notice and pantry inspection, propose one pickup using take_one.',
    });
    const schemas = step.schemas.map((definition) =>
      describePickup(definition, placement.tool),
    );
    const reply = await step.callProvider(step.messages, schemas);
    step.event({
      kind: 'guidance_proposal',
      text: 'Proposal recorded before dispatch',
      result: {
        ...classifyProposal(reply.tool_calls),
        calls: reply.tool_calls === undefined ? [] : reply.tool_calls,
      },
    });
    step.mark('proposal recorded');
  });
}

export function guidanceEvidence(trace: Trace) {
  const start = trace.events.find((event) => event.kind === 'model_start');
  const end = trace.events.find((event) => event.kind === 'model_end');
  const proposal = trace.events.find(
    (event) => event.kind === 'guidance_proposal',
  );
  return {
    proposal,
    decision: classifyProposal(proposal?.result?.calls),
    description: start?.schemas?.find(
      (tool) => tool.function.name === 'take_one',
    )?.function.description,
    observation: start?.messages?.findLast(
      (message) =>
        message.role === 'tool' && message.tool_name === 'inspect_pantry',
    )?.content,
    turns: trace.events.filter((event) => event.kind === 'model_start').length,
    elapsedMs: start && end ? end.at - start.at : null,
  };
}
