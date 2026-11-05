import type { TeachingAction, TeachingStep, TeachingStage } from './teaching.ts';
import type { createLessonController } from './lesson-controller.ts';
import { escape } from './content.ts';
export function createPlayer(steps: readonly TeachingStep[], controller: ReturnType<typeof createLessonController>, action: (id: string) => void, actions: Readonly<Record<string, TeachingAction>>) {
  const app = document.querySelector<HTMLElement>('#app')!, pages = document.querySelector<HTMLElement>('#lesson-pages')!;
  const toc = document.querySelector<HTMLDialogElement>('#toc-panel')!;
  const contents = document.querySelector<HTMLElement>('#toc-steps')!;
  contents.innerHTML = steps.map((s, i) => `<button data-step="${i}"><span>${String(i+1).padStart(2,'0')}</span>${escape(s.title)}</button>`).join('');
  const sections = [...pages.querySelectorAll<HTMLElement>('[data-article]:not([hidden]) .teaching-step')];
  const states = steps.map(step => ({ stage: step.stages[0], busy: false }));
  function select(index: number) { controller.go(index); refresh(); pages.scrollTop = 0; }
  document.querySelector<HTMLButtonElement>('#toc-open')!.onclick = () => toc.showModal();
  contents.onclick = e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-step]');
    if (button) { select(Number(button.dataset.step)); toc.close(); }
  };
  document.querySelector<HTMLButtonElement>('#previous')!.onclick = () => select(controller.index - 1);
  document.querySelector<HTMLButtonElement>('#next')!.onclick = () => select(controller.index + 1);
  const toggle = document.querySelector<HTMLButtonElement>('#lesson-toggle')!;
  toggle.onclick = () => { controller.collapse(!controller.collapsed); refresh(); };
  pages.onclick = e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (button) action(button.dataset.action!);
  };
  function refresh() {
    app.classList.toggle('collapsed', controller.collapsed);
    toggle.setAttribute('aria-expanded', String(!controller.collapsed));
    toggle.title = controller.collapsed ? 'Show lesson' : 'Hide lesson'; toggle.setAttribute('aria-label', toggle.title);
    document.querySelector('#step-count')!.textContent = `${controller.index+1} / ${steps.length}`;
    contents.querySelectorAll('button').forEach((button, i) => { if (i === controller.index) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current'); });
    sections.forEach((section, i) => { section.classList.toggle('selected', i === controller.index); section.hidden = i !== controller.index; });
    document.querySelector<HTMLButtonElement>('#previous')!.disabled = controller.index === 0;
    document.querySelector<HTMLButtonElement>('#next')!.disabled = controller.index === steps.length - 1;
  }
  return {
    refresh,
    update(stage: TeachingStage, busy: boolean, replay: boolean) {
      states[controller.index] = { stage, busy }; refresh();
      sections.forEach((section, i) => {
        const selected = controller.index === i, current = states[i].stage;
        section.querySelector('.stage-instruction')!.textContent = selected && replay ? 'Replay shows recorded activity. Use Play and Restart in the world.' : current.instruction;
        section.querySelector<HTMLElement>('.actions')!.innerHTML = !replay ? current.actions.map((id, n) => `<button class="${n === current.actions.length - 1 ? 'primary' : ''}" data-action="${escape(id)}" ${!selected || (states[i].busy && !actions[id]?.whileBusy) ? 'disabled' : ''}>${escape(steps[i].actionLabels?.[id] ?? actions[id]?.label ?? id)}</button>`).join('') : '';
      });
    },
  };
}
