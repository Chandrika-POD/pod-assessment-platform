import { HttpError } from '../../middleware/errors.js';
import { patientIdSchema, patientSchema } from './patients.schemas.js';

export function createPatientsController(patients, assessments) {
  return {
    list: async (_req, res) => res.json(await patients.list()),
    create: async (req, res) =>
      res
        .status(201)
        .json(await patients.create(patientSchema.parse(req.body))),
    detail: async (req, res) => {
      const id = patientIdSchema.parse(req.params.id);
      const patient = await patients.findById(id);
      if (!patient) throw new HttpError(404, 'Patient not found.');
      res.json({
        ...patient,
        assessments: await assessments.listByPatient(id),
      });
    },
  };
}
