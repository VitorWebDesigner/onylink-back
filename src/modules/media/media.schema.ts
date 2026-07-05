import { z } from 'zod';

// Tipos de imagem aceitos (batem com STORAGE_DIRS em core/storage/paths.ts) —
// definem em qual pasta do usuário o arquivo é salvo (taxonomia auditável).
export const IMAGE_KINDS = [
  'avatar', 'cover', 'companyLogo', 'communityCover', 'chatGroupPhoto', 'postImage', 'commentImage', 'opportunityImage', 'storyImage', 'messageImage',
] as const;

/** Upload de imagem via base64 (sem o prefixo data:) — vai no envelope §5.1. */
export const uploadImageSchema = z.object({
  data: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  kind: z.enum(IMAGE_KINDS).default('postImage'),
});
export type UploadImageInput = z.infer<typeof uploadImageSchema>;

/** Prepara upload de vídeo (Bunny Stream): backend cria o vídeo + assina o TUS. */
export const createVideoSchema = z.object({
  kind: z.enum(['postVideo', 'storyVideo', 'messageVideo']).default('postVideo'),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;
