import { writeFile } from 'node:fs/promises';
import { runScout } from '../article-sets/scout-foundations/experiment.ts';
import { mockProvider } from '../article-sets/scout-foundations/mock.ts';
import { defaultOrder } from '../article-sets/scout-foundations/types.ts';

for (const apple of [2, 1]) {
  let time = 0;
  const trace = await runScout({ order: defaultOrder, pantry: { apple, carrot: 2 }, provider: mockProvider,
    clock: { now: () => time, sleep: async ms => { time += ms; } } });
  await writeFile(new URL(`../traces/${apple === 2 ? 'apple' : 'carrot'}.json`, import.meta.url), JSON.stringify(trace, null, 2) + '\n');
  console.log(`Recorded ${apple} apples →`, trace.final?.basket);
}
