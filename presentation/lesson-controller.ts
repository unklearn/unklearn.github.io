import type { TeachingStep } from './teaching.ts';

// Navigation only. It never evaluates a provider or executes a tool.
export function createLessonController(steps: readonly TeachingStep[], select: (index: number) => void) {
  let index = 0, collapsed = false;
  return {
    get index() { return index; }, get step() { return steps[index]; },
    get collapsed() { return collapsed; },
    go(next: number) { if (next >= 0 && next < steps.length && next !== index) { index = next; select(index); } },
    collapse(value: boolean) { collapsed = value; },
  };
}
