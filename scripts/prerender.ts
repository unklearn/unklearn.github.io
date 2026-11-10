import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { pages } from '../routes.ts';

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
  for (const page of pages) {
    if (page.kind === 'home' || !page.articleId) continue;
    const file = `${directory}${page.path}index.html`;
    const { lesson, count } = prerender(page.articleId);
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
