import { z } from 'zod';

/** Enviar mensagem (texto v1 — imagem/vídeo em incremento futuro). */
export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Mensagem vazia.').max(2000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Criar GRUPO de chat (estilo WhatsApp; máx 150 contando o criador). */
export const createChatGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  photoPath: z.string().url().optional(), // URL completa da CDN (kind chatGroupPhoto)
  memberIds: z.array(z.string().uuid()).min(1).max(149),
});
export type CreateChatGroupInput = z.infer<typeof createChatGroupSchema>;

/** Editar grupo (só admin; parcial). */
export const updateChatGroupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  photoPath: z.string().url().optional(),
});
export type UpdateChatGroupInput = z.infer<typeof updateChatGroupSchema>;

/** Adicionar participantes (só admin). */
export const addMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(149),
});
export type AddMembersInput = z.infer<typeof addMembersSchema>;
