export { escape } from './lesson-markup.ts';
const paths: Record<string, string> = {
  settings: '<path d="m9 3 1-1h4l1 3 3 1 2 2-1 3 1 3-2 2-3 1-1 3h-4l-1-3-3-1-2-2 1-3-1-3 2-2 3-1Z"/><circle cx="12" cy="11" r="3"/>',
  status: '<path d="M5 3h14v18H5zM8 8h8M8 12h5M8 16h8"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  lesson: '<path d="M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 16h4M17 8h4M17 16h4"/>',
};
export const icon = (id: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;
