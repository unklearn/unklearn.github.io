import type { RuntimeEvent } from '../runtime/types.ts';
const terminal = document.querySelector<HTMLElement>('#terminal')!;
const lines = document.querySelector<HTMLOListElement>('#terminal-lines')!;
const launcher = document.querySelector<HTMLButtonElement>('#activity-button')!;
const badge = document.querySelector<HTMLElement>('#activity-count')!;
let entries: { kind: string; text: string }[] = [];
let pending = false, manual = false, unread = 0, contextText = '', contextKey = '', tab = 'scout';
let source = 'SCOUT / MOCK · DETERMINISTIC DEMO';
function show(selected = tab, inspect = false) {
  tab = selected; terminal.hidden = false;
  if (inspect) { manual = true; unread = 0; }
  document.querySelector<HTMLElement>('#experiment-context')!.hidden = tab !== 'context';
  lines.hidden = tab !== 'scout';
  document.querySelector('#scout-tab')!.setAttribute('aria-pressed', String(tab === 'scout'));
  document.querySelector('#context-tab')!.setAttribute('aria-pressed', String(tab === 'context'));
  document.querySelector<HTMLDetailsElement>('#context-details')!.open = inspect;
  screen.render();
}
function hide() { terminal.hidden = true; manual = false; screen.render(); }
export const screen = {
  present() { document.querySelector<HTMLElement>('#terminal-custom')!.hidden = false; show('scout'); },
  reset(label: string) {
    document.querySelector<HTMLElement>('#terminal-custom')!.hidden = true;
    entries = []; pending = false; manual = false; unread = 0; contextText = ''; contextKey = ''; source = label;
    terminal.hidden = true; this.render();
  },
  event(event: RuntimeEvent, quiet = false) {
    if (event.kind === 'model_start') pending = true;
    if (event.kind === 'model_end' || event.kind === 'run_end') pending = false;
    if (event.kind === 'lesson_approval' && !quiet) {
      document.querySelector('#context-notice')!.textContent = 'Reading tool available. No handler has executed.';
      show('context');
    }
    if (event.kind === 'report' && entries.at(-1)?.text === event.text) { this.render(); return; }
    if (['assistant','tool_result','report','error'].includes(event.kind)) {
      const text = event.kind === 'assistant' && event.tool ? `Requested ${event.tool.name}(${JSON.stringify(event.tool.arguments)})` : event.text;
      entries.push({ kind: event.kind, text });
      if (!quiet) {
        if (!manual) unread++;
        // Public speech can appear briefly; JSON observations wait behind a badge.
        if (event.kind === 'error' || (!manual && event.kind === 'assistant' && !event.tool && text.length <= 220)) show('scout');
        else if (!manual && event.kind === 'tool_result') terminal.hidden = true;
      }
    }
    this.render();
  },
  context(key: string, text: string) {
    if (contextText === text && contextKey === key) return;
    const hadContext = !!contextText;
    contextText = text; contextKey = key;
    document.querySelector('#context-data')!.textContent = text;
    if (!key.endsWith(':approved')) document.querySelector('#context-notice')!.textContent = 'The input and observations for this experiment.';
    if (hadContext && text && !manual) unread++;
    this.render();
  },
  render() {
    terminal.classList.toggle('pending', pending); launcher.classList.toggle('pending', pending);
    launcher.hidden = false;
    launcher.title = terminal.hidden ? 'Show system terminal' : 'Hide system terminal';
    launcher.setAttribute('aria-expanded', String(!terminal.hidden));
    badge.hidden = unread === 0; badge.textContent = String(unread);
    launcher.setAttribute('aria-label', `${launcher.title}${unread ? ` · ${unread} unread` : ''}${pending ? source.includes('RECORDED') ? ' · recorded provider activity' : ' · provider call pending' : ''}`);
    document.querySelector('#terminal-source')!.textContent = source;
    document.querySelector('#terminal-activity')!.textContent = pending ? source.includes('RECORDED') ? 'Recorded provider activity' : source.includes('LIVE') ? 'Live inference pending…' : 'Mock provider call pending…' : 'No provider call pending';
    lines.replaceChildren(...entries.slice(-8).map(entry => {
      const li = document.createElement('li'); li.className = entry.kind;
      if (entry.kind === 'tool_result' || entry.text.length > 220) {
        const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
        summary.textContent = entry.kind === 'tool_result' ? 'Tool result' : 'Scout response'; pre.textContent = entry.text;
        details.append(summary, pre); li.append(details);
      } else li.textContent = entry.text;
      return li;
    }));
  },
  get pending() { return pending; },
};
launcher.onclick = () => { if (terminal.hidden) show(tab, true); else hide(); };
document.querySelector<HTMLButtonElement>('#terminal-close')!.onclick = hide;
document.querySelector<HTMLButtonElement>('#scout-tab')!.onclick = () => show('scout', true);
document.querySelector<HTMLButtonElement>('#context-tab')!.onclick = () => show('context', true);
