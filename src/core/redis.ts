import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Conexão Redis compartilhada (cache de feed, rate-limit, sessão).
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ — reaproveitamos a mesma url.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => logger.debug('redis conectado'));
redis.on('error', (err) => logger.error({ err }, 'erro no redis'));

/** Conexão dedicada para BullMQ (não compartilhar com comandos normais). */
export function createQueueConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
