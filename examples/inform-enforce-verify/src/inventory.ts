import type { DatabaseSync } from 'node:sqlite';
import { requireTask, transaction } from './database.ts';

export type Withdrawal = { itemId: string; quantity: number };
export type Operation = {
  operationId: string;
  callerId: string;
  taskId: string;
};
export type WithdrawalResult =
  | {
      code: 'WITHDRAWAL_COMPLETED';
      remaining: number;
      reservedMinimum: number;
    }
  | {
      code:
        | 'ITEM_NOT_FOUND'
        | 'INSUFFICIENT_STOCK'
        | 'RESERVE_MINIMUM_VIOLATION'
        | 'OPERATION_ID_CONFLICT'
        | 'INVALID_ARGUMENTS';
    };

export type Stock = Withdrawal & { reservedMinimum: number };

export function inspectInventory(db: DatabaseSync): Stock[] {
  return db
    .prepare(
      `SELECT item_id AS itemId, quantity, reserved_minimum AS reservedMinimum
     FROM inventory ORDER BY item_id`,
    )
    .all()
    .map((row) => ({
      itemId: String(row.itemId),
      quantity: Number(row.quantity),
      reservedMinimum: Number(row.reservedMinimum),
    }));
}

export function withdrawItem(
  db: DatabaseSync,
  operation: Operation,
  { itemId, quantity }: Withdrawal,
): WithdrawalResult {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    return { code: 'INVALID_ARGUMENTS' };
  const { operationId, callerId, taskId } = operation;

  return transaction(db, 'BEGIN IMMEDIATE', () => {
    const prior = db
      .prepare(
        'SELECT caller_id, task_id, item_id, quantity, result FROM operations WHERE operation_id = ?',
      )
      .get(operationId);
    if (prior) {
      if (
        prior.caller_id !== callerId ||
        prior.task_id !== taskId ||
        prior.item_id !== itemId ||
        prior.quantity !== quantity
      )
        return { code: 'OPERATION_ID_CONFLICT' };
      return JSON.parse(String(prior.result)) as WithdrawalResult;
    }

    requireTask(db, taskId);
    const updated = db
      .prepare(
        `
      UPDATE inventory
      SET quantity = quantity - :quantity
      WHERE item_id = :itemId
        AND quantity >= :quantity
        AND quantity - :quantity >= reserved_minimum
      RETURNING quantity AS remaining, reserved_minimum AS reservedMinimum
    `,
      )
      .get({ itemId, quantity }) as
      { remaining: number; reservedMinimum: number } | undefined;

    let result: WithdrawalResult;
    if (updated) {
      db.prepare(
        `
        INSERT INTO scout_inventory (task_id, item_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT (task_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity
      `,
      ).run(taskId, itemId, quantity);
      result = { code: 'WITHDRAWAL_COMPLETED', ...updated };
    } else {
      const item = db
        .prepare('SELECT quantity FROM inventory WHERE item_id = ?')
        .get(itemId);
      result = {
        code: !item
          ? 'ITEM_NOT_FOUND'
          : Number(item.quantity) < quantity
            ? 'INSUFFICIENT_STOCK'
            : 'RESERVE_MINIMUM_VIOLATION',
      };
    }

    db.prepare('INSERT INTO operations VALUES (?, ?, ?, ?, ?, ?)').run(
      operationId,
      callerId,
      taskId,
      itemId,
      quantity,
      JSON.stringify(result),
    );
    return result;
  });
}
