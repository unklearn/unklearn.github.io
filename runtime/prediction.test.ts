import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prediction } from '../presentation/lesson-ui.tsx';

const choices = [
  { id: 'read', label: 'Scout reads', explanation: 'The notice was read.' },
  {
    id: 'patrol',
    label: 'Scout patrols',
    explanation: 'The notice stayed unread.',
  },
];
const render = (value: string | null, outcome?: string | null) =>
  renderToStaticMarkup(
    createElement(Prediction, {
      question: 'What happens?',
      choices,
      value,
      outcome,
      onChange: () => {},
    }),
  );

test('prediction feedback uses the observed choice explanation and compares the controlled selection', () => {
  const correct = render('patrol', 'patrol');
  assert.match(correct, /prediction-feedback correct/);
  assert.match(correct, /Prediction matched/);
  assert.match(correct, /The notice stayed unread/);
  const incorrect = render('read', 'patrol');
  assert.match(incorrect, /prediction-feedback incorrect/);
  assert.match(incorrect, /Prediction did not match/);
  assert.match(incorrect, /The notice stayed unread/);
  assert.doesNotMatch(incorrect, /The notice was read/);
});

test('predictions wait for an outcome and remain optional', () => {
  assert.doesNotMatch(render('read'), /prediction-feedback/);
  assert.doesNotMatch(render('read', 'cancelled'), /prediction-feedback/);
  const unanswered = render(null, 'patrol');
  assert.match(unanswered, /prediction-feedback observed/);
  assert.match(unanswered, /Observed outcome/);
  assert.doesNotMatch(unanswered, /Prediction did not match/);
});
