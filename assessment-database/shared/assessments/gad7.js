// Standard GAD-7 instrument, Spitzer et al. (2006).
// https://novopsych.com/assessments/anxiety/generalised-anxiety-disorder-assessment-gad-7/
export const QUESTIONS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
];
export const OPTIONS = [
  'Not at all',
  'Several days',
  'More than half the days',
  'Nearly every day',
];
export function scoreGad7(answers) {
  if (
    !Array.isArray(answers) ||
    answers.length !== 7 ||
    Array.from(answers).some(
      (value) => !Number.isInteger(value) || value < 0 || value > 3,
    )
  ) {
    throw new Error('Answer all seven questions with a value from 0 to 3.');
  }
  const score = answers.reduce((total, value) => total + value, 0);
  const severity =
    score < 5
      ? 'Minimal'
      : score < 10
        ? 'Mild'
        : score < 15
          ? 'Moderate'
          : 'Severe';
  return { score, severity };
}
