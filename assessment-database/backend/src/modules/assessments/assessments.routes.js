import { Router } from 'express';
import { createAssessmentsService } from './assessments.service.js';
import { createAssessmentsController } from './assessments.controller.js';

export function createAssessmentsRouter(patients, assessments) {
  const router = Router({ mergeParams: true });
  const controller = createAssessmentsController(
    createAssessmentsService(patients, assessments),
  );
  router.post('/', controller.submit);
  return router;
}
