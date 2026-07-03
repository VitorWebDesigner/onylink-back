import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  // @ público e único; minúsculas, números, ponto e underscore.
  handle: z.string().regex(/^[a-z0-9._]{3,20}$/, 'O @ deve ter 3 a 20 caracteres (letras minúsculas, números, ponto ou _).'),
  password: z.string().min(8).max(72),
  roleTitle: z.string().max(120).optional(),
  segment: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  // aceita 'password' ou o legado 'pass'/'user' do template
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotSchema = z.object({
  email: z.string().email(),
});
export type ForgotInput = z.infer<typeof forgotSchema>;

export const newPassSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: z.string().min(8).max(72),
});
export type NewPassInput = z.infer<typeof newPassSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
