import { Router } from 'express';
import { z } from 'zod';
const uuid = z.uuid();
const createSchema = z
  .object({ id: uuid, patientId: uuid, assessmentId: z.string().max(40) })
  .strict();
const answerSchema = z
  .object({
    questionId: z.string().max(40),
    value: z.number().int(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
const finalSchema = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();

export function createConversationsRouter(service, onChange = () => {}) {
  const router = Router();
  router.post('/', async (req, res) =>
    res.status(201).json(await service.create(createSchema.parse(req.body))),
  );
  router.get('/:id', async (req, res) =>
    res.json(await service.get(uuid.parse(req.params.id))),
  );
  router.patch('/:id/answers', async (req, res) => {
    const state = await service.answer(
      uuid.parse(req.params.id),
      answerSchema.parse(req.body),
    );
    onChange(state);
    res.json(state);
  });
  router.post('/:id/finalize', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const result = await service.finalize(id, finalSchema.parse(req.body));
    onChange(await service.get(id));
    res.json(result);
  });
  return router;
}
