import { createServer } from 'vite';
import type { article } from '../article-sets/scout-foundations/articles/what-makes-scout-an-agent/article.ts';
// Node tools use the same MDX compiler as the static build, without opening a port.
export async function loadArticle(): Promise<typeof article> {
  const server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
  });
  try {
    return (await server.ssrLoadModule('/article-sets/registry.ts'))
      .articleRegistry[0];
  } finally {
    await server.close();
  }
}
