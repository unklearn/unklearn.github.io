import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { routeLink, routes } from '../../routes.ts';
import { Pantry } from './pantry.tsx';
import {
  defaultConfig,
  runExperiment,
  simulationNotice,
} from './experiment.ts';
import type {
  Evidence,
  ExperimentConfig,
  ExperimentRun,
  Frame,
  InventoryState,
  Strategy,
} from './experiment.ts';
import { recordedNotice, recordedProvider, recordedRun } from './recording.ts';
import implementation from './experiment.ts?raw';
import tests from './experiment.test.ts?raw';
import '../../scene/style.css';
import './lab.css';

const strategies = [
  {
    id: 'guidance',
    label: 'Model guidance only',
    description:
      'The instructions contain the rule. No reserve check prevents the write.',
  },
  {
    id: 'evaluate',
    label: 'Post-action evaluator',
    description:
      'Check the reserve after the operation. Detection leaves the transfer intact.',
  },
  {
    id: 'guard',
    label: 'Runtime guard',
    description:
      'The dispatcher checks the reserve before calling the inventory operation.',
  },
  {
    id: 'domain',
    label: 'Domain enforcement',
    description:
      'The inventory owner checks the reserve inside the withdrawal.',
  },
] as const;

const executionLabels: Record<Evidence['execution'], [string, string]> = {
  pending: ['Not yet known', 'neutral'],
  succeeded: ['Succeeded', 'good'],
  'invalid-request': ['Invalid request', 'caution'],
  'dispatcher-rejected': ['Not called · guard refused', 'caution'],
  'inventory-rejected': ['Called · inventory refused', 'caution'],
};
const transferLabels: Record<Evidence['transfer'], [string, string]> = {
  pending: ['Not yet known', 'neutral'],
  verified: ['Verified', 'good'],
  none: ['No transfer', 'neutral'],
  unverified: ['Unverified', 'bad'],
};
const outcomeLabels: Record<Evidence['outcome'], [string, string]> = {
  pending: ['Not yet known', 'neutral'],
  complete: ['Complete', 'good'],
  violated: ['Failed · reserve broken', 'bad'],
  incomplete: ['Incomplete', 'caution'],
  blocked: ['Blocked · no valid snack', 'caution'],
};

