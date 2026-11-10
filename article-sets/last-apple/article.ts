import * as inform from './00-inform.mdx';
import * as experiment from './02-experiment.mdx';
import * as verify from './03-verify.mdx';
import { blocks } from '../scout-foundations/articles/what-makes-scout-an-agent/06-capabilities.mdx';
import type { LessonArticle } from '../../presentation/lesson-ui.tsx';
import { picnicScenario } from '../scout-foundations/scenario.ts';
import { lastAppleLab } from '../../routes.ts';

export const article: LessonArticle<typeof picnicScenario> = {
  id: lastAppleLab.articleId,
  number: 1,
  title: lastAppleLab.title,
  scenario: picnicScenario,
  runtime: blocks.dynamic,
  steps: [inform, experiment, verify],
  replayStepId: 'inform',
  legacyStepIds: ['inform', 'experiment'],
};
