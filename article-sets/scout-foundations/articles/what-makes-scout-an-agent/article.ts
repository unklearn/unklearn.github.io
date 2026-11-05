import * as meet from './01-meet.mdx';
import * as tools from './02-tools.mdx';
import * as execute from './03-execute.mdx';
import * as feedback from './04-feedback.mdx';
import * as picnic from './05-picnic.mdx';
import type { LessonArticle } from '../../../../presentation/lesson-ui.tsx';
export const article: LessonArticle = {
  id: 'what-makes-scout-an-agent', title: 'What makes Scout an agent?',
  steps: [meet, tools, execute, feedback, picnic], replayStepId: 'picnic',
  legacyStepIds: ['meet', 'turn', 'repeat', 'tool', 'execute', 'context', 'picnic'],
  stepAliases: { turn: 'tool', repeat: 'tool' },
};
