import { patientIdSchema } from '../patients/patients.schemas.js';
import { assessmentSchema } from './assessments.schemas.js';

export function createAssessmentsController(service) {
  return {
    submit: async (req, res) => {
      const patientId = patientIdSchema.parse(req.params.id);
      const data = assessmentSchema.parse(req.body);
      const result = await service.submit(patientId, data);
      res.status(result.created ? 201 : 200).json(result.assessment);
    },
  };
}
