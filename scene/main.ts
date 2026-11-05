import './style.css';
import { createView } from './view.ts';
import { runScout } from '../runtime/loop.ts';
import { liveProvider, mockProvider } from '../runtime/providers.ts';
import { createWorld } from '../runtime/world.ts';
import { createReplay } from '../runtime/replay.ts';
import { defaultOrder, realClock } from '../runtime/types.ts';
import type { Mode, Snapshot, Trace, TraceEvent } from '../runtime/types.ts';
import appleRecording from '../traces/apple.json';
import carrotRecording from '../traces/carrot.json';
import ollamaRecording from '../traces/ollama-last-apple.json';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const order = $<HTMLTextAreaElement>('order'), preset = $<HTMLSelectElement>('preset');
const post = $<HTMLButtonElement>('post'), play = $<HTMLButtonElement>('play');
const recording = $<HTMLSelectElement>('recording');
order.value = defaultOrder;
const view = createView($('stage'));
let mode: Mode = 'mock', busy = false, generation = 0;
let controller: AbortController | null = null;
let currentRun: Promise<Trace> | null = null;
let replay: ReturnType<typeof createReplay> | null = null;
let trace: Trace | null = null;
let lastRequest = '', eventCount = 0;
let saved: Trace[] = [];
const recordings = new Map<string, Trace>([['apple', appleRecording as Trace], ['carrot', carrotRecording as Trace], ['ollama', ollamaRecording as Trace]]);
try { const stored = JSON.parse(localStorage.getItem('scout-takes-v1') || '[]'); if (Array.isArray(stored)) saved = stored; } catch { /* Storage is optional. */ }
saved.filter(t => t.version === 1 && Array.isArray(t.events)).forEach(t => addRecording(t));
if (saved[0]?.version === 1) { trace = saved[0]; $<HTMLButtonElement>('download').disabled = false; }

