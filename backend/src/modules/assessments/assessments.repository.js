export function createAssessmentsRepository(db) {
  return {
    async listByPatient(patientId) {
      const { rows } = await db.query(
        `SELECT id, answers, score, severity,
        completed_at AS "completedAt", definition_snapshot AS "definition", administration_mode AS "mode", instrument_version AS "instrumentVersion" FROM assessments WHERE patient_id = $1 ORDER BY completed_at DESC, id DESC`,
        [patientId],
      );
      return rows;
    },
    async create({
      submissionId,
      patientId,
      answers,
      score,
      severity,
      definition,
      mode = 'form',
    }) {
      const { rows } = await db.query(
        `INSERT INTO assessments (id, patient_id, answers, score, severity, definition_snapshot, administration_mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING
        RETURNING id, answers, score, severity, completed_at AS "completedAt", definition_snapshot AS "definition", administration_mode AS "mode", instrument_version AS "instrumentVersion"`,
        [
          submissionId,
          patientId,
          answers,
          score,
          severity,
          JSON.stringify(definition),
          mode,
        ],
      );
      return rows[0];
    },
    async findById(id) {
      const { rows } = await db.query(
        `SELECT id, patient_id, answers, score, severity, completed_at AS "completedAt", definition_snapshot AS "definition", administration_mode AS "mode", instrument_version AS "instrumentVersion"
        FROM assessments WHERE id = $1`,
        [id],
      );
      return rows[0];
    },
  };
}
