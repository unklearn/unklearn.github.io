import * as inform from './00-inform.mdx';
import * as experiment from './02-experiment.mdx';
import * as verify from './03-verify.mdx';
import { blocks } from '../scout-foundations/articles/what-makes-scout-an-agent/06-capabilities.mdx';
import type { LessonArticle } from '../../presentation/lesson-ui.tsx';
import { picnicScenario } from '../scout-foundations/scenario.ts';
import { articleIds } from '../../routes.ts';

export const article: LessonArticle<typeof picnicScenario> = {
  id: articleIds.lastApple,
  number: 1,
  title: 'The Last Apple',
  scenario: picnicScenario,
  runtime: blocks.dynamic,
  steps: [inform, experiment, verify],
  replayStepId: 'inform',
  legacyStepIds: ['inform', 'experiment'],
};
