import { query, queryOne, withTransaction } from '../../core/db';
import { ApiError } from '../../core/http';
import { enqueue } from '../../core/queue';
import { logger } from '../../core/logger';
import { messagesModel as M } from './messages.model';

/** Realtime (WebSocket) é trabalho futuro — ver CLAUDE.md §8. Por ora é REST/poll. */

/** Normaliza o par para satisfazer CHECK(user_a < user_b). */
function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

interface ConvRow {
  id: string;
  user_a: string;
  user_b: string;
}

export const messagesService = {
  async listConversations(userId: string, limit = 30, offset = 0) {
    return query(M.listConversations(), [userId, limit, offset]);
  },

  async getMessages(userId: string, conversationId: string, limit = 50, offset = 0) {
    const conv = await queryOne<ConvRow>(M.conversationById(), [conversationId]);
    if (!conv) throw new ApiError('Conversa não encontrada.', 404);
    if (conv.user_a !== userId && conv.user_b !== userId) throw new ApiError('Acesso negado.', 403);
    await query(M.markIncomingRead(), [conversationId, userId]);
    return query(M.listMessages(), [conversationId, limit, offset]);
  },

  async send(senderId: string, otherUserId: string, content: string) {
    if (senderId === otherUserId) throw new ApiError('Não é possível enviar mensagem para si mesmo.', 400);
    const [a, b] = pair(senderId, otherUserId);

    const message = await withTransaction(async (client) => {
      let conv = await client
        .query<ConvRow>(M.findConversationByPair(), [a, b])
        .then((r) => r.rows[0]);
      if (!conv) {
        conv = (await client.query<ConvRow>(M.insertConversation(), [a, b])).rows[0]!;
      }
      const msg = (await client.query(M.insertMessage(), [conv.id, senderId, content])).rows[0];
      await client.query(M.touchConversation(), [conv.id]);
      return msg;
    });

    // notificação assíncrona (best-effort)
    enqueue('notifications', 'message', { to: otherUserId, from: senderId }).catch((err) =>
      logger.warn({ err }, 'enqueue notificação de mensagem falhou'),
    );

    return message;
  },
};
