export function createAssessmentsRepository(db) {
  return {
    async listByPatient(patientId) {
      const { rows } = await db.query(
        `SELECT id, answers, score, severity, instrument_version AS "instrumentVersion",
        completed_at AS "completedAt" FROM assessments WHERE patient_id = $1 ORDER BY completed_at DESC, id DESC`,
        [patientId],
      );
      return rows;
    },
    async create({ submissionId, patientId, answers, score, severity }) {
      const { rows } = await db.query(
        `INSERT INTO assessments (id, patient_id, answers, score, severity)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING
        RETURNING id, answers, score, severity, completed_at AS "completedAt"`,
        [submissionId, patientId, answers, score, severity],
      );
      return rows[0];
    },
    async findById(id) {
      const { rows } = await db.query(
        `SELECT id, patient_id, answers, score, severity, completed_at AS "completedAt"
        FROM assessments WHERE id = $1`,
        [id],
      );
      return rows[0];
    },
  };
}
