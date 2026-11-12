import json from './gad7.json' with { type: 'json' };
import { scoreDefinition, validateDefinition } from './definition.js';

export const GAD7 = validateDefinition(json);
export const QUESTIONS = GAD7.questions.map((question) => question.text);
export const OPTIONS = GAD7.questions[0].options.map((option) => option.label);
export const scoreGad7 = (answers) => scoreDefinition(GAD7, answers);
