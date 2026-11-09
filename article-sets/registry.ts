import type { LessonArticle } from '../presentation/lesson-ui.tsx';
import type { Trace } from '../runtime/types.ts';
import { article } from './scout-foundations/articles/what-makes-scout-an-agent/article.ts';
import { article as lastApple } from './last-apple/article.ts';
export const articleRegistry: readonly (typeof article)[] = [
  article,
  lastApple,
];
export function selectArticle<T extends LessonArticle>(
  articles: readonly T[],
  id?: string | null,
) {
  const selected = id
    ? articles.find((article) => article.id === id)
    : articles[0];
  if (!selected) throw new Error(`Unknown article: ${id}`);
  return selected;
}
export function recordingArticle<T extends LessonArticle>(
  articles: readonly T[],
  lesson?: Trace<unknown>['lesson'],
) {
  return lesson?.article
    ? articles.find((article) => article.id === lesson.article)
    : articles[0];
}
export function replayStepIndex(
  article: LessonArticle,
  lesson?: Trace<unknown>['lesson'],
) {
  const id =
    lesson?.stepId ??
    (lesson ? article.legacyStepIds?.[lesson.step - 1] : undefined) ??
    article.replayStepId;
  return Math.max(
    0,
    article.steps.findIndex(
      (step) => step.meta.id === (article.stepAliases?.[id] ?? id),
    ),
  );
}
