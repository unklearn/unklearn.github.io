import { readFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { transformWithEsbuild } from 'vite';
import type { Plugin } from 'vite';

export interface CodeBlock { id: string; kind: 'runtime' | 'setup' | 'experiment'; source: string }
// Deliberately small authoring syntax: complete TypeScript modules in named fences.
export function extractBlocks(text: string) {
  const blocks: CodeBlock[] = [];
  const content = text.replace(/^```ts (runtime|setup|experiment)="([\w-]+)"\r?\n([\s\S]*?)^```[ \t]*$/gm, (_, kind, id, code) => {
    if (blocks.some(block => block.id === id)) throw new Error(`Duplicate MDX code block: ${id}`);
    blocks.push({ id, kind, source: code.replace(/\r\n/g, '\n').replace(/\n$/, '') });
    return ''; // The lesson explicitly chooses where and how to display this source.
  });
  return { blocks, content };
}
export function lessonCode(): Plugin {
  return {
    name: 'executable-mdx-blocks', enforce: 'pre',
    resolveId(id, importer) {
      if (!id.includes('.mdx?block=')) return;
      const [file, query] = id.split('?');
      return `${isAbsolute(file) ? file : resolve(dirname(importer!.split('?')[0]), file)}?${query}`;
    },
    async load(id) {
      if (!id.includes('.mdx?block=')) return;
      const [file, query] = id.split('?'); this.addWatchFile(file);
      const block = extractBlocks(readFileSync(file, 'utf8')).blocks.find(b => b.id === new URLSearchParams(query).get('block'));
      if (!block) throw new Error(`Missing block: ${id}`);
      return (await transformWithEsbuild(block.source, `${file}.${block.id}.ts`, { loader: 'ts', sourcemap: true })).code;
    },
    transform(text, id) {
      if (!id.endsWith('.mdx')) return;
      const { blocks, content } = extractBlocks(text);
      const imports = blocks.map((block, n) => `import * as __block${n} from ${JSON.stringify(`${id}?block=${block.id}`)};`).join('\n');
      const exports = `export const blocks = {${blocks.map((b, n) => `${JSON.stringify(b.id)}: {id:${JSON.stringify(b.id)},kind:${JSON.stringify(b.kind)},source:${JSON.stringify(b.source)},module:__block${n}}`).join(',')}};`;
      return `${imports}\n\n${exports}\n\n${content}`;
    },
    handleHotUpdate(context) {
      if (!context.file.endsWith('.mdx')) return;
      // Dependent steps can import earlier runtime blocks. A full refresh safely cancels takes.
      for (const mod of context.server.moduleGraph.getModulesByFile(context.file) ?? []) context.server.moduleGraph.invalidateModule(mod);
      context.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
