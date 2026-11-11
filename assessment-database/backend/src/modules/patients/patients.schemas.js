import { z } from 'zod';

export const patientIdSchema = z.uuid();
export const patientSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    dateOfBirth: z.iso
      .date()
      .refine(
        (date) => date <= new Date().toISOString().slice(0, 10),
        'Date of birth cannot be in the future',
      ),
    gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
    email: z.email().max(254),
  })
  .strict();
