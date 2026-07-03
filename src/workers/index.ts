import { registerWorker } from '../core/queue';
import { classifyPost } from '../modules/moderation/moderation';
import { sendMail } from '../core/mailer';
import { sendPush } from '../core/push';
import { logger } from '../core/logger';
import type { NotificationType, NotifyPayload } from '../modules/notifications/notifications.service';

/**
 * Registra os workers das filas BullMQ. Chamado no bootstrap (server.ts).
 * Em produção pode rodar num processo separado para escalar independente da API.
 */
export function startWorkers(): void {
  registerWorker<{ postId: string; content: string }>('moderation', async (job) => {
    await classifyPost(job.data.postId, job.data.content);
  });

  registerWorker<{ to: string; subject: string; html: string; text?: string }>('email', async (job) => {
    await sendMail(job.data);
  });

  // push: enfileirado pelo notify() quando a notificação in-app é criada.
  // Outros jobs históricos da fila ('post_decision', 'message') são ignorados.
  registerWorker<{ userId: string; type: NotificationType; payload: NotifyPayload }>('notifications', async (job) => {
    if (job.name !== 'push') return;
    await sendPush(job.data.userId, job.data.type, job.data.payload);
  });

  logger.info('workers BullMQ iniciados (moderation, email, notifications/push)');
}
