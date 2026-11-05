import './style.css';
import { createView } from './view.ts';
import { createLessonController } from '../presentation/lesson-controller.ts';
import { createPlayer } from '../presentation/player.ts';
import { icon } from '../presentation/content.ts';
import { screen } from '../presentation/terminal.ts';
import { exportTrace, openPanel, renderHistory } from '../presentation/panels.ts';
import { createLessonDriver } from '../article-sets/scout-foundations/driver.ts';
import type { Settings } from '../article-sets/scout-foundations/driver.ts';
import { articles } from '../article-sets/index.ts';
import { recordingArticle, replayStepIndex, selectArticle } from '../article-sets/registry.ts';
import { parseTrace } from '../article-sets/scout-foundations/recordings.ts';
import { renderStatus } from '../article-sets/scout-foundations/status.ts';
import { defaultOrder } from '../article-sets/scout-foundations/types.ts';
import type { Mode, Snapshot, Trace, TraceEvent } from '../article-sets/scout-foundations/types.ts';
import { createReplay } from '../runtime/replay.ts';
import apple from '../traces/apple.json';
import carrot from '../traces/carrot.json';
import ollama from '../traces/ollama-last-apple.json';

const parameters = new URLSearchParams(location.search);
const article = selectArticle(articles, parameters.get('article'));
const steps = article.steps;
const $ = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
for (const id of ['settings','status','history']) $(`${id}-button`).innerHTML = icon(id);
$('lesson-toggle').innerHTML = icon('lesson'); $('film').innerHTML = icon('film');
document.title = `${article.title} · Unklearn`;
$('article-title').textContent = article.title;
for (const content of document.querySelectorAll<HTMLElement>('[data-article]')) content.hidden = content.dataset.article !== article.id;
const articleSelect = $<HTMLSelectElement>('article-select');
for (const item of articles) articleSelect.add(new Option(item.title, item.id));
articleSelect.value = article.id;
$('article-picker').hidden = articles.length < 2;
articleSelect.onchange = () => navigateArticle(articleSelect.value);
const config: Settings = { mode: 'mock', order: defaultOrder, apples: 2, pauseInspection: true, live: { endpoint: 'http://127.0.0.1:11434', model: 'qwen3:14b', transport: 'ollama' } };
$<HTMLTextAreaElement>('order').value = defaultOrder;
const view = createView($('stage'));
const recordings = new Map<string, Trace>([['apple', apple as Trace], ['carrot', carrot as Trace], ['ollama', ollama as Trace]]);
try { for (const trace of JSON.parse(localStorage.getItem('scout-lesson-takes-v1') || '[]')) recordings.set(trace.id, parseTrace(JSON.stringify(trace))); } catch { /* Storage is optional on a static host. */ }
let replay: ReturnType<typeof createReplay<Snapshot>> | undefined;
let replayTrace: Trace | undefined;
let queued = false, initialized = false;
const driver = createLessonDriver({ steps, articleId: article.id, settings: () => config, changed: scheduleRender, event: apply, saved: save });
const lesson = createLessonController(steps, index => {
  screen.reset(source()); driver.select(index); if (initialized) paintCheckpoint();
});
const player = createPlayer(steps, lesson, id => {
  if (!['post','approve','empty-apples','continue'].includes(id)) screen.reset(source());
  void driver.action(id).catch(fail);
}, article.actions);
function navigateArticle(id: string, recording?: string) {
  driver.cancel(); replay?.pause();
  const url = new URL(location.href); url.searchParams.set('article', id);
  if (recording) url.searchParams.set('recording', recording); else url.searchParams.delete('recording');
  location.assign(url.href);
}
function source() { return config.mode === 'replay' ? 'SCOUT / RECORDED ACTIVITY' : config.mode === 'live' ? `SCOUT / LIVE · ${config.live.model}` : 'SCOUT / MOCK · DETERMINISTIC DEMO'; }
function fail(error: unknown) { $('error').textContent = error instanceof Error ? error.message : String(error); $('error').hidden = false; }
function save(trace: Trace) {
  recordings.set(trace.id, trace);
  const local = [...recordings].filter(([key]) => !['apple','carrot','ollama'].includes(key)).slice(-12);
  try { localStorage.setItem('scout-lesson-takes-v1', JSON.stringify(local.map(([,trace]) => trace))); } catch { /* JSON export remains available. */ }
  refreshRecordings();
}
function refreshRecordings() {
  const select = $<HTMLSelectElement>('recording'), previous = select.value;
  select.replaceChildren(...[...recordings].map(([id, trace]) => {
    const option = document.createElement('option'); option.value = id;
    option.textContent = id === 'apple' ? 'Two apples → apple' : id === 'carrot' ? 'One apple → carrot' : id === 'ollama' ? 'Live recording · took the last apple' : `Step ${replayStepIndex(recordingArticle(articles, trace.lesson) ?? article, trace.lesson) + 1} · ${trace.provider} · ${trace.status} · ${new Date(trace.startedAt).toLocaleTimeString()}`;
    return option;
  }));
  if (recordings.has(previous)) select.value = previous;
}
function apply(event: TraceEvent, elapsed = 0) {
  view.apply(event, elapsed); screen.event(event);
  if (initialized) scheduleRender();
}
function paintCheckpoint() {
  if (config.mode === 'replay') return;
  const take = driver.take;
  screen.reset(source());
  for (const event of take.experiment.trace.events) screen.event(event, true);
  // Navigation renders a settled snapshot. It cannot replay a tool execution.
  view.apply({ kind: 'checkpoint', text: '', state: take.experiment.world.snapshot(), seq: 0, at: 0 });
}
function scheduleRender() { if (queued) return; queued = true; queueMicrotask(() => { queued = false; if (initialized) render(); }); }
function render() {
  const take = driver.take, trace = config.mode === 'replay' && replayTrace ? replayTrace : take.experiment.trace;
  const context = config.mode === 'replay' ? '' : driver.context;
  player.update(driver.stage, take.busy, config.mode === 'replay');
  screen.context(`${lesson.step.id}:${driver.take.phase}`, context);
  view.idle(!take.busy && config.mode !== 'replay');
  if ($<HTMLDialogElement>('status-panel').open) renderStatus(currentState(), statusMessages(), trace, config.mode === 'replay' ? [] : driver.stage.tools, config.mode === 'replay');
  if ($<HTMLDialogElement>('history-panel').open) renderHistory(trace);
}
function statusMessages() { return config.mode === 'replay' && replayTrace
  ? replayTrace.events.filter(event => event.at <= (replay?.elapsed ?? 0)).findLast(event => event.kind === 'model_start')?.messages ?? []
  : driver.take.experiment.agent.messages; }
