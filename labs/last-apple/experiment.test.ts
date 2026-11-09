import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultConfig,
  createInventory,
  dispatch,
  evaluateOutcome,
  runExperiment,
} from './experiment.ts';

test('guidance and post-action evaluation preserve the successful but noncompliant transfer', () => {
  const guided = runExperiment(defaultConfig);
  const audited = runExperiment({ ...defaultConfig, strategy: 'evaluate' });
  for (const run of [guided, audited]) {
    const final = run.frames.at(-1)!;
    assert.deepEqual(final.state.pantry, { apple: 0, carrot: 2 });
    assert.deepEqual(final.state.scout, { apple: 1, carrot: 0 });
    assert.deepEqual(final.evidence, {
      execution: 'succeeded',
      transfer: 'verified',
      outcome: 'violated',
    });
  }
  const audit = audited.frames.findIndex((frame) => frame.kind === 'policy');
  assert(audit > audited.frames.findIndex((frame) => frame.kind === 'result'));
  assert.equal(audited.frames[audit].state.pantry.apple, 0);
  assert(!guided.frames.some((frame) => frame.kind === 'policy'));
});

test('dispatcher and inventory refuse a last-apple write at different boundaries', () => {
  for (const strategy of ['guard', 'domain'] as const) {
    const run = runExperiment({ ...defaultConfig, strategy });
    const final = run.frames.at(-1)!;
    assert.deepEqual(final.state, run.frames[0].state);
    assert.equal(final.evidence.outcome, 'incomplete');
    assert.equal(final.evidence.transfer, 'none');
    assert.equal(
      final.evidence.execution,
      strategy === 'guard' ? 'dispatcher-rejected' : 'inventory-rejected',
    );
    assert.equal(
      run.frames.find((frame) => frame.kind === 'result')?.payload
        ?.operationCalled,
      strategy === 'domain',
    );
    // excerpt:positive
    const allowed = runExperiment({
      ...defaultConfig,
      strategy,
      apples: 2,
    }).frames.at(-1)!;
    assert.equal(allowed.state.pantry.apple, 1);
    assert.equal(allowed.evidence.transfer, 'verified');
    assert.equal(allowed.evidence.outcome, 'complete');
    // end:positive
  }
});

test('a rejected apple can lead to one carrot pickup, or a blocked job', () => {
  const config = {
    ...defaultConfig,
    strategy: 'domain' as const,
    continueAfterRejection: true,
  };
  const recovered = runExperiment(config);
  assert.equal(
    recovered.frames.filter((frame) => frame.kind === 'request').length,
    2,
  );
  assert.deepEqual(recovered.frames.at(-1)?.state, {
    pantry: { apple: 1, carrot: 1 },
    scout: { apple: 0, carrot: 1 },
  });
  assert.equal(recovered.frames.at(-1)?.evidence.outcome, 'complete');
  const blocked = runExperiment({ ...config, carrots: 0 });
  assert.equal(
    blocked.frames.filter((frame) => frame.kind === 'request').length,
    1,
  );
  assert.equal(blocked.frames.at(-1)?.evidence.outcome, 'blocked');
});

test('invalid and unavailable requests cannot mutate inventory', () => {
  const inventory = createInventory({ apple: 1, carrot: 0 }, false);
  const before = inventory.snapshot();
  for (const args of [
    null,
    [],
    {},
    { item: 'pear' },
    { item: 'apple', count: 2 },
    { item: 'carrot' },
  ]) {
    const result = dispatch(inventory, 'guidance', {
      name: 'take_one',
      arguments: args,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(inventory.snapshot(), before);
  }
  const invalidTool = dispatch(inventory, 'guidance', {
    name: 'deliver_item',
    arguments: {},
  });
  assert.equal(invalidTool.operationCalled, false);
});

test('repeat runs are identical; snapshots and outcome do not depend on a report', () => {
  const run = runExperiment(defaultConfig);
  const final = run.frames.at(-1)!;
  const altered = { ...final, description: 'All objectives achieved!' };
  assert.equal(evaluateOutcome(altered.state), 'violated');
  assert.equal(run.frames[0].state.pantry.apple, 1);
  assert(Object.isFrozen(final.state.pantry));
  assert.deepEqual(runExperiment(defaultConfig), run);
  assert.equal(
    runExperiment({ ...defaultConfig, proposal: 'carrot' }).frames.at(-1)
      ?.evidence.outcome,
    'complete',
  );
});
