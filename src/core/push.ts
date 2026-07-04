import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { query, queryOne } from './db';
import { logger } from './logger';
import { notificationsModel as M } from '../modules/notifications/notifications.model';
import type { NotificationType, NotifyPayload } from '../modules/notifications/notifications.service';

const expo = new Expo();

/** Título/corpo pt-BR + deep link por tipo de evento. */
function buildMessage(type: NotificationType, actorName: string, payload: NotifyPayload): { title: string; body: string; url: string } | null {
  const preview = payload.preview ? ` “${payload.preview}”` : '';
  switch (type) {
    case 'LIKE': return { title: 'OnyLink', body: `${actorName} curtiu sua publicação`, url: `/post/${payload.postId}` };
    case 'INSIGHT': return { title: 'OnyLink', body: `${actorName} marcou insight na sua publicação 💡`, url: `/post/${payload.postId}` };
    case 'REPOST': return { title: 'OnyLink', body: `${actorName} repostou sua publicação`, url: `/post/${payload.postId}` };
    case 'COMMENT': return { title: `${actorName} comentou`, body: preview.trim() || 'na sua publicação', url: `/post/${payload.postId}` };
    case 'REPLY': return { title: `${actorName} respondeu você`, body: preview.trim() || 'no seu comentário', url: `/post/${payload.postId}` };
    case 'SUBSCRIBED': return { title: 'Publicação que você acompanha', body: `${actorName} comentou${preview}`, url: `/post/${payload.postId}` };
    case 'FOLLOW': return { title: 'OnyLink', body: `${actorName} começou a seguir você`, url: payload.actorId ? `/user/${payload.actorId}` : '/notifications' };
    case 'APPLICATION': return { title: 'Nova candidatura', body: `${actorName} se candidatou à${preview}`, url: payload.opportunityId ? `/opportunity/applications/${payload.opportunityId}` : '/notifications' };
    case 'JOIN_REQUEST': return { title: 'Pedido de entrada', body: `${actorName} quer entrar em${preview}`, url: payload.groupId ? `/group/${payload.groupId}` : '/notifications' };
    case 'JOIN_APPROVED': return { title: 'Bem-vindo!', body: `Seu pedido para entrar em${preview} foi aprovado`, url: payload.groupId ? `/group/${payload.groupId}` : '/notifications' };
    case 'GROUP_POST': return {
      title: typeof payload.groupName === 'string' && payload.groupName ? payload.groupName : 'Nova publicação na comunidade',
      body: `${actorName} publicou${preview}`,
      url: payload.groupId ? `/group/${payload.groupId}` : `/post/${payload.postId}`,
    };
    default: return null; // legados (CONNECTION etc.) sem push por enquanto
  }
}

/**
 * Envia o push de UMA notificação pro(s) aparelho(s) do usuário (Expo Push
 * Service). Token inválido/desregistrado é PURGADO. Chamado pelo worker BullMQ.
 */
export async function sendPush(userId: string, type: NotificationType, payload: NotifyPayload): Promise<void> {
  const tokens = await query<{ token: string }>(M.pushTokensByUser(), [userId]);
  if (!tokens.length) return;

  const actor = payload.actorId
    ? await queryOne<{ name: string }>(M.actorName(), [payload.actorId]).catch(() => null)
    : null;
  const msg = buildMessage(type, actor?.name ?? 'Alguém', payload);
  if (!msg) return;

  const valid = tokens.map((t) => t.token).filter((t) => Expo.isExpoPushToken(t));
  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: 'default',
    title: msg.title,
    body: msg.body,
    data: { url: msg.url },
  }));

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // token morto → remove pra não insistir
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error') {
          const dead = ticket.details?.error === 'DeviceNotRegistered';
          const token = (chunk[i]?.to as string) ?? '';
          if (dead && token) void query(M.purgePushToken(), [token]).catch(() => undefined);
          logger.warn({ error: ticket.details?.error, message: ticket.message }, 'push ticket com erro');
        }
      });
    } catch (err) {
      logger.error({ err }, 'falha ao enviar chunk de push');
    }
  }
}
