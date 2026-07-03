import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação central de variáveis de ambiente.
 * Falha cedo (no boot) se algo crítico estiver faltando — nunca segredo no código.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4444),
  CORS_ORIGINS: z.string().default(''),

  // Postgres
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().default(5432),
  PGDATABASE: z.string().default('onylink'),
  PGUSER: z.string().default('onylink'),
  PGPASSWORD: z.string().default('change-me'),
  PG_POOL_MAX: z.coerce.number().default(20),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Secrets
  AUTH_SECRET: z.string().min(8),
  REFRESH_SECRET: z.string().min(8),
  TRANSPORT_SECRET: z.string().min(8),
  TOTP_SECRET: z.string().min(8),
  AES_KEY: z.string().length(64, 'AES_KEY deve ter 64 chars hex (32 bytes)'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  // SMTP (Hostinger)
  SMTP_HOST: z.string().default('smtp.hostinger.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().email().default('no-reply@goxtechub.com'),
  SMTP_PASS: z.string().default('change-me'),
  MAIL_FROM: z.string().default('OnyLink <no-reply@goxtechub.com>'),

  // Bunny
  BUNNY_STORAGE_ZONE: z.string().default('onylink'),
  BUNNY_STORAGE_KEY: z.string().default(''),
  BUNNY_STORAGE_HOST: z.string().default('storage.bunnycdn.com'),
  BUNNY_PULLZONE_HOST: z.string().default(''),
  BUNNY_STREAM_LIBRARY_ID: z.string().default(''),
  BUNNY_STREAM_KEY: z.string().default(''),
  BUNNY_STREAM_CDN_HOST: z.string().default(''),
  BUNNY_TOKEN_KEY: z.string().default(''),
  // "Token authentication key" da Stream (Security) — assina as URLs de vídeo/thumb.
  BUNNY_STREAM_TOKEN_KEY: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Não usa o logger aqui pra evitar dependência circular no boot.
  // eslint-disable-next-line no-console
  console.error('❌ Env inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const corsOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
