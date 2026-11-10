import type { DatabaseSync } from 'node:sqlite';
import { requireTask, transaction } from './database.ts';
import { inspectInventory } from './inventory.ts';
import type { Stock, Withdrawal } from './inventory.ts';

export type PicnicEvidence = {
  pantry: Stock[];
  scout: Withdrawal[];
  successfulOperationIds: string[];
};

type Assessment = PicnicEvidence &
  (
    | { status: 'COMPLETED'; reason: 'ONE_SNACK_AND_RESERVE_INTACT' }
    | { status: 'INCOMPLETE'; reason: 'ELIGIBLE_SNACK_REMAINS' }
    | {
        status: 'BLOCKED';
        reason: 'RESERVE_BROKEN' | 'NO_ELIGIBLE_SNACK' | 'UNEXPECTED_HOLDINGS';
      }
  );

function isSnack(itemId: string) {
  return itemId === 'apple' || itemId === 'carrot';
}

export function assessPicnic(evidence: PicnicEvidence): Assessment {
  const { pantry, scout } = evidence;
  if (
    pantry.some(({ quantity, reservedMinimum }) => quantity < reservedMinimum)
  )
    return { ...evidence, status: 'BLOCKED', reason: 'RESERVE_BROKEN' };
  const held = scout[0];
  if (scout.length === 1 && held.quantity === 1 && isSnack(held.itemId))
    return {
      ...evidence,
      status: 'COMPLETED',
      reason: 'ONE_SNACK_AND_RESERVE_INTACT',
    };
  if (scout.length)
    return { ...evidence, status: 'BLOCKED', reason: 'UNEXPECTED_HOLDINGS' };
  if (
    pantry.some(
      ({ itemId, quantity, reservedMinimum }) =>
        isSnack(itemId) && quantity > reservedMinimum,
    )
  )
    return {
      ...evidence,
      status: 'INCOMPLETE',
      reason: 'ELIGIBLE_SNACK_REMAINS',
    };
  return { ...evidence, status: 'BLOCKED', reason: 'NO_ELIGIBLE_SNACK' };
}

export function evaluatePicnicOutcome(
  db: DatabaseSync,
  taskId: string,
): Assessment {
  return transaction(db, 'BEGIN', () => {
    requireTask(db, taskId);
    return assessPicnic({
      pantry: inspectInventory(db),
      scout: db
        .prepare(
          'SELECT item_id AS itemId, quantity FROM scout_inventory WHERE task_id = ? ORDER BY item_id',
        )
        .all(taskId)
        .map((row) => ({
          itemId: String(row.itemId),
          quantity: Number(row.quantity),
        })),
      successfulOperationIds: db
        .prepare(
          `
        SELECT operation_id FROM operations
        WHERE task_id = ? AND json_extract(result, '$.code') = 'WITHDRAWAL_COMPLETED'
        ORDER BY operation_id
      `,
        )
        .all(taskId)
        .map((row) => String(row.operation_id)),
    });
  });
}
