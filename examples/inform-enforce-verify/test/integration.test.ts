import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { concurrentWithdrawals } from '../src/concurrency.ts';
import { initializeDatabase, openDatabase } from '../src/database.ts';
import { dispatch, modelToolDefinition } from '../src/tool.ts';
import type { HostContext } from '../src/tool.ts';
import { evaluatePicnicOutcome } from '../src/verify.ts';

function fixture(t: TestContext, apples = 1) {
  const directory = mkdtempSync(join(tmpdir(), 'unklearn-sqlite-test-'));
  const filename = join(directory, 'inventory.sqlite');
  const db = openDatabase(filename);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  initializeDatabase(db, { apples });
  return { db, filename };
}

function host(operationId: string, taskId = 'picnic'): HostContext {
  return {
    caller: { id: 'scout', withdrawTaskIds: [taskId] },
    taskId,
    operationId,
  };
}

function propose(itemId: string, quantity = 1) {
  return { name: 'withdrawItem', arguments: { itemId, quantity } };
}

test('guidance alone does not authorize the last apple, and a carrot can complete the same task', (t) => {
  const { db } = fixture(t);
  assert.match(modelToolDefinition().description, /reserve minimum/);
  const attempt = dispatch(db, host('apple'), propose('apple'));
  assert.deepEqual(attempt, { code: 'RESERVE_MINIMUM_VIOLATION' });
  const afterRejection = evaluatePicnicOutcome(db, 'picnic');
  assert.equal(afterRejection.status, 'INCOMPLETE');
  assert.deepEqual(afterRejection.pantry[0], {
    itemId: 'apple',
    quantity: 1,
    reservedMinimum: 1,
  });
  assert.deepEqual(afterRejection.scout, []);
  assert.deepEqual(afterRejection.successfulOperationIds, []);

  assert.equal(
    dispatch(db, host('carrot'), propose('carrot')).code,
    'WITHDRAWAL_COMPLETED',
  );
  const afterRecovery = evaluatePicnicOutcome(db, 'picnic');
  assert.equal(afterRecovery.status, 'COMPLETED');
  assert.deepEqual(afterRecovery.scout, [{ itemId: 'carrot', quantity: 1 }]);
  assert.deepEqual(afterRecovery.successfulOperationIds, ['carrot']);
  assert.deepEqual(
    afterRecovery.pantry.map(({ quantity }) => quantity),
    [1, 2],
  );
});

