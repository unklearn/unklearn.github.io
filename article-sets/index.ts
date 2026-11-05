import { loadArticles } from './registry.ts';
const markdown = import.meta.glob<string>('./*/articles/*/[0-9]*.md', { query: '?raw', import: 'default', eager: true });
export const articles = loadArticles(Object.fromEntries(Object.entries(markdown).map(([path, text]) => [`article-sets/${path.slice(2)}`, text])));
