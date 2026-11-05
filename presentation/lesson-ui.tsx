import { createContext, useContext, useSyncExternalStore, useId } from 'react';
import type { ReactNode, ComponentType } from 'react';
import type { StepMeta } from '../runtime/session.ts';
import type { Trace } from '../runtime/types.ts';
interface PresentationStep {
  busy: boolean;
  error?: string;
  showContext(value: unknown): void;
  showQuestion(text: string): void;
}
interface PresentationHost {
  get(id: string): PresentationStep;
  subscribe(fn: () => void): () => void;
  getRevision(): number;
  epoch: number;
}
import type { StoredCode } from '../runtime/lesson-types.ts';
export interface MdxStep {
  meta: StepMeta;
  default: ComponentType;
  blocks: Record<string, StoredCode>;
}
export interface LessonArticle<Scenario = unknown> {
  id: string;
  number: number;
  title: string;
  scenario: Scenario;
  runtime: StoredCode;
  steps: readonly MdxStep[];
  replayStepId: string;
  legacyStepIds?: readonly string[];
  stepAliases?: Readonly<Record<string, string>>;
}
interface LessonContext {
  host: PresentationHost;
  step: PresentationStep;
  replay: boolean;
  terminal?: (content: ReactNode) => void;
  selectProvider?: (mode: 'mock' | 'live') => void;
  navigate?: (id: string) => void;
  review?: (trace: Trace<unknown>, at?: number, seq?: number) => void;
}
const Context = createContext<LessonContext | null>(null);
export function useLessonStep<T extends PresentationStep = PresentationStep>() {
  const context = useContext(Context);
  if (!context) throw new Error('Use a step inside the lesson player');
  useSyncExternalStore(
    context.host.subscribe,
    context.host.getRevision,
    context.host.getRevision,
  );
  return context.step as T;
}
export function useLessonPresentation() {
  const context = useContext(Context)!;
  return {
    selectProvider: (mode: 'mock' | 'live') => context.selectProvider?.(mode),
    goToStep: (id: string) => context.navigate?.(id),
    renderSystemTerminal: (content: ReactNode) => context.terminal?.(content),
    showContext: context.step.showContext,
    showQuestion: context.step.showQuestion,
    reviewTrace: (trace: Trace<unknown>, at?: number, seq?: number) =>
      context.review?.(trace, at, seq),
  };
}
export function Action({
  children,
  onClick,
  concurrent = false,
  ...props
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  concurrent?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const context = useContext(Context)!,
    step = useLessonStep();
  return (
    <button
      {...props}
      disabled={context.replay || props.disabled || (step.busy && !concurrent)}
      onClick={() => {
        void onClick();
      }}
    >
      {children}
    </button>
  );
}
export function LessonPages({
  article,
  host,
  selected = 0,
  replay = false,
  terminal,
  selectProvider,
  navigate,
  review,
}: {
  article: LessonArticle;
  host: PresentationHost;
  selected?: number;
  replay?: boolean;
  terminal?: (content: ReactNode) => void;
  selectProvider?: (mode: 'mock' | 'live') => void;
  navigate?: (id: string) => void;
  review?: (trace: Trace<unknown>, at?: number, seq?: number) => void;
}) {
  useSyncExternalStore(host.subscribe, host.getRevision, host.getRevision);
  return (
    <article data-article={article.id}>
      {article.steps.map((step, index) => {
        const Content = step.default,
          id = `${article.id}-${step.meta.id}`;
        return (
          <section
            key={`${host.epoch}:${step.meta.id}`}
            className={`teaching-step${index === selected ? ' selected' : ''}`}
            hidden={index !== selected}
            aria-labelledby={id}
          >
            <h1 id={id}>{step.meta.title}</h1>
            <Context.Provider
              value={{
                host,
                step: host.get(step.meta.id),
                replay,
                terminal,
                selectProvider,
                navigate,
                review,
              }}
            >
              <div className="lesson-copy">
                {host.get(step.meta.id).error && (
                  <p className="lesson-error" role="alert">
                    {host.get(step.meta.id).error}
                  </p>
                )}
                <Content />
              </div>
            </Context.Provider>
          </section>
        );
      })}
    </article>
  );
}
function changedLines(before: string, after: string) {
  const a = before ? before.split('\n') : [],
    b = after.split('\n');
  const grid = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      grid[i][j] =
        a[i] === b[j]
          ? grid[i + 1][j + 1] + 1
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
  const lines: { text: string; kind: string }[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ text: a[i++], kind: 'same' });
      j++;
    } else if (
      j < b.length &&
      (i === a.length || grid[i][j + 1] > grid[i + 1][j])
    )
      lines.push({ text: b[j++], kind: 'addition' });
    else lines.push({ text: a[i++], kind: 'removal' });
  }
  const changed = lines.flatMap((line, index) =>
    line.kind === 'same' ? [] : [index],
  );
  return lines
    .filter((_, index) => changed.some((n) => Math.abs(n - index) <= 2))
    .map((line, index, array) => ({
      ...line,
      gap:
        index > 0 && lines.indexOf(line) > lines.indexOf(array[index - 1]) + 1,
    }));
}
export function RuntimeChange({
  from,
  to,
}: {
  from?: StoredCode;
  to: StoredCode;
}) {
  const lines = changedLines(from?.source ?? '', to.source);
  return (
    <figure className="source runtime-change">
      <figcaption>
        {to.kind === 'setup'
          ? 'Configuration change'
          : to.kind === 'experiment'
            ? 'Experiment code'
            : 'Runtime change'}
      </figcaption>
      {lines.length ? (
        <pre>
          <code>
            {lines.map((line, i) => (
              <span key={i}>
                {line.gap && <span className="code-line">…</span>}
                <span className={`code-line ${line.kind}`}>
                  {line.kind === 'addition'
                    ? '+ '
                    : line.kind === 'removal'
                      ? '- '
                      : '  '}
                  {line.text}
                </span>
              </span>
            ))}
          </code>
        </pre>
      ) : (
        <p>Runtime unchanged.</p>
      )}
      <details>
        <summary>
          Full{' '}
          {to.kind === 'setup'
            ? 'configuration'
            : to.kind === 'experiment'
              ? 'experiment'
              : 'runtime'}
        </summary>
        <pre>
          <code>{to.source}</code>
        </pre>
      </details>
    </figure>
  );
}

