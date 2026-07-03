import pino from 'pino';
import { env, isProd } from './env';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  base: { service: 'onylink-api' },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
  redact: {
    paths: ['req.headers.authorization', 'password', 'senha', '*.password', '*.senha', 'SMTP_PASS'],
    censor: '[redacted]',
  },
});

logger.debug({ env: env.NODE_ENV }, 'logger inicializado');
