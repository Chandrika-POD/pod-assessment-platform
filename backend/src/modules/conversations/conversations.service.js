import { GAD7 } from '../../../../shared/assessments/gad7.js';
import { scoreDefinition } from '../../../../shared/assessments/definition.js';
import { HttpError } from '../../middleware/errors.js';
import { createAssessmentsRepository } from '../assessments/assessments.repository.js';

const fields = `id, patient_id AS "patientId", definition, answers, revision, status`;
export function createConversationsService(pool) {
  const get = async (id, db = pool, lock = false) => {
    const { rows } = await db.query(
      `SELECT ${fields} FROM conversation_sessions WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    if (!rows[0]) throw new HttpError(404, 'Conversation not found.');
    return rows[0];
  };
  async function transaction(fn) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const result = await fn(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  function assertDraft(state, revision) {
    if (state.status !== 'draft')
      throw new HttpError(409, 'This assessment is already completed.');
    if (state.revision !== revision)
      throw new HttpError(
        409,
        'Answers changed in another request. Reload the latest draft and try again.',
      );
  }
  return {
    get,
    async create({ id, patientId, assessmentId }) {
      if (assessmentId !== GAD7.id)
        throw new HttpError(400, 'This assessment is not registered.');
      if (
        !(
          await pool.query('SELECT id FROM patients WHERE id = $1', [patientId])
        ).rowCount
      )
        throw new HttpError(404, 'Patient not found.');
      await pool.query(
        `INSERT INTO conversation_sessions (id, patient_id, definition, answers)
        VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [
          id,
          patientId,
          JSON.stringify(GAD7),
          JSON.stringify(GAD7.questions.map(() => null)),
        ],
      );
      const state = await get(id);
      if (state.patientId !== patientId || state.definition.id !== assessmentId)
        throw new HttpError(409, 'This draft ID is already in use.');
      return state;
    },
    async answer(id, { questionId, value, revision }) {
      return transaction(async (db) => {
        const state = await get(id, db, true);
        assertDraft(state, revision);
        const index = state.definition.questions.findIndex(
          (q) => q.id === questionId,
        );
        if (
          index < 0 ||
          !state.definition.questions[index].options.some(
            (o) => o.value === value,
          )
        )
          throw new HttpError(400, 'Choose an available response.');
        const next = state.answers.findIndex((a) => a === null);
        if (state.answers[index] === null && next !== index)
          throw new HttpError(
            409,
            'Answer the current question before moving ahead.',
          );
        state.answers[index] = value;
        await db.query(
          `UPDATE conversation_sessions SET answers = $2, revision = revision + 1,
          updated_at = now() WHERE id = $1`,
          [id, JSON.stringify(state.answers)],
        );
        return get(id, db);
      });
    },
    async finalize(id, { revision }) {
      return transaction(async (db) => {
        const state = await get(id, db, true);
        const assessments = createAssessmentsRepository(db);
        if (state.status === 'completed') {
          const { patient_id: _patient, ...result } =
            await assessments.findById(id);
          return result;
        }
        assertDraft(state, revision);
        if (state.answers.some((a) => a === null))
          throw new HttpError(400, 'Confirm every answer before saving.');
        const { score, severity } = scoreDefinition(
          state.definition,
          state.answers,
        );
        const result = await assessments.create({
          submissionId: id,
          patientId: state.patientId,
          answers: state.answers,
          score,
          severity,
          definition: state.definition,
          mode: 'conversation',
        });
        if (!result)
          throw new HttpError(409, 'The submission ID is already in use.');
        await db.query(
          `UPDATE conversation_sessions SET status = 'completed', updated_at = now() WHERE id = $1`,
          [id],
        );
        return result;
      });
    },
  };
}
