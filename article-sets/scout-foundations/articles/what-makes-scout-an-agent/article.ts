import type { ArticleDefinition } from '../../../../presentation/teaching.ts';
import { actions, sourceFiles } from '../../capabilities.ts';
import { createSteps } from './steps.ts';

export const article: ArticleDefinition = {
  id: 'what-makes-scout-an-agent', setId: 'scout-foundations',
  title: 'What makes Scout an agent?',
  directory: 'article-sets/scout-foundations/articles/what-makes-scout-an-agent',
  createSteps, actions, sourceFiles, replayStepId: 'picnic',
  // Original recordings stored numbers. New recordings store stable article/step IDs.
  legacyStepIds: ['meet', 'turn', 'repeat', 'tool', 'execute', 'context', 'picnic'],
  stepAliases: { turn: 'tool', repeat: 'tool' },
};
