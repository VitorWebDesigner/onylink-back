import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(2).max(160),
  segment: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  employeesBand: z.string().max(40).optional(),
  area: z.string().max(120).optional(),
  logoPath: z.string().max(500).optional(),
});
export type CompanyInput = z.infer<typeof companySchema>;
