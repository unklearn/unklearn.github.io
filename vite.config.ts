import { defineConfig } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { articleRegistry, loadArticles } from './article-sets/registry.ts';
import { escape, renderSlides } from './presentation/lesson-markup.ts';
import type { Excerpts } from './presentation/lesson-markup.ts';

const sources = [...new Set(articleRegistry.flatMap(article => article.sourceFiles))];
function readExcerpts(): Excerpts {
  const excerpts: Excerpts = {};
  for (const file of sources) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/@excerpt ([\w-]+) start/); if (!match) return;
      const end = lines.findIndex((l, n) => n > index && l.includes(`@excerpt ${match[1]} end`));
      if (end < 0 || excerpts[match[1]]) throw new Error(`Invalid excerpt ${match[1]}`);
      const block = lines.slice(index + 1, end), indent = Math.min(...block.filter(l => l.trim()).map(l => l.search(/\S/)));
      excerpts[match[1]] = { code: block.map(l => l.slice(indent)).join('\n'), file, line: index + 2 };
    });
  }
  return excerpts;
}
// The same slides are readable in HTML before JavaScript; no separate crawler article.
export default defineConfig({ base: './', plugins: [{
  name: 'static-lesson-slides',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      const content = Object.fromEntries(articleRegistry.flatMap(article => readdirSync(article.directory).filter(file => /^\d.*\.md$/.test(file)).map(file => [`${article.directory}/${file}`, readFileSync(`${article.directory}/${file}`, 'utf8')])));
      const articles = loadArticles(content);
      const excerpts = readExcerpts();
      const slides = articles.map(article => `<article data-article="${escape(article.id)}">${renderSlides(article.steps, excerpts, article.id)}</article>`).join('');
      return html.replace('<!-- article-title -->', escape(articles[0].title)).replace('<!-- lesson-slides -->', slides);
    },
  },
}] });
