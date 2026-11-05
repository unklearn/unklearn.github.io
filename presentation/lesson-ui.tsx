import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode, ComponentType } from 'react';
import type { LessonHost, ScoutStep, StepMeta } from '../article-sets/scout-foundations/session.ts';
import type { StoredCode } from '../runtime/lesson-types.ts';
export interface MdxStep { meta: StepMeta; default: ComponentType; blocks: Record<string, StoredCode> }
export interface LessonArticle { id: string; title: string; steps: readonly MdxStep[]; replayStepId: string; legacyStepIds?: readonly string[]; stepAliases?: Readonly<Record<string, string>> }
interface LessonContext { host: LessonHost; step: ScoutStep; replay: boolean; terminal?: (content: ReactNode) => void }
const Context = createContext<LessonContext | null>(null);
export function useScoutStep() {
  const context = useContext(Context);
  if (!context) throw new Error('Use a Scout step inside the lesson player');
  useSyncExternalStore(context.host.subscribe, context.host.getRevision, context.host.getRevision);
  return context.step;
}
export function useLessonPresentation() {
  const context = useContext(Context)!;
  return { renderSystemTerminal: (content: ReactNode) => context.terminal?.(content), showContext: context.step.showContext, showQuestion: context.step.showQuestion };
}
export function Action({ children, onClick, concurrent = false, ...props }: { children: ReactNode; onClick: () => void | Promise<void>; concurrent?: boolean; className?: string; disabled?: boolean }) {
  const context = useContext(Context)!, step = useScoutStep();
  return <button {...props} disabled={context.replay || props.disabled || (step.busy && !concurrent)} onClick={() => { void onClick(); }}>{children}</button>;
}
export function LessonPages({ article, host, selected = 0, replay = false, terminal }: { article: LessonArticle; host: LessonHost; selected?: number; replay?: boolean; terminal?: (content: ReactNode) => void }) {
  useSyncExternalStore(host.subscribe, host.getRevision, host.getRevision);
  return <article data-article={article.id}>{article.steps.map((step, index) => {
    const Content = step.default, id = `${article.id}-${step.meta.id}`;
    return <section key={`${host.epoch}:${step.meta.id}`} className={`teaching-step${index === selected ? ' selected' : ''}`} hidden={index !== selected} aria-labelledby={id}>
      <span className="step-kicker">Step {index+1}</span><h1 id={id}>{step.meta.title}</h1>
      <Context.Provider value={{ host, step: host.get(step.meta.id), replay, terminal }}><div className="lesson-copy"><Content /></div></Context.Provider>
    </section>;
  })}</article>;
}
function changedLines(before: string, after: string) {
  const a = before ? before.split('\n') : [], b = after.split('\n');
  const grid = Array.from({length:a.length+1}, () => new Uint16Array(b.length+1));
  for (let i=a.length-1;i>=0;i--) for(let j=b.length-1;j>=0;j--) grid[i][j] = a[i] === b[j] ? grid[i+1][j+1]+1 : Math.max(grid[i+1][j],grid[i][j+1]);
  const lines: {text:string;kind:string}[] = []; let i=0,j=0;
  while(i<a.length || j<b.length) {
    if(i<a.length && j<b.length && a[i]===b[j]) { lines.push({text:a[i++],kind:'same'});j++; }
    else if(j<b.length && (i===a.length || grid[i][j+1]>grid[i+1][j])) lines.push({text:b[j++],kind:'addition'});
    else lines.push({text:a[i++],kind:'removal'});
  }
  const changed = lines.flatMap((line,index) => line.kind==='same'?[]:[index]);
  return lines.filter((_,index) => changed.some(n=>Math.abs(n-index)<=2)).map((line,index,array) => ({...line, gap:index>0 && lines.indexOf(line)>lines.indexOf(array[index-1])+1}));
}
export function RuntimeChange({ from, to }: { from?: StoredCode; to: StoredCode }) {
  const lines = changedLines(from?.source ?? '', to.source);
  return <figure className="source runtime-change"><figcaption>{to.kind === 'setup' ? 'Configuration change' : 'Runtime change'}</figcaption>
    {lines.length ? <pre><code>{lines.map((line,i)=><span key={i}>{line.gap && <span className="code-line">…</span>}<span className={`code-line ${line.kind}`}>{line.kind==='addition'?'+ ':line.kind==='removal'?'- ':'  '}{line.text}</span></span>)}</code></pre> : <p>Runtime unchanged.</p>}
    <details><summary>Full {to.kind === 'setup' ? 'configuration' : 'runtime'}</summary><pre><code>{to.source}</code></pre></details>
  </figure>;
}
