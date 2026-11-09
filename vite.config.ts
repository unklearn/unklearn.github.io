import { defineConfig } from 'vite';
import type { ViteDevServer } from 'vite';
import mdx from '@mdx-js/rollup';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonCode } from './authoring/mdx-code.ts';
import { articleIds, routeArticle, routes } from './routes.ts';

const directoryRoutes = new Set<string>(Object.values(routes));
const entries = Object.entries(routes).map(([id, route]) => ({
  id,
  route,
  file: fileURLToPath(new URL('.' + route + 'index.html', import.meta.url)),
}));

function redirectDirectoryRoutes({
  middlewares,
}: Pick<ViteDevServer, 'middlewares'>) {
  middlewares.use((request, response, next) => {
    const url = request.url ?? '';
    const [pathname] = url.split('?');
    if (!directoryRoutes.has(`${pathname}/`)) return next();
    response.writeHead(307, {
      Location: `${pathname}/${url.slice(pathname.length)}`,
    });
    response.end();
  });
}

export default defineConfig(({ mode }) => ({
  base: './',
  appType: 'mpa',
  plugins: [
    lessonCode(),
    mdx(),
    {
      name: 'unklearn-static-routes',
      configureServer: redirectDirectoryRoutes,
      configurePreviewServer: redirectDirectoryRoutes,
      transformIndexHtml: {
        order: 'pre',
        handler(html, { filename }) {
          const entry = entries.find(({ file }) => file === filename);
          if (!entry || !html.includes('<!-- scout-shell -->')) return html;
          const article = routeArticle(entry.route, mode);
          const lab = article === articleIds.lastApple;
          const shell = readFileSync(
            new URL('./scene/shell.html', import.meta.url),
            'utf8',
          );
          return shell
            .replace('%ARTICLE_ID%', article)
            .replace(
              '%ARTICLE_TITLE%',
              lab ? 'The Last Apple' : 'From a Model to an AI Agent',
            )
            .replace('%ARTICLE_BRAND%', lab ? 'UNKLEARN' : 'SCOUT FOUNDATIONS')
            .replace(
              '%ARTICLE_DESCRIPTION%',
              lab
                ? 'Replay a real agent failure and test where to enforce an inventory reserve.'
                : 'Teach an agent runtime by giving Scout, a village courier, tools and feedback.',
            )
            .replace(
              '<!-- robots -->',
              !lab && mode === 'release'
                ? '<meta name="robots" content="noindex" />'
                : '',
            );
        },
      },
    },
  ],
  build: {
    outDir: mode === 'release' ? 'dist-release' : 'dist',
    rollupOptions: {
      input: Object.fromEntries(entries.map(({ id, file }) => [id, file])),
    },
  },
}));
