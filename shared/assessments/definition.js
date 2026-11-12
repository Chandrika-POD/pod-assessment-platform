// Runtime contract: reviewed single-choice, summed-score forms, not raw extractions.
export function validateDefinition(d) {
  const fail = () => {
    throw new Error('Invalid or unsupported assessment definition.');
  };
  if (
    d?.schemaVersion !== 1 ||
    !d.id ||
    !d.version ||
    !d.title ||
    !d.instructions ||
    !d.referencePeriod ||
    d.language !== 'en' ||
    d.scoring?.method !== 'sum' ||
    !Array.isArray(d.questions) ||
    !d.questions.length ||
    d.questions.length > 100
  )
    fail();
  const ids = new Set();
  let min = 0,
    max = 0;
  for (const q of d.questions) {
    if (
      !q.id ||
      ids.has(q.id) ||
      typeof q.text !== 'string' ||
      !q.text.trim() ||
      !Array.isArray(q.options) ||
      q.options.length < 2
    )
      fail();
    ids.add(q.id);
    const values = new Set();
    for (const o of q.options) {
      if (
        !Number.isInteger(o.value) ||
        !Number.isInteger(o.score) ||
        typeof o.label !== 'string' ||
        !o.label.trim() ||
        values.has(o.value)
      )
        fail();
      values.add(o.value);
    }
    min += Math.min(...q.options.map((o) => o.score));
    max += Math.max(...q.options.map((o) => o.score));
  }
  if (
    d.scoring.min !== min ||
    d.scoring.max !== max ||
    max - min > 10000 ||
    !Array.isArray(d.scoring.bands) ||
    !d.scoring.bands.length
  )
    fail();
  let next = min;
  for (const band of d.scoring.bands) {
    if (
      band.min !== next ||
      !Number.isInteger(band.max) ||
      band.max < band.min ||
      !band.label
    )
      fail();
    next = band.max + 1;
  }
  if (next !== max + 1) fail();
  return d;
}

export function scoreDefinition(definition, answers) {
  validateDefinition(definition);
  if (!Array.isArray(answers) || answers.length !== definition.questions.length)
    throw new Error('Answer every question before saving.');
  const score = definition.questions.reduce((sum, question, index) => {
    const option = question.options.find(
      (o) => Number.isInteger(answers[index]) && o.value === answers[index],
    );
    if (!option) throw new Error('Choose a valid response for every question.');
    return sum + option.score;
  }, 0);
  const severity = definition.scoring.bands.find(
    (b) => score >= b.min && score <= b.max,
  ).label;
  return { score, severity };
}