function EvidenceStrip({
  evidence,
  label,
}: {
  evidence: Evidence;
  label: string;
}) {
  const items = [
    ['Tool execution', executionLabels[evidence.execution]],
    ['Inventory transfer', transferLabels[evidence.transfer]],
    ['Business outcome', outcomeLabels[evidence.outcome]],
  ] as const;
  return (
    <dl className="lab-evidence" aria-label={label}>
      {items.map(([name, [value, tone]]) => (
        <div key={name} data-tone={tone}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const timelineLabels: Record<Frame['kind'], string> = {
  notice: 'Order',
  inspection: 'Inspect',
  request: 'Request',
  result: 'Result',
  policy: 'Policy check',
  delivery: 'Delivery',
  report: 'Report',
};

function TraceViewer({
  run,
  page,
  setPage,
  notice,
  historical = false,
}: {
  run: ExperimentRun;
  page: number;
  setPage: (page: number) => void;
  notice: string;
  historical?: boolean;
}) {
  const frame = run.frames[page];
  const report = frame.payload?.report;
  return (
    <div className="lab-workbench">
      <Pantry state={frame.state} notice={notice} />
      <div className="lab-timeline">
        <nav
          aria-label={historical ? 'Recorded timeline' : 'Simulation timeline'}
        >
          <ol className="lab-stops">
            {run.frames.map((step, index) => (
              <li key={index}>
                <button
                  type="button"
                  aria-label={step.title}
                  aria-current={index === page ? 'step' : undefined}
                  onClick={() => setPage(index)}
                >
                  {timelineLabels[step.kind]}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="lab-current" aria-live="polite" aria-atomic="true">
          <p className="lab-label">{frame.source ?? 'Event ' + (page + 1)}</p>
          <h3>{frame.title}</h3>
          {typeof report === 'string' && (
            <blockquote className="lab-report">{report}</blockquote>
          )}
          {frame.description !== report && <p>{frame.description}</p>}
          {frame.payload &&
            frame.kind !== 'notice' &&
            frame.kind !== 'report' && (
              <pre className="lab-payload">
                <code>{JSON.stringify(frame.payload, null, 2)}</code>
              </pre>
            )}
          {!historical && frame.evidence.outcome !== 'pending' && (
            <EvidenceStrip
              evidence={frame.evidence}
              label="Evidence at this event"
            />
          )}
        </div>
        <div className="lab-playhead">
          <button
            type="button"
            aria-label={
              historical
                ? 'Previous recorded event'
                : 'Previous simulated event'
            }
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            ← Previous
          </button>
          <button
            type="button"
            aria-label={historical ? 'Replay recording' : 'Replay simulation'}
            onClick={() => setPage(0)}
            disabled={page === 0}
          >
            Replay
          </button>
          <button
            type="button"
            aria-label={
              historical ? 'Next recorded event' : 'Next simulated event'
            }
            onClick={() => setPage(page + 1)}
            disabled={page === run.frames.length - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function Simulation() {
  const [config, setConfig] = useState(defaultConfig);
  const [run, setRun] = useState<ExperimentRun | null>(null);
  const [page, setPage] = useState(0);
  const idle: InventoryState = {
    pantry: { apple: config.apples, carrot: config.carrots },
    scout: { apple: 0, carrot: 0 },
  };
  function update(patch: Partial<ExperimentConfig>) {
    setConfig({ ...config, ...patch });
    setRun(null);
    setPage(0);
  }
  function start() {
    const next = runExperiment(config);
    setRun(next);
    setPage(next.frames.length - 1);
  }
  return (
    <section
      className="lab-section"
      id="simulation"
      aria-labelledby="simulation-title"
    >
      <div className="lab-section-heading">
        <p className="lab-label">Scripted agent simulation</p>
        <h2 id="simulation-title">Where should the rule live?</h2>
        <p>
          Hold the first proposal fixed and change who checks the reserve. This
          script uses a deliberately bad proposal as a test case.
        </p>
      </div>
      <form
        className="lab-controls"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <fieldset className="lab-strategies">
          <legend>Enforcement strategy</legend>
          <div className="strategy-grid">
            {strategies.map(({ id, label, description }) => (
              <label key={id} className="strategy-option">
                <input
                  type="radio"
                  name="strategy"
                  checked={config.strategy === id}
                  onChange={() => update({ strategy: id satisfies Strategy })}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="lab-inputs">
          <label>
            Starting apples
            <select
              value={config.apples}
              onChange={(event) =>
                update({
                  apples: Number(
                    event.target.value,
                  ) as ExperimentConfig['apples'],
                })
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            Starting carrots
            <select
              value={config.carrots}
              onChange={(event) =>
                update({
                  carrots: Number(
                    event.target.value,
                  ) as ExperimentConfig['carrots'],
                })
              }
            >
              <option value={0}>0</option>
              <option value={2}>2</option>
            </select>
          </label>
          <label>
            First proposal
            <select
              value={config.proposal}
              onChange={(event) =>
                update({
                  proposal: event.target.value as ExperimentConfig['proposal'],
                })
              }
            >
              <option value="apple">Take apple</option>
              <option value="carrot">Take carrot</option>
            </select>
          </label>
          <label className="lab-continuation">
            <input
              type="checkbox"
              checked={config.continueAfterRejection}
              onChange={(event) =>
                update({ continueAfterRejection: event.target.checked })
              }
            />{' '}
            Try a carrot after an apple refusal
          </label>
        </div>
        <div className="lab-run-actions">
          <button className="primary" type="submit">
            Run experiment
          </button>
          <button type="button" disabled={!run} onClick={() => update({})}>
            Reset
          </button>
        </div>
      </form>
      {run ? (
        <TraceViewer
          run={run}
          page={page}
          setPage={setPage}
          notice={simulationNotice}
        />
      ) : (
        <div className="lab-workbench">
          <Pantry state={idle} notice={simulationNotice} />
          <div className="lab-timeline lab-ready">
            <p className="lab-label">Ready to run</p>
            <h3>Same proposal, different safeguards</h3>
            <p>
              Start with one apple. Compare guidance only with domain
              enforcement, then try the same guarded withdrawal with two apples.
            </p>
            <p>
              The simulation ends at pickup. Its outcome requires one collected
              snack and at least one apple left on the shelf.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function excerpt(source: string, name: string) {
  return source
    .split('// excerpt:' + name)[1]
    .split('// end:' + name)[0]
    .trim();
}

function UnderTheHood() {
  const examples = [
    [
      'Validate the request',
      'A tool schema describes which arguments make sense. The dispatcher still checks what arrives.',
      'arguments',
    ],
    [
      'Check before dispatch',
      'A separate read can go stale if another actor changes stock before the write. This lab does not simulate that race.',
      'guard',
    ],
    [
      'Enforce inside the write',
      'The inventory owner evaluates the reserve against the state it is about to change. This is a synchronous, single-owner simulation.',
      'withdraw',
    ],
    [
      'Score the outcome',
      'The evaluator reads inventory state independently of the report. Post-action detection reveals violations after the effect.',
      'outcome',
    ],
  ];
  return (
    <details className="lab-underhood">
      <summary>Under the Hood</summary>
      <div>
        <p>
          Instructions and tool descriptions help an agent choose an action. An
          enforced policy lives where the system can refuse the write. The same
          distinction applies to stock reserves, refund limits, balances, and
          quotas.
        </p>
        {examples.map(([title, explanation, name]) => (
          <section key={name}>
            <h3>{title}</h3>
            <p>{explanation}</p>
            <pre className="lab-payload">
              <code>{excerpt(implementation, name)}</code>
            </pre>
          </section>
        ))}
        <section>
          <h3>Check that valid work still succeeds</h3>
          <p>
            This test runs both guards with two apples. A guard that refuses
            everything fails the test.
          </p>
          <pre className="lab-payload">
            <code>{excerpt(tests, 'positive')}</code>
          </pre>
        </section>
      </div>
    </details>
  );
}

function LastApple() {
  const [recordedPage, setRecordedPage] = useState(0);
  const home = routeLink(routes.lastApple, routes.foundations);
  return (
    <>
      <header className="lab-masthead">
        <a className="brand" href={home}>
          u.<span>UNKLEARN</span>
        </a>
        <a href={home}>
          Scout Foundations <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main className="lab">
        <header className="lab-hero">
          <h1>The Last Apple</h1>
          <p>
            A successful tool call can still produce the wrong business outcome.
          </p>
          <a href="#simulation" className="lab-jump">
            Compare strategies <span aria-hidden="true">↓</span>
          </a>
        </header>
        <section
          className="lab-section recorded-section"
          aria-labelledby="recording-title"
        >
          <div className="lab-section-heading">
            <p className="lab-label">Actual recorded model run</p>
            <h2 id="recording-title">
              The tool worked. The reserve didn’t hold.
            </h2>
            <p>
              {recordedProvider} withdrew and delivered the last apple in
              Scout’s browser village. Step through the recording to see where
              the job went wrong.
            </p>
          </div>
          <EvidenceStrip
            evidence={recordedRun.frames.at(-1)!.evidence}
            label="Recorded outcome"
          />
          <TraceViewer
            run={recordedRun}
            page={recordedPage}
            setPage={setRecordedPage}
            notice={recordedNotice}
            historical
          />
          <p className="lab-provenance">
            Source: Scout’s Ollama recording ·{' '}
            <code>ollama-last-apple.json</code> · Run{' '}
            <code>{recordedRun.id}</code>. The lab assesses the reserve from
            recorded inventory.
          </p>
        </section>
        <Simulation />
        <UnderTheHood />
        <footer className="lab-footer">
          Companion lab for{' '}
          <cite>Your AI Agent Succeeded. Your Business Didn’t.</cite>
        </footer>
      </main>
    </>
  );
}

createRoot(document.querySelector('#lab-root')!).render(<LastApple />);
