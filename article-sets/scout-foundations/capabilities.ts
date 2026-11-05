import type { TeachingAction } from '../../presentation/teaching.ts';

// Labels and interactions provided by the Scout world, available to its articles.
export const actions: Record<string, TeachingAction> = {
  start: { label: 'Start lesson' }, post: { label: 'Post a notice', whileBusy: true },
  run: { label: 'Run' }, approve: { label: 'Approve' },
  append: { label: 'Append result & evaluate' },
  'empty-apples': { label: 'Empty apple shelf', whileBusy: true },
  continue: { label: 'Continue', whileBusy: true },
};
export const sourceFiles = [
  'runtime/loop.ts', 'article-sets/scout-foundations/world.ts',
  'article-sets/scout-foundations/tools.ts', 'article-sets/scout-foundations/driver.ts',
];
