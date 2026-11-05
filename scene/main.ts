import './style.css';
import { createView } from './view.ts';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { LessonPages } from '../presentation/lesson-ui.tsx';
import { icon } from '../presentation/content.ts';
import { screen } from '../presentation/terminal.ts';
import {
  exportTrace,
  openPanel,
  renderHistory,
} from '../presentation/panels.ts';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import type { Settings } from '../article-sets/scout-foundations/session.ts';
import { articles } from '../article-sets/index.ts';
import {
  recordingArticle,
  replayStepIndex,
  selectArticle,
} from '../article-sets/registry.ts';
import { parseTrace } from '../article-sets/scout-foundations/recordings.ts';
import { renderStatus } from '../article-sets/scout-foundations/status.ts';
import { defaultOrder } from '../article-sets/scout-foundations/types.ts';
import type {
  Mode,
  Snapshot,
  Trace,
  TraceEvent,
} from '../article-sets/scout-foundations/types.ts';
import { createReplay } from '../runtime/replay.ts';
import apple from '../traces/apple.json';
import carrot from '../traces/carrot.json';
import ollama from '../traces/ollama-last-apple.json';

const parameters = new URLSearchParams(location.search);
const article = selectArticle(articles, parameters.get('article'));
const steps = article.steps;
const $ = <T extends HTMLElement>(id: string) =>
  document.querySelector<T>(`#${id}`)!;
for (const id of ['settings', 'status', 'history'])
  $(`${id}-button`).innerHTML = icon(id);
$('lesson-toggle').innerHTML = icon('lesson');
$('film').innerHTML = icon('film');
document.title = `${article.title} · Unklearn`;
$('article-title').textContent =
  `Lesson ${String(article.number).padStart(2, '0')} · ${article.title}`;
for (const content of document.querySelectorAll<HTMLElement>('[data-article]'))
  content.hidden = content.dataset.article !== article.id;
const articleSelect = $<HTMLSelectElement>('article-select');
for (const item of articles) articleSelect.add(new Option(item.title, item.id));
articleSelect.value = article.id;
$('article-picker').hidden = articles.length < 2;
articleSelect.onchange = () => navigateArticle(articleSelect.value);
const config: Settings = {
  mode: 'mock',
  order: defaultOrder,
  apples: 2,
  live: {
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen3:14b',
    transport: 'ollama',
  },
};
$<HTMLTextAreaElement>('order').value = defaultOrder;
const view = createView($('stage'));
const recordings = new Map<string, Trace>([
  ['apple', apple as Trace],
  ['carrot', carrot as Trace],
  ['ollama', ollama as Trace],
]);
try {
  for (const trace of JSON.parse(
    localStorage.getItem('scout-lesson-takes-v1') || '[]',
  ))
    recordings.set(trace.id, parseTrace(JSON.stringify(trace)));
} catch {
  /* Storage is optional on a static host. */
}
let replay: ReturnType<typeof createReplay<Snapshot>> | undefined;
let replayTrace: Trace | undefined;
let queued = false,
  initialized = false,
  reviewing = false,
  recordedContext = '';
const isRecorded = () => reviewing || config.mode === 'replay';
let selected = 0,
  lessonRoot: Root | undefined;
