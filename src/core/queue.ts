import { Queue, Worker, type Processor, type ConnectionOptions } from 'bullmq';
import { createQueueConnection } from './redis';
import { logger } from './logger';

/**
 * Filas BullMQ sobre Redis. Use para trabalho assíncrono:
 * - moderation: classificação de post por IA
 * - email: envio transacional
 * - notifications: fan-out de notificações
 * - ranking: recálculo de pontos/ranking
 */
export type QueueName = 'moderation' | 'email' | 'notifications' | 'ranking';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    // BullMQ traz uma cópia aninhada de ioredis; o cast resolve o conflito
    // nominal de tipos (o runtime é a mesma ioredis ^5).
    q = new Queue(name, { connection: createQueueConnection() as unknown as ConnectionOptions, defaultJobOptions });
    queues.set(name, q);
  }
  return q;
}

export async function enqueue<T extends object>(name: QueueName, jobName: string, data: T): Promise<void> {
  await getQueue(name).add(jobName, data);
  logger.debug({ queue: name, jobName }, 'job enfileirado');
}

/** Registra um worker. Chamado no bootstrap (server.ts) ou num processo separado. */
export function registerWorker<T>(name: QueueName, processor: Processor<T>): Worker<T> {
  const worker = new Worker<T>(name, processor, { connection: createQueueConnection() as unknown as ConnectionOptions });
  worker.on('failed', (job, err) => logger.error({ queue: name, jobId: job?.id, err }, 'job falhou'));
  worker.on('completed', (job) => logger.debug({ queue: name, jobId: job.id }, 'job concluído'));
  return worker;
}
