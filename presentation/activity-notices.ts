import type { RuntimeEvent } from '../runtime/types.ts';

function requestText({
  name,
  arguments: args,
}: NonNullable<RuntimeEvent['tool']>) {
  switch (name) {
    case 'read_notice':
      return 'Read the noticeboard.';
    case 'walk_to':
      return `Walk to the ${String(args?.place ?? 'destination').replaceAll('_', ' ')}.`;
    case 'inspect_pantry':
      return 'Inspect the pantry.';
    case 'take_one':
      return `Pick up one ${String(args?.item ?? 'item')}.`;
    case 'deliver_item':
      return 'Deliver the carried item to the basket.';
    default:
      return name.replaceAll('_', ' ');
  }
}

function resultText(event: RuntimeEvent) {
  const result = event.result;
  if (!result) return;
  if (result.ok === false) {
    if (result.reason === 'reserve_minimum')
      return 'Pickup refused. The last apple stays on the shelf.';
    if (result.reason === 'out_of_stock')
      return 'Pickup failed. That item is out of stock.';
    return `Request failed. ${String(result.reason ?? 'The tool could not complete the request.').replaceAll('_', ' ')}`;
  }
  if (typeof result.notice === 'string')
    return result.notice || 'The board is empty.';
  const pantry = result.pantry;
  if (
    pantry &&
    typeof pantry === 'object' &&
    'apple' in pantry &&
    'carrot' in pantry
  ) {
    const count = (n: unknown, item: string) =>
      `${n} ${item}${n === 1 ? '' : 's'}`;
    return `Pantry: ${count(pantry.apple, 'apple')} and ${count(pantry.carrot, 'carrot')}.`;
  }
  if (typeof result.item === 'string')
    return result.basket
      ? `Scout delivered one ${result.item}.`
      : `Scout picked up one ${result.item}.`;
  if (typeof result.place === 'string')
    return `Scout arrived at the ${result.place.replaceAll('_', ' ')}.`;
  if (result.ok === true) return 'The operation completed.';
}

export function createActivityNotices() {
  const region = document.querySelector<HTMLElement>('#scout-notices')!;
  const pending = region.querySelector<HTMLElement>('.notice-pending')!;
  const list = region.querySelector<HTMLOListElement>('ol')!;
  type Card = { element: HTMLElement; timer?: ReturnType<typeof setTimeout> };
  const cards: Card[] = [];
  let paused = false;
  let recorded = false;

  function remove(card: Card) {
    clearTimeout(card.timer);
    card.element.remove();
    cards.splice(cards.indexOf(card), 1);
  }
  function expire(card: Card) {
    clearTimeout(card.timer);
    if (!paused) card.timer = setTimeout(() => remove(card), 6500);
  }
  function add(label: string, text: string) {
    if (recorded) label = `Recorded · ${label}`;
    if (cards.at(-1)?.element.textContent === label + text) return;
    const element = document.createElement('li');
    const heading = document.createElement('strong');
    const message = document.createElement('span');
    heading.textContent = label;
    message.textContent = text;
    element.append(heading, message);
    if (cards.length === 2) remove(cards[0]);
    const card = { element };
    cards.push(card);
    list.append(element);
    expire(card);
  }

  return {
    reset(source: string) {
      for (const card of [...cards]) remove(card);
      recorded = source.includes('RECORDED');
      paused = false;
      pending.hidden = true;
    },
    pause(value: boolean) {
      if (paused === value) return;
      paused = value;
      cards.forEach(expire);
    },
    visible(value: boolean) {
      region.hidden = !value;
    },
    event(event: RuntimeEvent) {
      const { kind, tool, text } = event;
      if (kind === 'model_start') {
        pending.textContent = recorded
          ? 'Recorded model call'
          : 'Scout is thinking…';
        pending.hidden = false;
      } else if (
        ['model_end', 'run_end', 'error', 'background_stopped'].includes(kind)
      ) {
        pending.hidden = true;
      }
      if (
        (kind === 'assistant' || kind === 'tool_start') &&
        tool &&
        (kind === 'tool_start' || !text.trim() || text === 'Tool requested')
      )
        add('Tool request', requestText(tool));
      else if ((kind === 'assistant' || kind === 'report') && text.trim())
        add('Scout’s response', text);
      else if (kind === 'tool_result' || kind === 'scripted_result') {
        const result = resultText(event);
        if (result)
          add(kind === 'tool_result' ? 'Tool result' : 'Script result', result);
      } else if (kind === 'error') add('Run stopped', text);
    },
  };
}
