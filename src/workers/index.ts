import { registerWorker } from '../core/queue';
import { classifyPost } from '../modules/moderation/moderation';
import { sendMail } from '../core/mailer';
import { logger } from '../core/logger';

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

  // notifications/ranking: placeholders — o fan-out hoje é síncrono via notify().
  // TODO: mover fan-out pesado de notificações e recálculo de ranking para cá.

  logger.info('workers BullMQ iniciados (moderation, email)');
}
