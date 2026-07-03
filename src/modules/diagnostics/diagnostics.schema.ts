import { z } from 'zod';

/** Cada área recebe um array de respostas 0..5 (escala Likert). */
const areaAnswers = z.array(z.number().int().min(0).max(5)).min(1).max(20);

export const createDiagnosticSchema = z.object({
  leadEmail: z.string().email().optional(), // usado quando anônimo (sem login)
  answers: z.object({
    financeiro: areaAnswers,
    comercial: areaAnswers,
    marketing: areaAnswers,
    gestao: areaAnswers,
  }),
});
export type CreateDiagnosticInput = z.infer<typeof createDiagnosticSchema>;
