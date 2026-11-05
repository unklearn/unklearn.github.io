import { mkdir, writeFile } from 'node:fs/promises';
import { runScout } from '../runtime/loop.ts';
import { liveProvider } from '../runtime/providers.ts';
import { defaultOrder, carrotOrder } from '../runtime/types.ts';

const provider = liveProvider({ endpoint: process.env.OLLAMA_URL || 'http://127.0.0.1:11434', model: process.env.OLLAMA_MODEL || 'qwen3:14b', think: process.env.OLLAMA_THINK === 'true', timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 180000) });
await mkdir(new URL('../verification/', import.meta.url), { recursive: true });
for (const [name, apple, order, expected] of [
  ['two-apples', 2, defaultOrder, 'apple'], ['last-apple', 1, defaultOrder, 'carrot'], ['carrot-order', 2, carrotOrder, 'carrot'],
] as const) {
  let offset = 0;
  console.log(`\n${name}: real Ollama, same browser-safe runtime`);
  const trace = await runScout({ order, pantry: { apple, carrot: 2 }, provider, mode: 'live', providerLabel: process.env.OLLAMA_MODEL || 'qwen3:14b',
    clock: { now: () => Date.now() + offset, sleep: async ms => { offset += ms; } },
    onEvent: e => { if (['tool_start', 'tool_result', 'report', 'error'].includes(e.kind)) console.log(`[${e.kind}] ${e.text}`); } });
  await writeFile(new URL(`../verification/${name}.json`, import.meta.url), JSON.stringify(trace, null, 2));
  const correct = trace.status === 'reported' && trace.final?.basket[expected] === 1 && trace.final?.basket[expected === 'apple' ? 'carrot' : 'apple'] === 0;
  console.log(JSON.stringify({ status: trace.status, pantry: trace.final?.pantry, basket: trace.final?.basket, matchesExpected: correct }));
  if (!correct) process.exitCode = 1;
}
