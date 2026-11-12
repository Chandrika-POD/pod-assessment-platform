import test from 'node:test';
import assert from 'node:assert/strict';
import { GAD7 } from '../../shared/assessments/gad7.js';
import {
  validateDefinition,
  scoreDefinition,
} from '../../shared/assessments/definition.js';

test('JSON-driven scoring uses option scores, not their response values', () => {
  const d = structuredClone(GAD7);
  for (const question of d.questions)
    for (const option of question.options) option.score = 3 - option.value;
  assert.equal(scoreDefinition(d, Array(7).fill(0)).score, 21);
  assert.equal(scoreDefinition(d, Array(7).fill(3)).score, 0);
});
test('Definition validator rejects duplicate IDs, options, missing bands, and unsupported scoring', () => {
  for (const change of [
    (d) => {
      d.questions[1].id = d.questions[0].id;
    },
    (d) => {
      d.questions[0].options[1].value = 0;
    },
    (d) => {
      d.scoring.bands[1].min = 4;
    },
    (d) => {
      d.scoring.bands.pop();
    },
    (d) => {
      d.scoring.method = 'guess';
    },
  ]) {
    const d = structuredClone(GAD7);
    change(d);
    assert.throws(() => validateDefinition(d));
  }
});
