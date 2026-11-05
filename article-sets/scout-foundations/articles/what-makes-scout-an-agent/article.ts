import * as s0 from './01-script.mdx';
import * as s1 from './02-model.mdx';
import * as s2 from './03-tools.mdx';
import * as s3 from './04-without-feedback.mdx';
import * as s4 from './05-loop.mdx';
import * as s5 from './06-capabilities.mdx';
import * as s6 from './07-picnic.mdx';
import * as s7 from './08-agent.mdx';
import type { LessonArticle } from '../../../../presentation/lesson-ui.tsx';
import { picnicScenario } from '../../scenario.ts';
export const article: LessonArticle<typeof picnicScenario> = {
 id:'what-makes-scout-an-agent', number:1, title:'From a Model to an AI Agent', scenario:picnicScenario,
 steps:[s0,s1,s2,s3,s4,s5,s6,s7], runtime:s5.blocks.dynamic, replayStepId:'picnic',
 legacyStepIds:['meet','turn','repeat','tool','execute','context','picnic'], stepAliases:{turn:'model',repeat:'model'},
};
