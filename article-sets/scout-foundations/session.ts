import { createSessionHost } from '../../runtime/session.ts';
import { picnicScenario } from './scenario.ts';
import type { Settings, Initial, StepMeta } from './scenario.ts';
import type { Clock } from '../../runtime/types.ts';
import type { Trace, TraceEvent } from './types.ts';
export type { Settings, StepMeta } from './scenario.ts';
export function createLessonHost(options: { articleId: string; steps: readonly StepMeta[]; scenario?: typeof picnicScenario; settings:()=>Settings; clock?:Clock; event?:(event:TraceEvent)=>void;changed?:()=>void;saved?:(trace:Trace)=>void }) {
  return createSessionHost({ ...options, scenario: options.scenario ?? picnicScenario });
}
export type LessonHost = ReturnType<typeof createLessonHost>;
export type ScoutStep = LessonHost['current'];
export type { Initial };
