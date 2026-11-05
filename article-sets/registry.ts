import type { ArticleDefinition, TeachingArticle } from '../presentation/teaching.ts';
import type { Trace } from '../runtime/types.ts';
import { article as foundations } from './scout-foundations/articles/what-makes-scout-an-agent/article.ts';

// Register each article once. The static build and browser use this same list.
export const articleRegistry: readonly ArticleDefinition[] = [foundations];

export function loadArticles(markdown: Record<string, string>, registry = articleRegistry): TeachingArticle[] {
  return registry.map(article => {
    const prefix = `${article.directory}/`;
    const content = Object.fromEntries(Object.entries(markdown).filter(([path]) => path.startsWith(prefix)).map(([path, text]) => [path.slice(prefix.length), text]));
    return { ...article, steps: article.createSteps(content) };
  });
}
export function selectArticle(articles: readonly TeachingArticle[], id?: string | null) {
  const article = id ? articles.find(article => article.id === id) : articles[0];
  if (!article) throw new Error(`Unknown article: ${id}`);
  return article;
}
export function recordingArticle(articles: readonly TeachingArticle[], lesson?: Trace<unknown>['lesson']) {
  return lesson?.article ? articles.find(article => article.id === lesson.article)
    : articles.find(article => article.legacyStepIds) ?? articles[0];
}
export function replayStepIndex(article: TeachingArticle, lesson?: Trace<unknown>['lesson']) {
  const id = lesson?.stepId ?? (lesson ? article.legacyStepIds?.[lesson.step - 1] : undefined) ?? article.replayStepId;
  return Math.max(0, article.steps.findIndex(step => step.id === (article.stepAliases?.[id] ?? id)));
}