function currentTrace() { return config.mode === 'replay' && replayTrace ? replayTrace : driver.take.experiment.trace; }
function currentState() { return config.mode === 'replay' && replayTrace ? replayTrace.events.filter(e => e.at <= (replay?.elapsed ?? 0)).at(-1)?.state ?? replayTrace.initial : driver.take.experiment.world.snapshot(); }
function loadReplay(id: string) {
  replay?.pause(); replayTrace = recordings.get(id); if (!replayTrace) return;
  const targetArticle = recordingArticle(articles, replayTrace.lesson);
  if (!targetArticle) { fail(`This recording belongs to an unregistered article: ${replayTrace.lesson?.article}`); return; }
  if (targetArticle.id !== article.id) { navigateArticle(targetArticle.id, id); return; }
  const recordedStep = replayStepIndex(targetArticle, replayTrace.lesson);
  lesson.go(recordedStep); player.refresh();
  screen.reset(source());
  view.apply({ kind: 'checkpoint', text: '', state: replayTrace.initial, seq: 0, at: 0 }); view.pause(true);
  replay = createReplay(replayTrace, apply); replay.restart(); scheduleRender();
}
$('settings-button').onclick = () => openPanel('settings');
$('status-button').onclick = () => { render(); renderStatus(currentState(), statusMessages(), currentTrace(), config.mode === 'replay' ? [] : driver.stage.tools, config.mode === 'replay'); openPanel('status'); };
$('history-button').onclick = () => { renderHistory(currentTrace()); openPanel('history'); };
$<HTMLFormElement>('order-form').onsubmit = event => {
  event.preventDefault(); config.order = $<HTMLTextAreaElement>('order').value;
  if (!config.order.trim()) { fail('Write a notice before posting.'); return; }
  if (config.mode === 'replay') return;
  void driver.action('post'); $<HTMLDialogElement>('settings-panel').close();
  if (lesson.step.experiment !== 'patrol') view.apply({ kind: 'checkpoint', text: '', state: driver.take.experiment.world.snapshot(), at: 0, seq: 0 });
};
$<HTMLSelectElement>('preset').onchange = e => { config.apples = Number((e.target as HTMLSelectElement).value); };
$<HTMLInputElement>('pause-inspection').onchange = e => { config.pauseInspection = (e.target as HTMLInputElement).checked; };
for (const id of ['transport','endpoint','model']) $(id).onchange = () => { config.live = { transport: $<HTMLSelectElement>('transport').value as 'ollama'|'gateway', endpoint: $<HTMLInputElement>('endpoint').value, model: $<HTMLInputElement>('model').value }; };
$<HTMLSelectElement>('mode').onchange = () => {
  driver.cancel(); replay?.pause(); config.mode = $<HTMLSelectElement>('mode').value as Mode; screen.reset(source());
  $('live-settings').hidden = config.mode !== 'live'; $('recording-settings').hidden = config.mode !== 'replay'; $('replay-bar').hidden = config.mode !== 'replay';
  $<HTMLButtonElement>('post-order').disabled = config.mode === 'replay'; $('error').hidden = true;
  $('mode-note').textContent = config.mode === 'mock' ? 'Deterministic demonstration. Real browser loop and tools; no backend or key.' : config.mode === 'replay' ? 'Recorded snapshots and movements. No provider calls or tool execution.' : 'Actual provider responses and tool outcomes. No automatic fallback to Mock.';
  if (config.mode === 'replay') loadReplay($<HTMLSelectElement>('recording').value);
  else { driver.reset(); view.pause(false); paintCheckpoint(); }
  render();
};
$<HTMLSelectElement>('recording').onchange = () => loadReplay($<HTMLSelectElement>('recording').value);
$('replay-play').onclick = () => { if (!replay) return; if (replay.playing) { replay.pause(); view.pause(true); } else { replay.play(); view.pause(false); } };
$('replay-restart').onclick = () => { screen.reset(source()); replay?.restart(); view.pause(true); };
view.onFrame(dt => { if (config.mode !== 'replay' || !replay) return; replay.advance(dt * 1000); $('replay-time').textContent = `Recorded · ${(replay.elapsed/1000).toFixed(1)} / ${(replay.duration/1000).toFixed(1)}s`; $('replay-play').textContent = replay.playing ? 'Pause' : 'Play'; if (!replay.playing) view.pause(true); });
$('export').onclick = () => exportTrace(currentTrace());
$<HTMLInputElement>('import').onchange = async () => {
  try { const file = $<HTMLInputElement>('import').files?.[0]; if (!file) return; const trace = parseTrace(await file.text()); save(trace); $<HTMLSelectElement>('recording').value = trace.id;
    $<HTMLSelectElement>('mode').value = 'replay'; $<HTMLSelectElement>('mode').dispatchEvent(new Event('change')); $<HTMLDialogElement>('history-panel').close();
  } catch (error) { fail(error); }
};
function film(value: boolean) { document.body.classList.toggle('film', value); $('film').setAttribute('aria-pressed', String(value)); }
$('film').onclick = () => film(!document.body.classList.contains('film'));
window.addEventListener('keydown', e => { if (e.key === 'Escape') film(false); });
refreshRecordings(); driver.select(0); initialized = true; paintCheckpoint(); render();

const requestedRecording = parameters.get('recording');
if (requestedRecording && recordings.has(requestedRecording)) {
  $<HTMLSelectElement>('recording').value = requestedRecording;
  $<HTMLSelectElement>('mode').value = 'replay';
  $<HTMLSelectElement>('mode').dispatchEvent(new Event('change'));
}
