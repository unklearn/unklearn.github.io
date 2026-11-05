import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { prerender } = await server.ssrLoadModule(
    '/presentation/prerender.tsx',
  );
  const file = 'dist/index.html';
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace('<!-- lesson-slides -->', prerender()),
  );
} finally {
  await server.close();
}
