import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  avatarPath: z.string().max(500).optional(),
  coverPath: z.string().max(500).optional(),
  bio: z.string().max(200).optional(), // rede social: bio curta (decisão do dono)
  roleTitle: z.string().max(120).optional(),
  segment: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  interests: z.array(z.string().max(60)).max(20).optional(),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).max(10).optional(),
  mainGoal: z.string().max(200).optional(),
  revenueBand: z.string().max(60).optional(),
  // contatos do botão Contato (sheet e-mail/WhatsApp/site). String vazia = limpar
  // não é suportado pelo COALESCE — enviar o campo só quando preenchido.
  contactEmail: z.string().trim().max(200).optional(),
  contactWhatsapp: z.string().trim().max(30).optional(),
  contactUrl: z.string().trim().max(300).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const searchSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// máx. 100: as listas do perfil pedem mais que o padrão (Mídia=60, seguidores=100)
export const pageSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});