function addRecording(t: Trace) {
  recordings.set(t.id, t);
  if (!Array.from(recording.options).some(option => option.value === t.id)) {
    const option = document.createElement('option'); option.value = t.id;
    option.textContent = `${t.mode === 'mock' ? 'Mock' : 'Live'} · ${new Date(t.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${inventory(t.final?.basket ?? t.initial.basket, 'empty basket')}`;
    recording.append(option);
  }
}
function inventory(items: Snapshot['pantry'], empty = 'Empty') {
  return (['apple', 'carrot'] as const).filter(item => items[item] > 0).map(item => `${items[item]} ${item}${items[item] === 1 ? '' : 's'}`).join(' · ') || empty;
}
function inventories(state: Snapshot) {
  $('pantry-count').textContent = inventory(state.pantry);
  $('carried-count').textContent = state.carried ? `One ${state.carried}` : 'Nothing';
  $('basket-count').textContent = inventory(state.basket, 'Waiting for a delivery');
}
function clearNotebook() { $('event-log').replaceChildren(); eventCount = 0; $('event-count').textContent = '0 observations'; lastRequest = ''; }
function log(event: TraceEvent) {
  eventCount++;
  $('event-count').textContent = `${eventCount} observations`;
  const li = document.createElement('li');
  const time = document.createElement('span'); time.className = 'event-time'; time.textContent = `${(event.at / 1000).toFixed(1)}s`;
  const kind = document.createElement('span'); kind.className = 'event-kind'; kind.textContent = event.kind;
  li.append(time, kind, document.createTextNode(event.text)); $('event-log').append(li);
}
function summary(event: TraceEvent) {
  const r = event.result;
  if (!r) return event.text;
  if (r.ok === false) return String(r.reason);
  if (r.notice !== undefined) return 'Notice read. Scout now knows the order.';
  if (r.pantry) return `Observed ${inventory(r.pantry as Snapshot['pantry'])}.`;
  if (r.basket) return `Basket: ${inventory(r.basket as Snapshot['basket'])}.`;
  if (r.carried) return `Carrying one ${r.carried}.`;
  if (r.place) return `At ${String(r.place).replaceAll('_', ' ')}.`;
  return event.text;
}
function present(event: TraceEvent, elapsed = 0) {
  view.apply(event, elapsed); inventories(event.state); log(event);
  $('radio').classList.toggle('active', mode !== 'replay' && event.kind === 'model_start');
  $('radio-turn').textContent = `${mode === 'replay' ? 'RECORDED · ' : ''}TURN ${event.turn || 0}`;
  if (event.kind === 'tool_start') lastRequest = event.text;
  if (!['model_end', 'run_end'].includes(event.kind)) $('radio-text').textContent = summary(event);
  $('radio-detail').textContent = lastRequest ? `Last action: ${lastRequest}` : mode === 'replay' ? 'Recorded events only. No tools or provider calls.' : 'Read → decide → act → observe';
  if (event.kind === 'error') $('status').textContent = event.text;
}
function preview() {
  const state = createWorld({ notice: order.value, pantry: { apple: Number(preset.value), carrot: 2 } }).snapshot();
  view.apply({ seq: 0, at: 0, kind: 'preview', text: '', state });
  view.idle(true); view.pause(false); inventories(state);
  $('radio').classList.remove('active');
  $('radio-text').textContent = 'A notice, a pantry, a picnic. Scout is ready.';
  $('radio-detail').textContent = 'No inference while idle.';
  $('radio-turn').textContent = 'STANDING BY';
}
function lock(value: boolean) {
  busy = value; post.disabled = value; order.disabled = value; preset.disabled = value;
  for (const id of ['transport', 'endpoint', 'model']) $<HTMLInputElement>(id).disabled = value;
  post.innerHTML = value ? 'Scout is on the job <span>···</span>' : 'Post order <span>↗</span>';
}
function sourceLabel() {
  $('radio-source').textContent = mode === 'mock' ? 'SCOUT / MOCK PROVIDER' : mode === 'replay' ? 'SCOUT / RECORDED TAKE' : 'SCOUT / LIVE PROVIDER';
  $('mode-badge').textContent = mode === 'mock' ? 'MOCK · RUNS IN YOUR BROWSER' : mode === 'replay' ? 'REPLAY · NO TOOLS EXECUTED' : 'LIVE · BROWSER AGENT LOOP';
}
function loadReplay() {
  replay?.pause(); clearNotebook(); view.idle(false); view.pause(true);
  trace = recordings.get(recording.value) ?? recordings.get('apple')!;
  replay = createReplay(trace, (event, elapsed) => present(event, elapsed));
  replay.restart();
  $<HTMLButtonElement>('download').disabled = false;
  play.innerHTML = 'Play recording <span>▷</span>';
  $('status').textContent = `Recorded ${trace.mode} take. No provider calls or tool execution.`;
}
async function setMode(next: Mode) {
  const gen = ++generation;
  controller?.abort(new Error('Mode changed.'));
  replay?.pause();
  await currentRun;
  if (gen !== generation) return;
  currentRun = null; controller = null; lock(false); mode = next;
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('order-form').hidden = mode === 'replay'; $('replay-controls').hidden = mode !== 'replay'; $('live-settings').hidden = mode !== 'live';
  $('mode-note').textContent = mode === 'mock' ? 'A deterministic provider. A real loop and real tools. Entirely in your browser.' : mode === 'replay' ? 'A saved run, played as it happened. No decisions or actions are executed.' : 'The same loop and world. Decisions now come from your connected model.';
  sourceLabel();
  if (mode === 'replay') loadReplay();
  else { clearNotebook(); preview(); $('status').textContent = mode === 'mock' ? 'Ready when you are.' : 'Connect Ollama or a provider gateway, then post an order.'; }
}
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => { void setMode(button.dataset.mode as Mode); }));
$('order-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || mode === 'replay') return;
  if (!order.value.trim()) { $('status').textContent = 'Write a notice for Scout first.'; return; }
  const gen = ++generation;
  controller = new AbortController(); const signal = controller.signal;
  clearNotebook(); lock(true); view.pause(false); view.idle(false);
  $('status').textContent = mode === 'mock' ? 'Running the loop locally. No model or backend needed.' : 'Running the browser loop with your live provider.';
  const settings = { endpoint: $<HTMLInputElement>('endpoint').value, model: $<HTMLInputElement>('model').value,
    transport: $<HTMLSelectElement>('transport').value as 'ollama' | 'gateway' };
  const provider = mode === 'live' ? liveProvider(settings) : async (...args: Parameters<typeof mockProvider>) => {
    // A little pacing makes each mock decision filmable. It remains one provider call.
    await realClock.sleep(450, args[2]); return mockProvider(...args);
  };
  currentRun = runScout({ order: order.value, pantry: { apple: Number(preset.value), carrot: 2 }, provider,
    mode, providerLabel: mode === 'mock' ? 'Mock' : settings.model, signal,
    onEvent: e => { if (gen === generation) present(e); },
  });
  const result = await currentRun;
  saved = [result, ...saved].slice(0, 6);
  try { localStorage.setItem('scout-takes-v1', JSON.stringify(saved)); } catch { /* Download still works when storage is full or unavailable. */ }
  addRecording(result);
  if (gen !== generation) return;
  trace = result; currentRun = null; controller = null; lock(false);
  $<HTMLButtonElement>('download').disabled = false;
  $('status').textContent = result.status === 'reported' ? `Take finished. Basket: ${inventory(result.final!.basket, 'empty')}.` : `${result.status}: ${result.events.findLast(e => e.kind === 'error')?.text ?? 'See the notebook.'}`;
});
preset.addEventListener('change', () => { if (!busy && mode !== 'replay') { preview(); $('status').textContent = 'Pantry reset. Ready for a fresh take.'; } });
recording.addEventListener('change', loadReplay);
$('play').addEventListener('click', () => {
  if (!replay) return;
  if (replay.playing) { replay.pause(); view.pause(true); }
  else { if (replay.elapsed >= replay.duration) { clearNotebook(); replay.restart(); } replay.play(); view.pause(false); }
});
$('restart').addEventListener('click', loadReplay);
const stamp = (ms: number) => `${Math.floor(ms / 60000)}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
view.onFrame(dt => {
  if (mode !== 'replay' || !replay) return;
  replay.advance(dt * 1000); view.pause(!replay.playing);
  play.innerHTML = replay.playing ? 'Pause recording <span>Ⅱ</span>' : 'Play recording <span>▷</span>';
  $('playhead').textContent = `${stamp(replay.elapsed)} / ${stamp(replay.duration)}`;
});
let exportUrl: string | null = null;
$('download').addEventListener('click', () => {
  if (!trace) return;
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  const json = JSON.stringify(trace, null, 2);
  $<HTMLTextAreaElement>('trace-json').value = json;
  exportUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = $<HTMLAnchorElement>('trace-link'); link.href = exportUrl; link.download = `scout-${trace.mode}-${trace.id}.json`;
  $<HTMLDialogElement>('export-dialog').showModal();
});
$('close-export').addEventListener('click', () => $<HTMLDialogElement>('export-dialog').close());
$<HTMLInputElement>('import').addEventListener('change', async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Please choose a trace smaller than 5 MB.');
    const imported = JSON.parse(await file.text()) as Trace;
    if (imported.version !== 1 || !imported.initial || !imported.events?.length || !imported.events.every(e => e.state && Number.isFinite(e.at))) throw new Error('That file is not a Scout trace.');
    addRecording(imported); recording.value = imported.id; await setMode('replay');
  } catch (error) { $('status').textContent = error instanceof Error ? error.message : String(error); }
  input.value = '';
});
function film(enabled: boolean) { document.body.classList.toggle('filming', enabled); $('exit-film').hidden = !enabled; $('film').setAttribute('aria-pressed', String(enabled)); }
$('film').addEventListener('click', () => film(true)); $('exit-film').addEventListener('click', () => film(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') film(false); });
$('transport').addEventListener('change', () => { $<HTMLInputElement>('endpoint').value = $<HTMLSelectElement>('transport').value === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8787/chat'; });
preview();
