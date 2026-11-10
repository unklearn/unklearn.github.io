import { once } from 'node:events';
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from 'node:worker_threads';
import { openDatabase } from './database.ts';
import { dispatch } from './tool.ts';
import type { DispatchResult, HostContext } from './tool.ts';

type Request = { filename: string; host: HostContext; proposal: unknown };

// Each worker opens its own connection before either request is released.
if (!isMainThread && parentPort) {
  const { filename, host, proposal } = workerData as Request;
  const db = openDatabase(filename);
  const port = parentPort;
  port.once('message', () => {
    let result: DispatchResult;
    try {
      result = dispatch(db, host, proposal);
    } finally {
      db.close();
    }
    port.postMessage(result);
    port.close();
  });
  port.postMessage('ready');
}

export async function concurrentWithdrawals(
  filename: string,
  hosts: readonly [HostContext, HostContext],
  proposal: unknown,
): Promise<DispatchResult[]> {
  const workers: Worker[] = [];
  const signal = AbortSignal.timeout(15_000);
  try {
    for (const host of hosts)
      workers.push(
        new Worker(new URL(import.meta.url), {
          workerData: { filename, host, proposal } satisfies Request,
        }),
      );
    const ready = await Promise.all(
      workers.map((worker) => once(worker, 'message', { signal })),
    );
    if (!ready.every(([message]) => message === 'ready'))
      throw new Error('Withdrawal workers did not reach the start barrier');
    const results = workers.map(async (worker) => {
      const [result] = await once(worker, 'message', { signal });
      return result as DispatchResult;
    });
    for (const worker of workers) worker.postMessage('start');
    return await Promise.all(results);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}
