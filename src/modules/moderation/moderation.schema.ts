import { z } from 'zod';

export const reportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER', 'MESSAGE']),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const resolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED', 'REVIEWING']),
  action: z.enum(['APPROVE', 'REMOVE', 'WARN', 'SUSPEND', 'BAN', 'LIMIT_REACH', 'BLOCK_MESSAGES']).optional(),
  notes: z.string().max(500).optional(),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const postDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_REVIEW']),
  reason: z.string().max(500).optional(),
});
export type PostDecisionInput = z.infer<typeof postDecisionSchema>;
