import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './core/env';
import { logger } from './core/logger';
import { pingDb, pool } from './core/db';
import { redis } from './core/redis';
import { startWorkers } from './workers';

/**
 * Bootstrap da API OnyLink (substitui o antigo app.listen do template).
 * Ordem: valida infra (db/redis) → sobe workers → escuta → shutdown gracioso.
 */
async function main(): Promise<void> {
  // Falha cedo se db/redis não responderem — não sobe API "meio quebrada".
  await pingDb();
  logger.info('postgres ok');

  await redis.ping();
  logger.info('redis ok');

  startWorkers();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(`OnyLink API rodando na porta ${env.PORT} (${env.NODE_ENV})`);
  });

  setupGracefulShutdown(server);
}

/** Fecha servidor, pool pg e redis em ordem ao receber sinal de término. */
function setupGracefulShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'encerrando...');

    server.close(async () => {
      try {
        await pool.end();
        await redis.quit();
        logger.info('recursos liberados, bye');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'erro no shutdown');
        process.exit(1);
      }
    });

    // Hard-stop se algo travar o close.
    setTimeout(() => {
      logger.error('shutdown forçado (timeout)');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'uncaughtException');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error({ err }, 'falha no bootstrap');
  process.exit(1);
});
