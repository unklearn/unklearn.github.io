import { mkdir, writeFile } from 'node:fs/promises';
import { loadArticle } from '../authoring/load-article.ts';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import { defaultOrder, carrotOrder } from '../article-sets/scout-foundations/types.ts';
const article=await loadArticle(), picnic=article.steps.findIndex(step=>step.meta.id==='picnic');
const live={endpoint:process.env.OLLAMA_URL||'http://127.0.0.1:11434',model:process.env.OLLAMA_MODEL||'qwen3:14b',think:process.env.OLLAMA_THINK==='true',timeoutMs:Number(process.env.OLLAMA_TIMEOUT_MS||180000)};
await mkdir(new URL('../verification/',import.meta.url),{recursive:true});
for (const [name,apples,order,expected] of [
  ['two-apples',2,defaultOrder,'apple'],['last-apple',1,defaultOrder,'carrot'],['carrot-order',2,carrotOrder,'carrot'],
] as const) {
  let offset=0;
  console.log(`\n${name}: ${live.model}, actual MDX runtime`);
  const host=createLessonHost({articleId:article.id,steps:article.steps.map(step=>step.meta),settings:()=>({mode:'live',order,apples,pauseInspection:false,live}),
    clock:{now:()=>Date.now()+offset,sleep:async(ms,signal)=>{signal.throwIfAborted();offset+=ms;}},
    event:e=>{if(['tool_start','tool_result','assistant','error'].includes(e.kind)) console.log(`[${e.kind}] ${e.text}`);}});
  host.select(picnic);const step=host.current;
  await step.act(async()=>{step.mark(await step.runtime(article.steps[picnic].blocks.loop).run!());});
  const trace=step.trace;
  await writeFile(new URL(`../verification/${name}.json`,import.meta.url),JSON.stringify(trace,null,2));
  const correct=trace.status==='reported' && trace.final?.basket[expected]===1 && trace.final?.basket[expected==='apple'?'carrot':'apple']===0;
  console.log(JSON.stringify({status:trace.status,pantry:trace.final?.pantry,basket:trace.final?.basket,matchesExpected:correct}));
  if (!correct) process.exitCode=1;
}
