import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initializeDatabase, openDatabase } from './database.ts';
import { runScenario, scenarios } from './scenarios.ts';

async function main() {
  const [command, scenario] = process.argv.slice(2);
  if (
    (command === 'init' || command === 'reset') &&
    process.argv.length === 3
  ) {
    const filename = resolve(
      process.env.UNKLEARN_INVENTORY_DB ?? '.data/inventory.sqlite',
    );
    mkdirSync(dirname(filename), { recursive: true });
    const db = openDatabase(filename);
    try {
      initializeDatabase(db, { reset: command === 'reset' });
      console.log(
        `Database ${command === 'reset' ? 'reset' : 'ready'} at ${filename}`,
      );
    } finally {
      db.close();
    }
    return;
  }
  if (command === 'demo' && process.argv.length === 4) {
    if (scenario === 'all') {
      for (const id of Object.keys(scenarios) as (keyof typeof scenarios)[])
        await runScenario(id);
      return;
    }
    if (Object.hasOwn(scenarios, scenario)) {
      await runScenario(scenario as keyof typeof scenarios);
      return;
    }
  }
  throw new Error(
    'Usage: npm run demo -- <A|B|C|D|E|all>, npm run db:init, or npm run db:reset',
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
