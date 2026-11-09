import { defineConfig } from 'vite';
import mdx from '@mdx-js/rollup';
import { fileURLToPath } from 'node:url';
import { lessonCode } from './authoring/mdx-code.ts';
import { routes } from './routes.ts';

export default defineConfig({
  base: './',
  plugins: [lessonCode(), mdx()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(routes).map(([id, route]) => [
          id,
          fileURLToPath(new URL('.' + route + 'index.html', import.meta.url)),
        ]),
      ),
    },
  },
});
