export function createPatientsRepository(db) {
  return {
    async list() {
      const { rows } = await db.query(`
        SELECT p.id, p.name, p.date_of_birth::text AS "dateOfBirth", p.gender, p.email,
          a.score AS "latestScore", a.severity AS "latestSeverity", a.completed_at AS "lastAssessedAt"
        FROM patients p LEFT JOIN LATERAL (
          SELECT score, severity, completed_at FROM assessments WHERE patient_id = p.id
          ORDER BY completed_at DESC, id DESC LIMIT 1
        ) a ON true ORDER BY p.name, p.id`);
      return rows;
    },
    async findById(id) {
      const { rows } = await db.query(
        `SELECT id, name, date_of_birth::text AS "dateOfBirth", gender, email
        FROM patients WHERE id = $1`,
        [id],
      );
      return rows[0];
    },
    async create(patient) {
      const { rows } = await db.query(
        `INSERT INTO patients (name, date_of_birth, gender, email)
        VALUES ($1, $2, $3, $4) RETURNING id`,
        [patient.name, patient.dateOfBirth, patient.gender, patient.email],
      );
      return rows[0];
    },
  };
}
