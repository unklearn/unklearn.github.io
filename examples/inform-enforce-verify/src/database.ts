import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(filename: string) {
  return new DatabaseSync(filename, { timeout: 5_000 });
}

export function transaction<T>(
  db: DatabaseSync,
  begin: 'BEGIN' | 'BEGIN IMMEDIATE',
  work: () => T,
): T {
  db.exec(begin);
  try {
    const value = work();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

export function initializeDatabase(
  db: DatabaseSync,
  { apples = 1, reset = false }: { apples?: number; reset?: boolean } = {},
) {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  transaction(db, 'BEGIN IMMEDIATE', () => {
    db.exec(schema);
    if (reset)
      db.exec(`
        DELETE FROM operations;
        DELETE FROM scout_inventory;
        DELETE FROM tasks;
        DELETE FROM inventory;
      `);
    db.prepare(
      `INSERT INTO inventory VALUES ('apple', ?, 1), ('carrot', 3, 0)
       ON CONFLICT (item_id) DO NOTHING`,
    ).run(apples);
    db.exec(`INSERT INTO tasks VALUES ('picnic'), ('picnic-2')
             ON CONFLICT (task_id) DO NOTHING`);
  });
}

export function requireTask(db: DatabaseSync, taskId: string) {
  if (!db.prepare('SELECT 1 FROM tasks WHERE task_id = ?').get(taskId))
    throw new Error(`Unknown picnic task: ${taskId}`);
}
