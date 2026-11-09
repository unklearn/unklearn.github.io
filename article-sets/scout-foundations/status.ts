import type { Snapshot, Trace } from './types.ts';
import type { Message } from '../../runtime/types.ts';
import { escape } from '../../presentation/content.ts';
export function renderStatus(
  state: Snapshot,
  messages: readonly Message[],
  trace: Trace,
  activeTools: readonly string[],
  recorded = false,
) {
  const observations = messages
    .filter((m) => m.role === 'tool')
    .map((m) => ({ name: m.tool_name, result: JSON.parse(m.content) }));
  const supplied = messages
    .filter((m) => m.role === 'user')
    .map((m) => {
      try {
        return JSON.parse(m.content) as {
          notice?: string;
          pantry?: Snapshot['pantry'];
        };
      } catch {
        return {};
      }
    })
    .findLast((value) => value.pantry);
  const knowledge =
    observations.findLast((o) => o.name === 'inspect_pantry' && o.result.ok)
      ?.result.pantry ?? supplied?.pantry;
  const read =
    !!supplied?.notice ||
    observations.some((o) => o.name === 'read_notice' && o.result.ok);
  const counts = (stock: Snapshot['pantry']) =>
    `${stock.apple} apple(s), ${stock.carrot} carrot(s)`;
  const pairs = [
    ['Place', state.place ?? 'Walking'],
    ['Carrying', state.carried ?? 'Empty hands'],
    ['Pantry now', counts(state.pantry)],
    ['Basket now', counts(state.basket)],
    ['Unread notice', state.unread ? 'Yes · amber light on' : 'No'],
    [
      recorded ? 'Recorded provider calls' : 'Provider calls',
      trace.events.filter((e) => e.kind === 'model_start').length,
    ],
    [
      recorded ? 'Recorded tool results' : 'Tools executed',
      trace.events.filter(
        (e) =>
          e.kind === 'tool_result' &&
          e.result?.reason !== 'tool_unavailable' &&
          e.result?.source !== 'dispatcher',
      ).length,
    ],
    ['Active tools', activeTools.join(', ') || 'None'],
    [
      recorded ? 'Notice in recorded context' : 'Notice in model context',
      read ? 'Yes' : 'No',
    ],
    [
      recorded ? 'Stock in recorded context' : 'Last stock in model context',
      knowledge ? counts(knowledge) : 'Unknown',
    ],
  ];
  document.querySelector('#status-content')!.innerHTML =
    `${recorded ? '<p>Replay executes zero provider calls and zero tools. Counts below belong to the recording.</p>' : ''}<dl>${pairs.map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`;
}
