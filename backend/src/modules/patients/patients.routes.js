import { Router } from 'express';
import { createPatientsRepository } from './patients.repository.js';
import { createPatientsController } from './patients.controller.js';
import { createAssessmentsRepository } from '../assessments/assessments.repository.js';
import { createAssessmentsRouter } from '../assessments/assessments.routes.js';

export function createPatientsRouter(db) {
  const router = Router();
  const patients = createPatientsRepository(db);
  const assessments = createAssessmentsRepository(db);
  const controller = createPatientsController(patients, assessments);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.detail);
  router.use(
    '/:id/assessments',
    createAssessmentsRouter(patients, assessments),
  );
  return router;
}
