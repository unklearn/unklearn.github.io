import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { routeArticle, routes } from '../routes.ts';

const release = process.argv.includes('--release');
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { prerender } = await server.ssrLoadModule(
    '/presentation/prerender.tsx',
  );
  const directory = release ? 'dist-release' : 'dist';
  for (const route of Object.values(routes)) {
    const file = `${directory}${route}index.html`;
    const { lesson, count } = prerender(
      routeArticle(route, release ? 'release' : 'production'),
    );
    writeFileSync(
      file,
      readFileSync(file, 'utf8')
        .replace('<!-- lesson-slides -->', () => lesson)
        .replace('<!-- step-count -->', `STEP 1/${count}`),
    );
  }
} finally {
  await server.close();
}