test('the CLI reports an incomplete task despite a scripted model success claim', () => {
  const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const output = execFileSync(process.execPath, [cli, 'demo', 'B'], {
    encoding: 'utf8',
  });
  assert.match(output, /Execution: \{\s*"code": "RESERVE_MINIMUM_VIOLATION"/);
  assert.match(
    output,
    /Unsupported scripted model claim: "I completed the picnic\.".*Outcome: \{[\s\S]*?"status": "INCOMPLETE"/s,
  );
});

test('a permitted apple transfer persists both sides and a receipt across connections', (t) => {
  const { db, filename } = fixture(t, 2);
  assert.deepEqual(dispatch(db, host('take'), propose('apple')), {
    code: 'WITHDRAWAL_COMPLETED',
    remaining: 1,
    reservedMinimum: 1,
  });
  const reader = openDatabase(filename);
  try {
    const result = evaluatePicnicOutcome(reader, 'picnic');
    assert.equal(result.status, 'COMPLETED');
    assert.deepEqual(result.scout, [{ itemId: 'apple', quantity: 1 }]);
    assert.deepEqual(
      result.pantry.map(({ quantity }) => quantity),
      [1, 3],
    );
    assert.deepEqual(result.successfulOperationIds, ['take']);
    assert.equal(
      evaluatePicnicOutcome(reader, 'picnic-2').status,
      'INCOMPLETE',
    );
  } finally {
    reader.close();
  }
});

test('missing items, insufficient stock, and reserve refusals are distinct', (t) => {
  const { db } = fixture(t);
  assert.equal(
    dispatch(db, host('missing'), propose('pear')).code,
    'ITEM_NOT_FOUND',
  );
  assert.equal(
    dispatch(db, host('insufficient'), propose('apple', 2)).code,
    'INSUFFICIENT_STOCK',
  );
  assert.equal(
    dispatch(db, host('reserve'), propose('apple')).code,
    'RESERVE_MINIMUM_VIOLATION',
  );
  assert.deepEqual(
    evaluatePicnicOutcome(db, 'picnic').successfulOperationIds,
    [],
  );
});

test('operation IDs replay a stored result and reject changes to the request', (t) => {
  const { db, filename } = fixture(t, 2);
  const result = dispatch(db, host('retry'), propose('apple'));
  const retry = openDatabase(filename);
  try {
    assert.deepEqual(dispatch(retry, host('retry'), propose('apple')), result);
    assert.equal(
      dispatch(retry, host('retry'), propose('carrot')).code,
      'OPERATION_ID_CONFLICT',
    );
    assert.equal(
      dispatch(retry, host('retry'), propose('apple', 2)).code,
      'OPERATION_ID_CONFLICT',
    );
    assert.equal(
      dispatch(retry, host('retry', 'picnic-2'), propose('apple')).code,
      'OPERATION_ID_CONFLICT',
    );
    const otherCaller = {
      ...host('retry'),
      caller: { id: 'other', withdrawTaskIds: ['picnic'] },
    };
    assert.equal(
      dispatch(retry, otherCaller, propose('apple')).code,
      'OPERATION_ID_CONFLICT',
    );
    assert.equal(
      dispatch(retry, host('refused'), propose('apple')).code,
      'RESERVE_MINIMUM_VIOLATION',
    );
    db.exec("UPDATE inventory SET quantity = 2 WHERE item_id = 'apple'");
    assert.equal(
      dispatch(retry, host('refused'), propose('apple')).code,
      'RESERVE_MINIMUM_VIOLATION',
    );
    const outcome = evaluatePicnicOutcome(retry, 'picnic');
    assert.deepEqual(outcome.scout, [{ itemId: 'apple', quantity: 1 }]);
    assert.deepEqual(outcome.successfulOperationIds, ['retry']);
    assert.equal(outcome.pantry[0].quantity, 2);
  } finally {
    retry.close();
  }
});

test('a database failure after the decrement and credit rolls back the whole transfer', (t) => {
  const { db, filename } = fixture(t, 2);
  db.exec(`
    CREATE TRIGGER fail_receipt BEFORE INSERT ON operations BEGIN
      SELECT RAISE(ABORT, 'forced receipt failure');
    END;
  `);
  assert.throws(
    () => dispatch(db, host('retry'), propose('apple')),
    /forced receipt failure/,
  );
  const reader = openDatabase(filename);
  try {
    const afterFailure = evaluatePicnicOutcome(reader, 'picnic');
    assert.equal(afterFailure.pantry[0].quantity, 2);
    assert.deepEqual(afterFailure.scout, []);
    assert.equal(
      reader.prepare('SELECT COUNT(*) AS count FROM operations').get()?.count,
      0,
    );
  } finally {
    reader.close();
  }
  db.exec('DROP TRIGGER fail_receipt');
  assert.equal(
    dispatch(db, host('retry'), propose('apple')).code,
    'WITHDRAWAL_COMPLETED',
  );
});

test('separate SQLite connections compete for one unreserved apple', async (t) => {
  const { db, filename } = fixture(t, 2);
  const hosts = [host('left'), host('right', 'picnic-2')] as const;
  const results = await concurrentWithdrawals(
    filename,
    hosts,
    propose('apple'),
  );
  assert.deepEqual(results.map(({ code }) => code).sort(), [
    'RESERVE_MINIMUM_VIOLATION',
    'WITHDRAWAL_COMPLETED',
  ]);
  for (const [index, context] of hosts.entries()) {
    const won = results[index].code === 'WITHDRAWAL_COMPLETED';
    const outcome = evaluatePicnicOutcome(db, context.taskId);
    assert.equal(outcome.pantry[0].quantity, 1);
    assert.equal(outcome.status, won ? 'COMPLETED' : 'INCOMPLETE');
    assert.deepEqual(
      outcome.scout,
      won ? [{ itemId: 'apple', quantity: 1 }] : [],
    );
    assert.deepEqual(
      outcome.successfulOperationIds,
      won ? [context.operationId] : [],
    );
  }
});

test('verification blocks excess holdings and an empty task with no eligible snack', (t) => {
  const { db } = fixture(t);
  assert.equal(
    dispatch(db, host('too-many'), propose('carrot', 2)).code,
    'WITHDRAWAL_COMPLETED',
  );
  assert.equal(
    evaluatePicnicOutcome(db, 'picnic').reason,
    'UNEXPECTED_HOLDINGS',
  );
  assert.equal(
    dispatch(db, host('last-carrot'), propose('carrot')).code,
    'WITHDRAWAL_COMPLETED',
  );
  assert.equal(
    evaluatePicnicOutcome(db, 'picnic-2').reason,
    'NO_ELIGIBLE_SNACK',
  );
});

test('initialization preserves a demo and reset restores the seeds and clears receipts', (t) => {
  const { db } = fixture(t);
  dispatch(db, host('prior'), propose('carrot'));
  initializeDatabase(db);
  assert.equal(evaluatePicnicOutcome(db, 'picnic').status, 'COMPLETED');
  initializeDatabase(db, { reset: true });
  const reset = evaluatePicnicOutcome(db, 'picnic');
  assert.equal(reset.status, 'INCOMPLETE');
  assert.deepEqual(
    reset.pantry.map(({ quantity }) => quantity),
    [1, 3],
  );
  assert.deepEqual(reset.scout, []);
  assert.deepEqual(reset.successfulOperationIds, []);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM operations').get()?.count,
    0,
  );
});
