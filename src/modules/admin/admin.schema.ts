import { z } from 'zod';

export const updateUserSchema = z
  .object({
    action: z.enum(['SUSPEND', 'BAN', 'ACTIVATE', 'SET_ROLE']),
    days: z.coerce.number().int().min(1).max(365).optional(), // para SUSPEND
    role: z.enum(['USER', 'EXPERT', 'ADMIN']).optional(), // para SET_ROLE
  })
  .refine((v) => v.action !== 'SET_ROLE' || !!v.role, { message: 'role é obrigatório para SET_ROLE' })
  .refine((v) => v.action !== 'SUSPEND' || !!v.days, { message: 'days é obrigatório para SUSPEND' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
