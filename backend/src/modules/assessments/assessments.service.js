import { scoreGad7 } from '../../../../shared/assessments/gad7.js';
import { HttpError } from '../../middleware/errors.js';

export function createAssessmentsService(patients, assessments) {
  return {
    async submit(patientId, { submissionId, answers }) {
      if (!(await patients.findById(patientId)))
        throw new HttpError(404, 'Patient not found.');
      const { score, severity } = scoreGad7(answers);
      const result = await assessments.create({
        submissionId,
        patientId,
        answers,
        score,
        severity,
      });
      if (result) return { created: true, assessment: result };

      // Retried requests reuse the same ID, without adding a duplicate history entry.
      const existing = await assessments.findById(submissionId);
      if (
        !existing ||
        existing.patient_id !== patientId ||
        JSON.stringify(existing.answers) !== JSON.stringify(answers)
      ) {
        throw new HttpError(
          409,
          'This submission ID has already been used for a different assessment.',
        );
      }
      const { patient_id: _patientId, ...assessment } = existing;
      return { created: false, assessment };
    },
  };
}
