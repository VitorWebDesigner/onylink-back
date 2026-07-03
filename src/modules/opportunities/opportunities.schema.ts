import { z } from 'zod';

export const applicationQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(160),
  required: z.boolean().optional(),
});

export const createOpportunitySchema = z.object({
  kind: z.enum(['INDICACAO', 'PARCERIA', 'FORNECEDOR', 'VAGA', 'EVENTO']),
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  city: z.string().max(120).optional(),
  segment: z.string().max(120).optional(),
  // Formulário de candidatura definido pelo dono (perguntas).
  applicationForm: z.array(applicationQuestionSchema).max(10).optional(),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const applyOpportunitySchema = z.object({
  answers: z.array(z.object({ label: z.string().max(160), answer: z.string().max(2000) })).max(20).default([]),
});
export type ApplyOpportunityInput = z.infer<typeof applyOpportunitySchema>;

export const updateApplicationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  reply: z.string().max(2000).optional(),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const opportunityCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(), // resposta a outro comentário (thread)
});
export type OpportunityCommentInput = z.infer<typeof opportunityCommentSchema>;

export const listOpportunityQuery = z.object({
  kind: z.enum(['INDICACAO', 'PARCERIA', 'FORNECEDOR', 'VAGA', 'EVENTO']).optional(),
  city: z.string().optional(),
  segment: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListOpportunityQuery = z.infer<typeof listOpportunityQuery>;