const host = createLessonHost({
  articleId: article.id,
  scenario: article.scenario,
  steps: steps.map((step) => step.meta),
  settings: () => config,
  changed: scheduleRender,
  event: apply,
  saved: save,
});
const toc = $<HTMLDialogElement>('toc-panel');
$('toc-steps').replaceChildren(
  ...steps.map((step, index) => {
    const button = document.createElement('button');
    button.textContent = `${String(index + 1).padStart(2, '0')} ${step.meta.title}`;
    button.onclick = () => {
      select(index);
      toc.close();
    };
    return button;
  }),
);
function select(index: number) {
  if (index < 0 || index >= steps.length) return;
  reviewing = false;
  replay?.pause();
  view.recorded(config.mode === 'replay');
  $('replay-bar').hidden = config.mode !== 'replay';
  view.pause(false);
  host.select(index);
  selected = index;
  paintCheckpoint();
  render();
  $('lesson-pages').scrollTop = 0;
}
$('toc-open').onclick = () => toc.showModal();
$('previous').onclick = () => select(selected - 1);
$('next').onclick = () => select(selected + 1);
$('lesson-toggle').onclick = () => {
  const collapsed = $('app').classList.toggle('collapsed');
  $('lesson-toggle').setAttribute('aria-expanded', String(!collapsed));
  const label = collapsed ? 'Show lesson' : 'Hide lesson';
  $('lesson-toggle').setAttribute('aria-label', label);
  $('lesson-toggle').title = label;
};
let customRoot: Root | undefined;
function renderSystemTerminal(content: ReactNode) {
  if (!customRoot) customRoot = createRoot($('terminal-custom'));
  customRoot.render(content);
  screen.present();
}
function renderLesson() {
  const content = createElement(LessonPages, {
    article,
    host,
    selected,
    replay: config.mode === 'replay',
    terminal: renderSystemTerminal,
    review: reviewExecution,
  });
  if (!lessonRoot) {
    const element = $('lesson-pages');
    for (const other of element.querySelectorAll<HTMLElement>('[data-article]'))
      if (other.dataset.article !== article.id) other.remove();
    if (element.querySelector('[data-article]'))
      lessonRoot = hydrateRoot(element, content);
    else {
      lessonRoot = createRoot(element);
      lessonRoot.render(content);
    }
  } else lessonRoot.render(content);
  $('step-count').textContent = `${selected + 1} / ${steps.length}`;
  $<HTMLButtonElement>('previous').disabled = selected === 0;
  $<HTMLButtonElement>('next').disabled = selected === steps.length - 1;
  $('toc-steps')
    .querySelectorAll('button')
    .forEach((button, i) => {
      if (i === selected) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
}
function navigateArticle(id: string, recording?: string) {
  host.current.cancel();
  replay?.pause();
  const url = new URL(location.href);
  url.searchParams.set('article', id);
  if (recording) url.searchParams.set('recording', recording);
  else url.searchParams.delete('recording');
  location.assign(url.href);
}
function source() {
  return isRecorded()
    ? 'SCOUT / RECORDED ACTIVITY'
    : config.mode === 'live'
      ? `SCOUT / LIVE · ${config.live.model}`
      : 'SCOUT / MOCK · DETERMINISTIC DEMO';
}
function fail(error: unknown) {
  $('error').textContent =
    error instanceof Error ? error.message : String(error);
  $('error').hidden = false;
}
function save(trace: Trace) {
  recordings.set(trace.id, trace);
  const local = [...recordings]
    .filter(([key]) => !['apple', 'carrot', 'ollama'].includes(key))
    .slice(-12);
  try {
    localStorage.setItem(
      'scout-lesson-takes-v1',
      JSON.stringify(local.map(([, trace]) => trace)),
    );
  } catch {
    /* JSON export remains available. */
  }
  refreshRecordings();
}
function refreshRecordings() {
  const select = $<HTMLSelectElement>('recording'),
    previous = select.value;
  select.replaceChildren(
    ...[...recordings].map(([id, trace]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent =
        id === 'apple'
          ? 'Two apples → apple'
          : id === 'carrot'
            ? 'One apple → carrot'
            : id === 'ollama'
              ? 'Live recording · took the last apple'
              : `Step ${replayStepIndex(recordingArticle(articles, trace.lesson) ?? article, trace.lesson) + 1} · ${trace.provider} · ${trace.status} · ${new Date(trace.startedAt).toLocaleTimeString()}`;
      return option;
    }),
  );
  if (recordings.has(previous)) select.value = previous;
}
function apply(event: TraceEvent, elapsed = 0) {
  if (event.kind === 'checkpoint') screen.reset(source());
  view.apply(event, elapsed);
  screen.event(event);
  if (initialized) scheduleRender();
}
function paintCheckpoint() {
  if (config.mode === 'replay') return;
  const step = host.current;
  screen.reset(source());
  $('terminal-custom').hidden = true;
  for (const event of step.trace.events) screen.event(event, true);
  view.apply({
    kind: 'checkpoint',
    text: '',
    state: step.world.snapshot(),
    seq: 0,
    at: 0,
  });
  const activity = step.trace.events.findLast((e) =>
    ['capability_missing', 'capability_available'].includes(e.kind),
  );
  if (activity) view.apply(activity);
}
function scheduleRender() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    if (initialized) render();
  });
}
function render() {
  renderLesson();
  const step = host.current,
    trace = currentTrace();
  screen.context(
    `${steps[selected].meta.id}:${step.stage}`,
    reviewing ? recordedContext : config.mode === 'replay' ? '' : step.context,
  );
  view.idle(!step.busy && !isRecorded());
  if ($<HTMLDialogElement>('status-panel').open)
    renderStatus(
      currentState(),
      statusMessages(),
      trace,
      isRecorded() ? [] : step.tools,
      isRecorded(),
    );
  if ($<HTMLDialogElement>('history-panel').open) renderHistory(trace);
}

