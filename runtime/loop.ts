import type { Message, Provider, RuntimeEvent, Tool, ToolCall } from './types.ts';

export interface Feedback { request: Message; result: Message; value: Record<string, unknown> }
const publicMessage = (message: Message): Message => structuredClone({
  role: message.role, content: message.content,
  ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
  ...(message.tool_name ? { tool_name: message.tool_name } : {}),
});

// A deliberately small harness: ask → execute → append → ask again.
// A lesson may pause between these operations without pretending data reached the model.
export function createAgent({ provider, messages, tools, signal, emit = () => {} }: {
  provider: Provider; messages: Message[]; tools: readonly Tool[]; signal: AbortSignal;
  emit?: (event: RuntimeEvent) => void;
}) {
  let turn = 0;
  const selected = new Map(tools.map(tool => [tool.definition.function.name, tool]));
  const toolSchemas = tools.map(tool => tool.definition);
  async function evaluate(): Promise<Message> {
    signal.throwIfAborted();
    turn++;
    emit({ kind: 'model_start', text: 'Provider call pending', turn, messages: messages.map(publicMessage), schemas: structuredClone(toolSchemas) });
    try {
      // @excerpt evaluate start
      const next = await provider(structuredClone(messages), toolSchemas, signal);
      // @excerpt evaluate end
      signal.throwIfAborted();
      emit({ kind: 'assistant', text: next.content || 'Tool requested', turn, tool: next.tool_calls?.[0]?.function });
      return next;
    } finally { emit({ kind: 'model_end', text: 'Provider call ended', turn }); }
  }
  async function execute(request: Message): Promise<Feedback | null> {
    const calls = request.tool_calls ?? [];
    if (calls.length > 1) throw new Error('One tool per turn is supported; no actions from this batch executed.');
    if (!calls.length && !request.content?.trim()) throw new Error('Provider returned neither a tool request nor a public response.');
    if (!calls.length) { emit({ kind: 'report', text: request.content, turn }); return null; }
    const call: ToolCall['function'] = calls[0].function;
    emit({ kind: 'tool_start', text: `${call.name}(${JSON.stringify(call.arguments)})`, tool: call, turn });
    // Schemas and dispatch use the same selection. An unexposed tool cannot execute.
    const tool = selected.get(call.name);
    // @excerpt execute start
    const value = tool ? await tool.execute(call.arguments, signal)
      : { ok: false, reason: 'tool_unavailable' };
    const toolCallResult: Message = { role: 'tool', tool_name: call.name, content: JSON.stringify(value) };
    // @excerpt execute end
    signal.throwIfAborted();
    emit({ kind: 'tool_result', text: toolCallResult.content, tool: call, result: value, turn });
    return { request, result: toolCallResult, value };
  }
  function append({ request, result: toolCallResult }: Feedback) {
    // @excerpt feedback start
    messages.push(request);
    messages.push(toolCallResult); // + The next evaluation can now observe the result.
    // @excerpt feedback end
    emit({ kind: 'context', text: 'Tool request and observation appended to the next input', messages: messages.map(publicMessage), turn });
  }
  async function run(afterTool?: (feedback: Feedback) => Promise<void>): Promise<string> {
    for (let n = 0; n < 20; n++) {
      const reply = await evaluate();
      const feedback = await execute(reply);
      if (!feedback) { messages.push(reply); return 'reported'; }
      append(feedback);
      await afterTool?.(feedback);
    }
    return 'turn_limit';
  }
  return { messages, evaluate, execute, append, run };
}
export type Agent = ReturnType<typeof createAgent>;
