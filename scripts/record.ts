import { writeFile } from 'node:fs/promises';
import { loadArticle } from '../authoring/load-article.ts';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import { defaultOrder } from '../article-sets/scout-foundations/types.ts';
const article = await loadArticle();
const picnic = article.steps.findIndex(step => step.meta.id === 'picnic');
for (const apples of [2, 1]) {
  let time = 0;
  const host = createLessonHost({ articleId: article.id, steps: article.steps.map(step=>step.meta),
    settings: () => ({ mode:'mock',order:defaultOrder,apples,pauseInspection:false,live:{endpoint:'',model:''} }),
    clock: { now: () => time, sleep: async (ms,signal) => { signal.throwIfAborted(); time += ms; } } });
  host.select(picnic); const step=host.current;
  await step.act(async()=>{step.mark(await step.runtime(article.steps[picnic].blocks.loop).run!());});
  await writeFile(new URL(`../traces/${apples===2?'apple':'carrot'}.json`,import.meta.url), JSON.stringify(step.trace,null,2)+'\n');
  console.log(`Recorded ${apples} apples →`,step.trace.final?.basket);
}