function statusMessages() {
  return isRecorded() && replayTrace
    ? (replayTrace.events
        .filter((event) => event.at <= (replay?.elapsed ?? 0))
        .findLast((event) => ['model_start', 'context'].includes(event.kind))
        ?.messages ?? [])
    : host.current.messages;
}
function currentTrace() {
  return isRecorded() && replayTrace ? replayTrace : host.current.trace;
}
function currentState() {
  return isRecorded() && replayTrace
    ? (replayTrace.events.filter((e) => e.at <= (replay?.elapsed ?? 0)).at(-1)
        ?.state ?? replayTrace.initial)
    : host.current.world.snapshot();
}
function loadReplay(id: string) {
  replay?.pause();
  replayTrace = recordings.get(id);
  if (!replayTrace) return;
  const targetArticle = recordingArticle(articles, replayTrace.lesson);
  if (!targetArticle) {
    fail(
      `This recording belongs to an unregistered article: ${replayTrace.lesson?.article}`,
    );
    return;
  }
  if (targetArticle.id !== article.id) {
    navigateArticle(targetArticle.id, id);
    return;
  }
  const recordedStep = replayStepIndex(targetArticle, replayTrace.lesson);
  select(recordedStep);
  screen.reset(source());
  view.recorded(true);
  view.apply({
    kind: 'checkpoint',
    text: '',
    state: replayTrace.initial,
    seq: 0,
    at: 0,
  });
  view.pause(true);
  replay = createReplay(replayTrace, apply);
  replay.restart();
  scheduleRender();
}
// Article review uses only the recording playhead; it never starts a runtime.
function reviewExecution(
  recording: import('../runtime/types.ts').Trace<unknown>,
  at?: number,
  seq?: number,
) {
  host.current.cancel();
  replay?.pause();
  replayTrace = parseTrace(JSON.stringify(recording));
  reviewing = true;
  recordedContext = '';
  screen.reset(source());
  view.recorded(true);
  view.pause(true);
  view.apply({
    kind: 'checkpoint',
    text: 'Recorded execution',
    state: replayTrace.initial,
    seq: 0,
    at: 0,
  });
  replay = createReplay(replayTrace, apply);
  $('replay-bar').hidden = false;
  if (at === undefined) {
    replay.restart();
    replay.play();
    view.pause(false);
  } else {
    replay.seek(at, seq);
    const point = replayTrace.events.findLast(
      (event) => event.at <= at && (seq === undefined || event.seq <= seq),
    );
    recordedContext = JSON.stringify(point, null, 2);
    const state = point?.state ?? replayTrace.initial;
    view.apply({
      kind: 'checkpoint',
      text: 'Recorded checkpoint',
      state,
      seq: 0,
      at,
    });
    view.pause(true);
  }
  scheduleRender();
}
$('settings-button').onclick = () => openPanel('settings');
$('status-button').onclick = () => {
  render();
  renderStatus(
    currentState(),
    statusMessages(),
    currentTrace(),
    isRecorded() ? [] : host.current.tools,
    isRecorded(),
  );
  openPanel('status');
};
$('history-button').onclick = () => {
  renderHistory(currentTrace());
  openPanel('history');
};
$<HTMLFormElement>('order-form').onsubmit = (event) => {
  event.preventDefault();
  config.order = $<HTMLTextAreaElement>('order').value;
  if (!config.order.trim()) {
    fail('Write a notice before posting.');
    return;
  }
  if (config.mode === 'replay') return;
  if (reviewing) {
    reviewing = false;
    replay?.pause();
    view.recorded(false);
    view.pause(false);
    $('replay-bar').hidden = true;
  }
  if (!host.current.busy) host.current.reset({ tools: host.current.tools });
  host.current.world.postNotice(config.order);
  $<HTMLDialogElement>('settings-panel').close();
  if (!host.current.busy)
    view.apply({
      kind: 'checkpoint',
      text: '',
      state: host.current.world.snapshot(),
      at: 0,
      seq: 0,
    });
};
$<HTMLSelectElement>('preset').onchange = (e) => {
  config.apples = Number((e.target as HTMLSelectElement).value);
};
for (const id of ['transport', 'endpoint', 'model'])
  $(id).onchange = () => {
    config.live = {
      transport: $<HTMLSelectElement>('transport').value as
        'ollama' | 'gateway',
      endpoint: $<HTMLInputElement>('endpoint').value,
      model: $<HTMLInputElement>('model').value,
    };
  };
