import { z } from 'zod';

export const CATEGORIES = [
  'Vendas','Marketing','Financeiro','Gestão','Liderança','Operação','Tecnologia','Contratação','Networking','Indicações','Cases','Oportunidades','Dúvidas',
] as const;

const mediaSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO']),
  path: z.string().min(1), // caminho Bunny Storage (IMAGE) ou guid Stream (VIDEO)
});

export const createPostSchema = z
  .object({
    category: z.enum(CATEGORIES),
    // texto OU mídia — post só de imagem/vídeo (sem legenda) é permitido
    content: z.string().max(5000).optional().default(''),
    groupId: z.string().uuid().optional(),
    media: z.array(mediaSchema).max(6).optional(),
  })
  .refine((d) => (d.content?.trim().length ?? 0) > 0 || (d.media?.length ?? 0) > 0, {
    message: 'Escreva algo ou adicione uma mídia.',
    path: ['content'],
  });
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  category: z.enum(CATEGORIES).optional(),
});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const feedQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  groupId: z.string().uuid().optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(), // resposta a outro comentário (thread)
});
export type CommentInput = z.infer<typeof commentSchema>;
