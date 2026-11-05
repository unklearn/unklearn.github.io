import { renderToString } from 'react-dom/server';
import { articleRegistry } from '../article-sets/registry.ts';
import { LessonPages } from './lesson-ui.tsx';
import { createLessonHost } from '../article-sets/scout-foundations/session.ts';
import { defaultOrder } from '../article-sets/scout-foundations/types.ts';
export function prerender() {
  return articleRegistry.map(article => {
    const host = createLessonHost({ articleId: article.id, steps: article.steps.map(step=>step.meta), settings: () => ({ mode:'mock', order:defaultOrder, apples:2, pauseInspection:true, live:{endpoint:'',model:''} }) });
    return renderToString(<LessonPages article={article} host={host} />);
  }).join('');
}
