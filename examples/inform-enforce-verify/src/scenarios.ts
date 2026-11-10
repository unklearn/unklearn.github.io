import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { concurrentWithdrawals } from './concurrency.ts';
import { initializeDatabase, openDatabase } from './database.ts';
import { inspectInventory } from './inventory.ts';
import type { Stock } from './inventory.ts';
import { dispatch, modelToolDefinition } from './tool.ts';
import type { DispatchResult, HostContext } from './tool.ts';
import { assessPicnic, evaluatePicnicOutcome } from './verify.ts';

export const scenarios = {
  A: 'Intentionally unsafe in-memory baseline',
  B: 'Authoritative reserve rejection',
  C: 'Scripted recovery after a refusal',
  D: 'Legitimate apple withdrawal',
  E: 'Concurrent withdrawals against one reserve',
} as const;

type Scenario = keyof typeof scenarios;
const notice = 'Prepare one picnic snack. Prefer an apple. A carrot is fine.';

function show(label: string, value: unknown) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`);
}

function proposeSnack(stock: Stock[], previous?: DispatchResult) {
  const input = { notice, stock, tool: modelToolDefinition(), previous };
  show('Scripted model input', input);
  const canTakeCarrot = stock.some(
    ({ itemId, quantity, reservedMinimum }) =>
      itemId === 'carrot' && quantity > reservedMinimum,
  );
  // The initial fixture deliberately asks for an apple even when it is reserved.
  const itemId =
    previous?.code === 'RESERVE_MINIMUM_VIOLATION' && canTakeCarrot
      ? 'carrot'
      : 'apple';
  const proposal = {
    name: input.tool.name,
    arguments: { itemId, quantity: 1 },
  };
  show('Scripted proposal', proposal);
  return proposal;
}

function host(taskId: string, operationId: string): HostContext {
  return {
    caller: { id: 'scout', withdrawTaskIds: [taskId] },
    taskId,
    operationId,
  };
}

function runUnsafeBaseline() {
  const apple = { itemId: 'apple', quantity: 1, reservedMinimum: 1 };
  const pantry = [apple, { itemId: 'carrot', quantity: 3, reservedMinimum: 0 }];
  const { arguments: snack } = proposeSnack(pantry);
  // This isolated teaching baseline checks availability and skips the reserve.
  if (snack.itemId !== apple.itemId || apple.quantity < snack.quantity)
    throw new Error('The unsafe demo expects an in-stock apple request');
  apple.quantity -= snack.quantity;
  show('Unsafe transfer', {
    code: 'WITHDRAWAL_COMPLETED',
    remaining: apple.quantity,
  });
  show(
    'Outcome',
    assessPicnic({ pantry, scout: [snack], successfulOperationIds: [] }),
  );
}

export async function runScenario(scenario: Scenario) {
  console.log(`\n${scenario}. ${scenarios[scenario]}`);
  if (scenario === 'A') return runUnsafeBaseline();

  const directory = mkdtempSync(join(tmpdir(), 'unklearn-picnic-'));
  const filename = join(directory, 'inventory.sqlite');
  try {
    const db = openDatabase(filename);
    try {
      initializeDatabase(db, {
        apples: scenario === 'D' || scenario === 'E' ? 2 : 1,
      });
      const proposal = proposeSnack(inspectInventory(db));
      if (scenario === 'E') {
        const hosts = [
          host('picnic', 'concurrent-1'),
          host('picnic-2', 'concurrent-2'),
        ] as const;
        const results = await concurrentWithdrawals(filename, hosts, proposal);
        for (const [index, context] of hosts.entries()) {
          show(`Execution (${context.taskId})`, results[index]);
          show(
            `Outcome (${context.taskId})`,
            evaluatePicnicOutcome(db, context.taskId),
          );
        }
        return;
      }

      const result = dispatch(db, host('picnic', 'first-withdrawal'), proposal);
      show('Execution', result);
      if (scenario === 'B')
        show('Unsupported scripted model claim', 'I completed the picnic.');
      show('Outcome', evaluatePicnicOutcome(db, 'picnic'));
      if (scenario === 'C') {
        if (result.code !== 'RESERVE_MINIMUM_VIOLATION')
          throw new Error(`Expected a reserve refusal, got ${result.code}`);
        const alternative = proposeSnack(inspectInventory(db), result);
        show(
          'Execution',
          dispatch(db, host('picnic', 'alternative-withdrawal'), alternative),
        );
        show('Outcome', evaluatePicnicOutcome(db, 'picnic'));
      }
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