export interface PredictionChoice {
  id: string;
  label: string;
  explanation: ReactNode;
}

export function Prediction({
  question,
  choices,
  value,
  onChange,
  outcome,
}: {
  question: string;
  choices: readonly PredictionChoice[];
  value: string | null;
  onChange: (choice: string) => void;
  outcome?: string | null;
}) {
  const id = useId();
  const observed = choices.find((choice) => choice.id === outcome);
  const verdict = !value
    ? 'observed'
    : value === outcome
      ? 'correct'
      : 'incorrect';
  return (
    <fieldset className="prediction">
      <legend>{question}</legend>
      {choices.map((choice) => (
        <label key={choice.id}>
          <input
            type="radio"
            name={id}
            value={choice.id}
            checked={value === choice.id}
            onChange={() => onChange(choice.id)}
          />
          {choice.label}
        </label>
      ))}
      <div aria-live="polite" aria-atomic="true">
        {observed && (
          <blockquote className={`prediction-feedback ${verdict}`}>
            <strong>
              {verdict === 'correct'
                ? 'Prediction matched.'
                : verdict === 'incorrect'
                  ? 'Prediction did not match.'
                  : 'Observed outcome.'}
            </strong>{' '}
            {observed.explanation}
          </blockquote>
        )}
      </div>
    </fieldset>
  );
}

export function RuntimeExcerpt({
  code,
  method,
}: {
  code: StoredCode;
  method: string;
}) {
  const lines = code.source.split('\n');
  const start = lines.findIndex(
    (line) =>
      line.startsWith(`  async ${method}(`) || line.startsWith(`  ${method}(`),
  );
  const end = lines.findIndex((line, index) => index > start && line === '  }');
  const excerpt =
    start < 0
      ? code.source
      : lines.slice(start, end < 0 ? undefined : end + 1).join('\n');
  return (
    <figure className="source">
      <figcaption>Executed runtime · {method}</figcaption>
      <pre>
        <code>{excerpt}</code>
      </pre>
    </figure>
  );
}
