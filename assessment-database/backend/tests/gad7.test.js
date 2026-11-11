import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreGad7 } from '../../shared/assessments/gad7.js';

test('GAD-7 scoring covers every severity boundary and both extremes', () => {
  for (const [score, severity] of [
    [0, 'Minimal'],
    [4, 'Minimal'],
    [5, 'Mild'],
    [9, 'Mild'],
    [10, 'Moderate'],
    [14, 'Moderate'],
    [15, 'Severe'],
    [21, 'Severe'],
  ]) {
    const answers = Array.from({ length: 7 }, (_, i) =>
      Math.max(0, Math.min(3, score - i * 3)),
    );
    assert.deepEqual(scoreGad7(answers), { score, severity });
  }
});
test('Reject incomplete, coerced, non-integer and out-of-range answers', () => {
  for (const answers of [
    null,
    [],
    Array(7),
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, '1'],
    [0, 0, 0, 0, 0, 0, null],
    [0, 0, 0, 0, 0, 0, 4],
    [0, 0, 0, 0, 0, 0, -1],
    [0, 0, 0, 0, 0, 0, 1.5],
  ]) {
    assert.throws(() => scoreGad7(answers));
  }
});
