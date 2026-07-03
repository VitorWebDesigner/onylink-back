import crypto from 'node:crypto';
import axios from 'axios';
import { env } from '../env';
import { logger } from '../logger';
import { ApiError } from '../http';

/**
 * Bunny Storage (upload) + Pull Zone (CDN público) para IMAGENS e arquivos.
 * Upload: PUT https://{storageHost}/{zone}/{path}  (header AccessKey)
 * Público: https://{pullzoneHost}/{path}
 */
const storageBase = `https://${env.BUNNY_STORAGE_HOST}/${env.BUNNY_STORAGE_ZONE}`;

function assertConfigured(): void {
  if (!env.BUNNY_STORAGE_KEY || !env.BUNNY_PULLZONE_HOST) {
    throw new ApiError('Storage Bunny não configurado', 500);
  }
}

/** Sobe um buffer e devolve o caminho relativo (use publicUrl() para servir). */
export async function uploadObject(path: string, data: Buffer, contentType = 'application/octet-stream'): Promise<string> {
  assertConfigured();
  const clean = path.replace(/^\/+/, '');
  try {
    await axios.put(`${storageBase}/${clean}`, data, {
      headers: { AccessKey: env.BUNNY_STORAGE_KEY, 'Content-Type': contentType },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.debug({ path: clean, bytes: data.length }, 'bunny upload ok');
    return clean;
  } catch (err) {
    logger.error({ err, path: clean }, 'falha no upload Bunny');
    throw new ApiError('Falha ao enviar mídia', 502);
  }
}

export async function deleteObject(path: string): Promise<void> {
  assertConfigured();
  const clean = path.replace(/^\/+/, '');
  try {
    await axios.delete(`${storageBase}/${clean}`, { headers: { AccessKey: env.BUNNY_STORAGE_KEY } });
  } catch (err) {
    logger.warn({ err, path: clean }, 'falha ao deletar mídia Bunny');
  }
}

/** URL pública via Pull Zone CDN. */
export function publicUrl(path: string): string {
  return `https://${env.BUNNY_PULLZONE_HOST}/${path.replace(/^\/+/, '')}`;
}

/**
 * URL assinada (token authentication) para mídia premium.
 * Token = base64url( sha256_raw( tokenKey + path + expires ) ).
 */
export function signedUrl(path: string, expiresInSec = 3600): string {
  if (!env.BUNNY_TOKEN_KEY) return publicUrl(path);
  const clean = `/${path.replace(/^\/+/, '')}`;
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const hash = crypto
    .createHash('sha256')
    .update(env.BUNNY_TOKEN_KEY + clean + expires)
    .digest('base64')
    .replace(/\n/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${publicUrl(path)}?token=${hash}&expires=${expires}`;
}

/** Caminho padrão de mídia de usuário: users/{userId}/{kind}/{filename}. */
export function userMediaPath(userId: string, kind: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `users/${userId}/${kind}/${Date.now()}_${safe}`;
}
