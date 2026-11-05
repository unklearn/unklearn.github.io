import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { extractBlocks } from '../authoring/mdx-code.ts';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import { defaultOrder, carrotOrder } from '../article-sets/scout-foundations/types.ts';
import { createReplay } from './replay.ts';
import type { LessonArticle } from '../presentation/lesson-ui.tsx';
import type { Message } from './types.ts';
import type { Feedback } from './lesson-types.ts';
let server: ViteDevServer, article: LessonArticle;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  article = (await server.ssrLoadModule('/article-sets/scout-foundations/articles/what-makes-scout-an-agent/article.ts')).article;
});
after(async () => { await server?.close(); });
const clock = () => { let now=0;return { now:()=>now,sleep:async(ms:number,signal:AbortSignal)=>{signal.throwIfAborted();now+=ms;} }; };
function host(apples=2, order=defaultOrder) {
  return createLessonHost({articleId:article.id,steps:article.steps.map(s=>s.meta),clock:clock(),settings:()=>({mode:'mock',apples,order,pauseInspection:false,live:{endpoint:'',model:''}})});
}
test('MDX source is executable source; early runtimes lack dispatch and feedback', async () => {
  const files=['01-meet','02-tools','03-execute','04-feedback','05-picnic'];
  for (const [i,step] of article.steps.entries()) {
    const source=extractBlocks(readFileSync(`article-sets/scout-foundations/articles/what-makes-scout-an-agent/${files[i]}.mdx`,'utf8'));
    for (const block of source.blocks) assert.equal(step.blocks[block.id].source,block.source);
  }
  const h=host(), first=h.current;
  const invoke=first.runtime(article.steps[0].blocks.invoke);
  assert.equal(invoke.execute,undefined);assert.equal(invoke.append,undefined);assert.equal(invoke.run,undefined);
  await first.act(async()=>{await invoke.evaluate();});
  assert.equal(first.trace.events.filter(e=>e.kind==='model_start').length,1);
  assert(!first.trace.events.some(e=>e.kind==='tool_start'));
  h.select(1);const reader=h.current;
  reader.setTools(article.steps[1].blocks.reader.module.tools!);
  const offered=reader.runtime(article.steps[1].blocks.offer);
  assert.equal(offered.execute,undefined);
  assert(!reader.trace.events.some(e=>e.kind==='model_start'));
  await reader.act(async()=>{assert.equal((await offered.evaluate()).tool_calls?.[0].function.name,'read_notice');});
  assert(reader.world.snapshot().unread, 'a request does not execute the read');
  h.select(2); const gated=h.current; gated.setTools([]);
  await gated.act(async()=>{
    const denied=await gated.runtime(article.steps[2].blocks.dispatch).execute!({role:'assistant',content:'',tool_calls:[{function:{name:'take_one',arguments:{item:'apple'}}}]});
    assert.equal(denied?.value.reason,'tool_unavailable');
    assert.deepEqual(gated.world.snapshot().pantry,{apple:2,carrot:2});
  });
});
test('held observation is unknown until the evolved runtime appends matching feedback', async () => {
  const h=host();h.select(2);const s=h.current;
  let feedback:Feedback|null=null;
  await s.act(async()=>{
    const r=s.runtime(article.steps[2].blocks.dispatch);
    assert.equal(r.append,undefined);
    feedback=await r.execute!(await r.evaluate());
    assert.equal(feedback?.value.notice,defaultOrder);
    assert(!JSON.stringify(s.messages).includes(defaultOrder));
    assert.equal((await r.evaluate()).tool_calls?.[0].function.name,'read_notice');
    s.saveCheckpoint('notice-read',{feedback});
  });
  assert(feedback);h.select(3);const next=h.current;
  assert(next.restoreCheckpoint('notice-read'));
  await next.act(async()=>{
    const r=next.runtime(article.steps[3].blocks.feedback);
    r.append!(next.data.feedback as Feedback);
    assert.deepEqual(next.messages.slice(-2),[(feedback as Feedback).request,(feedback as Feedback).result]);
    assert((await r.evaluate()).content.includes(defaultOrder));
  });
});
test('final MDX runtime performs real transfers for all three orders and replays final inventory', async()=>{
  const initialInputs: string[]=[];
  for(const [apples,order,basket,pantry] of [
    [2,defaultOrder,{apple:1,carrot:0},{apple:1,carrot:2}],
    [1,defaultOrder,{apple:0,carrot:1},{apple:1,carrot:1}],
    [2,carrotOrder,{apple:0,carrot:1},{apple:2,carrot:1}],
  ] as const){
    const h=host(apples,order);h.select(4);const s=h.current;
    await s.act(async()=>{s.mark(await s.runtime(article.steps[4].blocks.loop).run!());});
    initialInputs.push(JSON.stringify(s.trace.events.find(e=>e.kind==='model_start')?.messages));
    assert.equal(s.trace.status,'reported');assert.deepEqual(s.world.snapshot().basket,basket);assert.deepEqual(s.world.snapshot().pantry,pantry);
    const results=s.trace.events.filter(e=>e.kind==='tool_result');
    assert(results.findIndex(e=>e.tool?.name==='inspect_pantry')<results.findIndex(e=>e.tool?.name==='take_one'));
    assert(s.trace.events.some(e=>e.kind==='pickup'));assert(s.trace.events.some(e=>e.kind==='delivery'));
    const before=s.trace.events.length;
    let replayed=s.trace.initial;
    const replay=createReplay(s.trace,e=>{replayed=e.state;});replay.play();replay.advance(replay.duration+1);
    assert.deepEqual(replayed,s.trace.final);assert.equal(s.trace.events.length,before);
  }
  assert.equal(initialInputs[0],initialInputs[1],'changing stock does not enter initial provider input');
});
test('patrol and posting do not infer; paused loop resumes using stale stock and failure feedback', async()=>{
  const h=host();const intro=h.current;
  await intro.act(async()=>{intro.world.postNotice();await intro.world.patrol();});
  assert(!intro.trace.events.some(e=>['model_start','tool_start'].includes(e.kind)));
  h.select(4);const s=h.current;
  await s.act(async()=>{
    assert.equal(await s.runtime(article.steps[4].blocks.loop).run!(async f=>f.result.tool_name==='inspect_pantry'?false:undefined),'paused');
  });
  const count=s.messages.length;s.world.setPantry({apple:0,carrot:2});assert.equal(s.messages.length,count);
  await s.act(async()=>{s.mark(await s.runtime(article.steps[4].blocks.loop).run!());});
  assert(s.trace.events.some(e=>e.result?.reason==='out_of_stock'));
  assert.deepEqual(s.world.snapshot().basket,{apple:0,carrot:1});
});
test('navigation aborts provider work; reset clears context, tools and physical state; aliases survive',async()=>{
  let release:()=>void=()=>{};
  const h=createLessonHost({articleId:article.id,steps:article.steps.map(s=>s.meta),settings:()=>({mode:'mock',apples:2,order:defaultOrder,pauseInspection:false,live:{endpoint:'',model:''}}),clock:{now:()=>0,sleep:(_ms,signal)=>new Promise((resolve,reject)=>{release=resolve;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});})}});
  const s=h.current;
  const running=s.act(async()=>{await s.runtime(article.steps[0].blocks.invoke).evaluate();});
  h.select(1);release();await running;
  assert(!s.busy);assert(!s.trace.events.some(e=>e.kind==='assistant'));
  h.select(0);assert.equal(h.current,s);
  s.reset({notice:'',tools:[]});assert.equal(s.world.snapshot().unread,false);assert.equal(s.messages.length,2);assert.deepEqual(s.world.snapshot().basket,{apple:0,carrot:0});
  const {replayStepIndex}=await server.ssrLoadModule('/article-sets/registry.ts');
  assert.equal(replayStepIndex(article,{step:7}),4);assert.equal(replayStepIndex(article,{stepId:'turn',step:2}),1);
});
test('Live preserves provider conversation fields without exposing private thinking in traces or context',async()=>{
  const {mockProvider}=await import('../article-sets/scout-foundations/mock.ts');
  const original=globalThis.fetch;
  let privateReturnedToProvider=false;
  globalThis.fetch=async(_url,init)=>{
    const input=JSON.parse(init!.body as string);
    privateReturnedToProvider ||= input.messages.some((message:Message)=>message.thinking==='PRIVATE_TEST_MARKER');
    const message=await mockProvider(input.messages,input.tools,new AbortController().signal);
    return new Response(JSON.stringify({message:{...message,thinking:'PRIVATE_TEST_MARKER'}}),{status:200});
  };
  try {
    const h=createLessonHost({articleId:article.id,steps:article.steps.map(s=>s.meta),clock:clock(),settings:()=>({mode:'live',apples:2,order:defaultOrder,pauseInspection:false,live:{endpoint:'http://gateway.invalid',model:'test',transport:'gateway'}})});
    h.select(4);const s=h.current;
    await s.act(async()=>{s.mark(await s.runtime(article.steps[4].blocks.loop).run!());});
    assert.equal(s.trace.status,'reported');assert(privateReturnedToProvider);
    s.showContext({messages:s.messages});
    assert(!JSON.stringify(s.trace).includes('PRIVATE_TEST_MARKER'));assert(!s.context.includes('PRIVATE_TEST_MARKER'));
  } finally { globalThis.fetch=original; }
});
