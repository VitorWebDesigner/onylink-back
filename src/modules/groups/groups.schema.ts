import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  segment: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  coverPath: z.string().max(500).optional(),
  isPremium: z.boolean().optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const listGroupsSchema = z.object({
  segment: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
export type ListGroupsInput = z.infer<typeof listGroupsSchema>;
