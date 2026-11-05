import { createServer } from 'vite';
import type { LessonArticle } from '../presentation/lesson-ui.tsx';
// Node tools use the same MDX compiler as the static build, without opening a port.
export async function loadArticle(): Promise<LessonArticle> {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  try { return (await server.ssrLoadModule('/article-sets/registry.ts')).articleRegistry[0]; }
  finally { await server.close(); }
}
