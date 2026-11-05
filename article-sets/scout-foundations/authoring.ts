import { useLessonStep } from '../../presentation/lesson-ui.tsx';
import type { ScoutStep } from './session.ts';
export const useScoutStep = () => useLessonStep<ScoutStep>();
