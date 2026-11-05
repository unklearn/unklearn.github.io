import type { Message } from '../../runtime/types.ts';
import type { TeachingStage, TeachingStep } from '../../presentation/teaching.ts';
import type { Take } from './driver.ts';
function feedbackContext(messages: readonly Message[]) {
  return messages.map(message => message.role === 'assistant' && message.tool_calls
    ? `assistant request: ${message.tool_calls.map(call => `${call.function.name}(${JSON.stringify(call.function.arguments)})`).join(', ')}`
    : `${message.role}${message.tool_name ? ` (${message.tool_name})` : ''}: ${message.content}`).join('\n');
}
// Articles select these views by name. Moving a step does not change its explanation.
export function describeContext(step: TeachingStep, take: Take, stage: TeachingStage): string {
  const inputs = take.experiment.trace.events.filter(event => event.kind === 'model_start');
  switch (step.context) {
    case 'held-observation': return take.pending ? `Handler returned (held outside model input):\n${take.pending.result.content}\n\nProvider input still has no tool observation.` : '';
    case 'feedback': return take.pending
      ? `Pending matching request + result (not appended yet):\n${feedbackContext([take.pending.request, take.pending.result])}`
      : `Outgoing provider input:\n${feedbackContext(inputs.at(-1)?.messages?.slice(-2) ?? take.experiment.agent.messages.slice(-2))}`;
    case 'pantry-observation': {
      const observation = take.experiment.agent.messages.findLast(message => message.tool_name === 'inspect_pantry');
      return observation ? `Last pantry observation in model context:\n${observation.content}\n\n${take.phase === 'inspected' ? 'Changing the shelf does not edit this observation.' : ''}` : '';
    }
    case 'unobserved-notice': return `Provider calls: ${inputs.length} · Tools executed: 0\n\n${feedbackContext((inputs.at(-1)?.messages ?? take.experiment.agent.messages).filter(message => message.role !== 'system'))}\n\nAvailable tools: none. No tool observation in context.`;
    case 'tool-availability': return `Provider calls: ${inputs.length} · Tools executed: 0\nAvailable tools: ${stage.tools.join(', ') || 'none'}`;
    default: return '';
  }
}
