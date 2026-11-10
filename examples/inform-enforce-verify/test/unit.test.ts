import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/database.ts';
import { dispatch, modelToolDefinition } from '../src/tool.ts';
import type { HostContext } from '../src/tool.ts';
import { assessPicnic } from '../src/verify.ts';

const host: HostContext = {
  caller: { id: 'scout', withdrawTaskIds: ['picnic'] },
  taskId: 'picnic',
  operationId: 'unit',
};

test('model-facing guidance is text and the schema exposes only withdrawal arguments', () => {
  const definition = modelToolDefinition();
  assert.match(definition.description, /configured reserve minimum/);
  assert.match(definition.description, /observed stock counts/);
  assert.deepEqual(definition.parameters.required, ['itemId', 'quantity']);
  assert.equal(definition.parameters.additionalProperties, false);
  assert.equal(
    definition.parameters.properties.quantity.maximum,
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(Object.hasOwn(definition, 'guidance'), false);
});

test('dispatcher rejects unknown tools, malformed arguments, and denied callers before touching the database', () => {
  const db = openDatabase(':memory:');
  db.close();
  assert.deepEqual(dispatch(db, host, { name: 'grantPermission' }), {
    code: 'UNKNOWN_TOOL',
  });
  for (const args of [
    null,
    [],
    {},
    { itemId: '', quantity: 1 },
    { itemId: 'apple' },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'].map(
      (quantity) => ({ itemId: 'apple', quantity }),
    ),
    { itemId: 'apple', quantity: 1, callerId: 'admin' },
    { itemId: 'apple', quantity: 1, taskId: 'picnic-2' },
    { itemId: 'apple', quantity: 1, operationId: 'model-chosen' },
  ]) {
    assert.deepEqual(
      dispatch(db, host, { name: 'withdrawItem', arguments: args }),
      { code: 'INVALID_ARGUMENTS' },
    );
  }
  assert.deepEqual(
    dispatch(
      db,
      { ...host, taskId: 'picnic-2' },
      {
        name: 'withdrawItem',
        arguments: { itemId: 'apple', quantity: 1 },
      },
    ),
    { code: 'UNAUTHORIZED' },
  );
});

test('a held apple does not complete the picnic when the reserve was broken', () => {
  const result = assessPicnic({
    pantry: [{ itemId: 'apple', quantity: 0, reservedMinimum: 1 }],
    scout: [{ itemId: 'apple', quantity: 1 }],
    successfulOperationIds: [],
  });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'RESERVE_BROKEN');
});
