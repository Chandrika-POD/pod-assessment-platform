import { z } from 'zod';

export const assessmentSchema = z
  .object({
    submissionId: z.uuid(),
    answers: z.array(z.number().int().min(0).max(3)).length(7),
  })
  .strict();
