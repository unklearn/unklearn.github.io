import type { Trace } from '../runtime/types.ts';
export const openPanel = (id: string) => document.querySelector<HTMLDialogElement>(`#${id}-panel`)!.showModal();
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]')) button.onclick = () => button.closest('dialog')!.close();

export function renderHistory<State>(trace: Trace<State>) {
  document.querySelector('#history-summary')!.textContent = `${trace.provider} · ${trace.status} · ${trace.events.length} ordered events`;
  const initial = document.createElement('li'); initial.innerHTML = '<details><summary>Initial state & exact notice</summary><pre></pre></details>'; initial.querySelector('pre')!.textContent = JSON.stringify({ ...trace, events: undefined, final: undefined }, null, 2);
  const events = trace.events.map(event => { const li = document.createElement('li'); const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre'); summary.textContent = `${String(event.seq).padStart(2,'0')} · ${(event.at/1000).toFixed(1)}s · ${event.kind} · ${event.text.slice(0,90)}`; pre.textContent = JSON.stringify(event, null, 2); details.append(summary,pre); li.append(details); return li; });
  const final = document.createElement('li'); final.innerHTML = '<details><summary>Final inventories</summary><pre></pre></details>'; final.querySelector('pre')!.textContent = JSON.stringify(trace.final ?? trace.events.at(-1)?.state ?? trace.initial, null, 2);
  document.querySelector('#history-events')!.replaceChildren(initial, ...events, final);
}
let blobUrl = '';
export function exportTrace<State>(trace: Trace<State>) {
  const text = JSON.stringify(trace, null, 2);
  document.querySelector<HTMLTextAreaElement>('#export-json')!.value = text;
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.querySelector<HTMLAnchorElement>('#download')!; link.href = blobUrl; link.download = `scout-${trace.id}.json`;
  openPanel('export');
}
