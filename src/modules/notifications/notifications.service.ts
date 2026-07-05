import { query, queryOne } from '../../core/db';
import { logger } from '../../core/logger';
import { enqueue } from '../../core/queue';
import { notificationsModel as M } from './notifications.model';

export type NotificationType =
  | 'LIKE' | 'INSIGHT' | 'REPOST'            // reações no post (dedupe + des-toggle apaga)
  | 'COMMENT' | 'REPLY' | 'SUBSCRIBED'       // comentário no seu post / resposta / post que você acompanha
  | 'FOLLOW'                                 // novo seguidor (dedupe)
  | 'APPLICATION'                            // candidatura na sua oportunidade
  | 'JOIN_REQUEST' | 'JOIN_APPROVED'         // comunidade privada: pedido / aprovação
  | 'GROUP_POST'                             // nova publicação na comunidade → todos os membros
  | 'CONNECTION' | 'CONNECTION_ACCEPTED' | 'MESSAGE' | 'POST_APPROVED' | 'POST_REJECTED'; // legado/futuro

export interface NotifyPayload {
  actorId?: string;
  postId?: string;
  commentId?: string;
  opportunityId?: string;
  groupId?: string;
  conversationId?: string;
  groupName?: string;
  preview?: string;
  [k: string]: unknown;
}

/**
 * Cria uma notificação (best-effort — NUNCA quebra o fluxo principal).
 * Não notifica a si mesmo. Reações/follow são dedupadas pelos índices da 018.
 * Linha criada de fato → enfileira PUSH (worker envia via Expo Push Service).
 */
export async function notify(userId: string, type: NotificationType, payload: NotifyPayload = {}): Promise<void> {
  try {
    if (payload.actorId && payload.actorId === userId) return;
    const inserted = await queryOne<{ id: string }>(M.insert(), [userId, type, JSON.stringify(payload)]);
    if (inserted) {
      await enqueue('notifications', 'push', { userId, type, payload }).catch(() => undefined);
    }
  } catch (err) {
    logger.warn({ err, type }, 'notify falhou (ignorado)');
  }
}

/** Push SEM linha no sino (ex.: MESSAGE — mensagem é badge da aba Mensagens,
 *  não notificação social). Best-effort. */
export async function pushOnly(userId: string, type: NotificationType, payload: NotifyPayload = {}): Promise<void> {
  try {
    if (payload.actorId && payload.actorId === userId) return;
    await enqueue('notifications', 'push', { userId, type, payload }).catch(() => undefined);
  } catch (err) {
    logger.warn({ err, type }, 'pushOnly falhou (ignorado)');
  }
}

const preview = (s: string | null | undefined, max = 90) => (s ? (s.length > max ? `${s.slice(0, max - 1)}…` : s) : undefined);

/** Emissores usados pelos outros módulos (posts, connections, opportunities). */
export const notifyEvents = {
  /** Curtida/insight/repost no post → autor. */
  async postReaction(type: 'LIKE' | 'INSIGHT' | 'REPOST', postId: string, actorId: string) {
    const post = await queryOne<{ author_id: string }>(M.postAuthor(), [postId]).catch(() => null);
    if (post) await notify(post.author_id, type, { actorId, postId });
  },

  /** Des-toggle da reação → apaga a notificação correspondente. */
  async removePostReaction(type: 'LIKE' | 'INSIGHT' | 'REPOST', postId: string, actorId: string) {
    await query(M.deleteReaction(), [type, actorId, postId]).catch(() => undefined);
  },

  /** Comentário → autor do post; resposta → autor do comentário pai; inscritos → SUBSCRIBED. */
  async comment(postId: string, actorId: string, content: string, commentId: string, parentId?: string | null) {
    const p = preview(content);
    const post = await queryOne<{ author_id: string }>(M.postAuthor(), [postId]).catch(() => null);
    if (post) await notify(post.author_id, 'COMMENT', { actorId, postId, commentId, preview: p });

    if (parentId) {
      const parent = await queryOne<{ author_id: string }>(M.commentAuthor(), [parentId]).catch(() => null);
      if (parent && parent.author_id !== post?.author_id) {
        await notify(parent.author_id, 'REPLY', { actorId, postId, commentId, preview: p });
      }
    }

    const subs = await query<{ user_id: string }>(M.postSubscribers(), [postId]).catch(() => []);
    for (const s of subs) {
      if (s.user_id === post?.author_id) continue; // autor já recebeu COMMENT
      await notify(s.user_id, 'SUBSCRIBED', { actorId, postId, commentId, preview: p });
    }
  },

  /** Novo seguidor → seguido (dedupe); deixar de seguir apaga. */
  async follow(targetId: string, actorId: string) {
    await notify(targetId, 'FOLLOW', { actorId });
  },
  async removeFollow(targetId: string, actorId: string) {
    await query(M.deleteFollow(), [targetId, actorId]).catch(() => undefined);
  },

  /** Candidatura → dono da oportunidade (preview = título). */
  async application(opportunityId: string, actorId: string) {
    const opp = await queryOne<{ author_id: string; title: string }>(M.opportunityMeta(), [opportunityId]).catch(() => null);
    if (opp) await notify(opp.author_id, 'APPLICATION', { actorId, opportunityId, preview: preview(opp.title) });
  },

  /** Comunidade privada: pedido de entrada → TODOS os admins. */
  async joinRequest(groupId: string, groupName: string, actorId: string) {
    const admins = await query<{ user_id: string }>(
      `SELECT user_id FROM group_members WHERE group_id = $1 AND role = 'ADMIN'`, [groupId],
    ).catch(() => []);
    for (const a of admins) {
      await notify(a.user_id, 'JOIN_REQUEST', { actorId, groupId, preview: preview(groupName) });
    }
  },

  /** Pedido aprovado → quem pediu. */
  async joinApproved(groupId: string, groupName: string, targetId: string, actorId: string) {
    await notify(targetId, 'JOIN_APPROVED', { actorId, groupId, preview: preview(groupName) });
  },

  /** Nova publicação na comunidade → TODOS os membros (menos o autor). */
  async groupPost(groupId: string, postId: string, actorId: string, content?: string | null) {
    const group = await queryOne<{ name: string }>(
      'SELECT name FROM groups WHERE id = $1', [groupId],
    ).catch(() => null);
    const members = await query<{ user_id: string }>(
      'SELECT user_id FROM group_members WHERE group_id = $1', [groupId],
    ).catch(() => []);
    for (const m of members) {
      await notify(m.user_id, 'GROUP_POST', {
        actorId, postId, groupId,
        groupName: group?.name,
        preview: preview(content),
      });
    }
  },
};

export const notificationsService = {
  async list(userId: string, limit = 30, offset = 0) {
    return query(M.list(), [userId, limit, offset]);
  },

  /** Registra/atualiza o token do aparelho (Expo Push). */
  async registerPushToken(userId: string, token: string, platform?: string) {
    await query(M.upsertPushToken(), [token, userId, platform ?? null]);
    return { registered: true };
  },

  async unregisterPushToken(userId: string, token: string) {
    await query(M.deletePushToken(), [token, userId]);
    return { registered: false };
  },

  async unreadCount(userId: string) {
    const row = await queryOne<{ count: number }>(M.unreadCount(), [userId]);
    return { count: row?.count ?? 0 };
  },

  async markRead(userId: string, id: string) {
    await query(M.markRead(), [id, userId]);
    return { read: true };
  },

  async markAllRead(userId: string) {
    await query(M.markAllRead(), [userId]);
    return { read: true };
  },
};