$<HTMLSelectElement>('mode').onchange = () => {
  reviewing = false;
  host.current.cancel();
  replay?.pause();
  config.mode = $<HTMLSelectElement>('mode').value as Mode;
  view.recorded(config.mode === 'replay');
  screen.reset(source());
  $('live-settings').hidden = config.mode !== 'live';
  $('recording-settings').hidden = config.mode !== 'replay';
  $('replay-bar').hidden = config.mode !== 'replay';
  $<HTMLButtonElement>('post-order').disabled = config.mode === 'replay';
  $('error').hidden = true;
  $('mode-note').textContent =
    config.mode === 'mock'
      ? 'Deterministic demonstration. Real browser loop and tools; no backend or key.'
      : config.mode === 'replay'
        ? 'Recorded snapshots and movements. No provider calls or tool execution.'
        : 'Actual provider responses and tool outcomes. No automatic fallback to Mock.';
  host.resetAll();
  if (config.mode === 'replay')
    loadReplay($<HTMLSelectElement>('recording').value);
  else {
    view.pause(false);
    paintCheckpoint();
  }
  render();
};
$<HTMLSelectElement>('recording').onchange = () =>
  loadReplay($<HTMLSelectElement>('recording').value);
$('replay-play').onclick = () => {
  if (!replay) return;
  if (replay.playing) {
    replay.pause();
    view.pause(true);
  } else {
    replay.play();
    view.pause(false);
  }
};
$('replay-restart').onclick = () => {
  screen.reset(source());
  replay?.restart();
  view.pause(true);
};
view.onFrame((dt) => {
  if (!isRecorded() || !replay) return;
  replay.advance(dt * 1000);
  $('replay-time').textContent =
    `Recorded · ${(replay.elapsed / 1000).toFixed(1)} / ${(replay.duration / 1000).toFixed(1)}s`;
  $('replay-play').textContent = replay.playing ? 'Pause' : 'Play';
  if (!replay.playing) view.pause(true);
});
$('export').onclick = () => exportTrace(currentTrace());
$<HTMLInputElement>('import').onchange = async () => {
  try {
    const file = $<HTMLInputElement>('import').files?.[0];
    if (!file) return;
    const trace = parseTrace(await file.text());
    save(trace);
    $<HTMLSelectElement>('recording').value = trace.id;
    $<HTMLSelectElement>('mode').value = 'replay';
    $<HTMLSelectElement>('mode').dispatchEvent(new Event('change'));
    $<HTMLDialogElement>('history-panel').close();
  } catch (error) {
    fail(error);
  }
};
function film(value: boolean) {
  document.body.classList.toggle('film', value);
  $('film').setAttribute('aria-pressed', String(value));
}
$('film').onclick = () => film(!document.body.classList.contains('film'));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') film(false);
});
refreshRecordings();
initialized = true;
paintCheckpoint();
render();

const requestedRecording = parameters.get('recording');
if (requestedRecording && recordings.has(requestedRecording)) {
  $<HTMLSelectElement>('recording').value = requestedRecording;
  $<HTMLSelectElement>('mode').value = 'replay';
  $<HTMLSelectElement>('mode').dispatchEvent(new Event('change'));
}
