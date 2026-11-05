import type { TeachingStep, TeachingStage } from '../../../../presentation/teaching.ts';
import { allTools } from '../../tools.ts';
const stage = (id: string, instruction: string, actions: string[], tools: readonly string[] = []): TeachingStage => ({ id, instruction, actions, tools });
export function createSteps(content: Record<string, string>): TeachingStep[] {
  return [
  { id: 'meet', title: 'Meet Scout', checkpoint: 'empty-board', experiment: 'patrol', markdown: content['01-meet.md'], excerpts: ['patrol'], stages: [
    stage('ready', 'Start Scout’s patrol. Then we’ll give it a job.', ['start']),
    stage('patrolling', 'Scout is following its route. Post a notice while it walks.', ['post']),
    stage('posted', 'The amber light is on. Watch Scout go to the notice board.', []),
    stage('passed', '> Scout cannot read the notice on the board. Next, give it a way to read.', []),
  ] },
  { id: 'tool', title: 'Introduce a reading tool', checkpoint: 'posted-board', experiment: 'approve', terminalDialogue: 'I need a way to read that notice.', context: 'tool-availability', markdown: content['04-tool.md'], excerpts: ['read-schema'], stages: [stage('ready', 'Let Scout think about the new notice. It has no reading tool yet.', ['run']), stage('needs-tool', 'Approve the reading tool.', ['approve']), stage('approved', 'Reading is now available. No tool has executed. Continue to request it.', [], ['read_notice'])] },
  { id: 'execute', title: 'Execute the request', checkpoint: 'posted-board', experiment: 'execute', context: 'held-observation', markdown: content['05-execute.md'], excerpts: ['execute'], stages: [stage('ready', 'Run a turn. Execute the request, then hold its result outside context.', ['run'], ['read_notice']), stage('held', 'The handler returned the notice. Continue to put that result into context.', [], ['read_notice']), stage('no-read', 'This turn did not return a notice. The terminal shows the actual response or failure. Run again to try another turn.', ['run'], ['read_notice'])] },
  { id: 'context', title: 'Put the result into context', checkpoint: 'posted-board', experiment: 'feedback', context: 'feedback', markdown: content['06-context.md'], excerpts: ['feedback','evaluate'], stages: [stage('ready', 'Read the notice first, using the real handler.', ['run'], ['read_notice']), stage('no-read', 'This turn did not return a notice. Read it before trying to append feedback.', ['run'], ['read_notice']), stage('held', 'Append the request and result, then evaluate again.', ['append'], ['read_notice']), stage('done', 'The next input contains the notice. Scout can now respond to the actual order.', [], ['read_notice'])] },
  { id: 'picnic', title: 'Complete the picnic', checkpoint: 'posted-board', experiment: 'picnic', context: 'pantry-observation', actionLabels: { run: 'Run picnic' }, markdown: content['07-picnic.md'], excerpts: ['feedback'], stages: [stage('ready', 'Post an order or use the default, then Run picnic.', ['post','run'], allTools), stage('inspected', 'Scout observed the pantry. Empty the apple shelf to make that observation stale, or Continue unchanged.', ['empty-apples','continue'], allTools), stage('done', 'The basket shows the actual delivery. Change only the apple preset and Run again to compare.', ['post','run'], allTools)] },
  ];
}
