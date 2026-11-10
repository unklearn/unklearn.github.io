import { defineConfig } from 'vite';
import type { ViteDevServer } from 'vite';
import mdx from '@mdx-js/rollup';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonCode } from './authoring/mdx-code.ts';
import { labs, pages } from './routes.ts';

const directoryRoutes = new Set<string>(pages.map(({ path }) => path));
const entries = pages.map((page) => ({
  ...page,
  file: fileURLToPath(new URL('.' + page.path + 'index.html', import.meta.url)),
}));

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderLabList() {
  return labs
    .map(
      ({ path, title, description, cover }, index) => `<li>
            <a class="lab-card" href=".${escapeHtml(path)}" aria-labelledby="lab-title-${index}">
              <div class="lab-cover" aria-hidden="true">${cover ? `<img src="${escapeHtml(cover)}" alt="" width="480" height="240" />` : ''}</div>
              <div class="lab-summary">
                <h3 id="lab-title-${index}">${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>
              </div>
              <span class="lab-open" aria-hidden="true">↗</span>
            </a>
          </li>`,
    )
    .join('\n          ');
}

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
          if (!entry) return html;
          if (entry.kind === 'home')
            return html.replace('<!-- lab-list -->', renderLabList);
          const { articleId, path, title, description } = entry;
          if (!articleId || !html.includes('<!-- scout-shell -->')) return html;
          const homeLink = '../'.repeat(path.split('/').filter(Boolean).length);
          const lab = entry.kind === 'lab';
          const shell = readFileSync(
            new URL('./scene/shell.html', import.meta.url),
            'utf8',
          );
          return shell
            .replace('%HOME_LINK%', homeLink)
            .replace('%ARTICLE_ID%', () => escapeHtml(articleId))
            .replace('%ARTICLE_TITLE%', () => escapeHtml(title))
            .replace('%ARTICLE_BRAND%', lab ? 'UNKLEARN' : 'SCOUT FOUNDATIONS')
            .replace('%ARTICLE_DESCRIPTION%', () => escapeHtml(description))
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
      input: entries.map(({ file }) => file),
    },
  },
}));
