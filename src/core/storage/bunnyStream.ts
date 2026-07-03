import crypto from 'node:crypto';
import axios from 'axios';
import { env } from '../env';
import { logger } from '../logger';
import { ApiError } from '../http';

/**
 * Bunny Stream — vídeos curtos do feed.
 * Fluxo: createVideo() -> uploadVideo(guid, buffer) -> playbackUrl(guid).
 * API base: https://video.bunnycdn.com/library/{libraryId}
 */
const apiBase = `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}`;

function assertConfigured(): void {
  if (!env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_KEY || !env.BUNNY_STREAM_CDN_HOST) {
    throw new ApiError('Bunny Stream não configurado', 500);
  }
}

const headers = () => ({ AccessKey: env.BUNNY_STREAM_KEY, accept: 'application/json' });

/** Cria uma coleção (pasta lógica do usuário) na biblioteca e devolve o guid. */
export async function createCollection(name: string): Promise<string> {
  assertConfigured();
  const { data } = await axios.post<{ guid: string }>(`${apiBase}/collections`, { name }, { headers: headers() });
  return data.guid;
}

/** Cria o objeto de vídeo (na coleção do usuário) e devolve o guid. */
export async function createVideo(title: string, collectionId?: string): Promise<string> {
  assertConfigured();
  try {
    const body: Record<string, unknown> = { title };
    if (collectionId) body.collectionId = collectionId;
    const { data } = await axios.post<{ guid: string }>(`${apiBase}/videos`, body, { headers: headers() });
    return data.guid;
  } catch (err) {
    logger.error({ err, title }, 'falha ao criar vídeo Bunny Stream');
    throw new ApiError('Falha ao preparar vídeo', 502);
  }
}

/**
 * Autorização presigned p/ upload TUS direto do app pro Bunny (sem expor a API key).
 * signature = sha256_hex(libraryId + apiKey + expiration + videoId). (docs Bunny Stream)
 */
export function tusAuth(videoId: string, expiresInSec = 3600) {
  const expiration = Math.floor(Date.now() / 1000) + expiresInSec;
  const signature = crypto
    .createHash('sha256')
    .update(`${env.BUNNY_STREAM_LIBRARY_ID}${env.BUNNY_STREAM_KEY}${expiration}${videoId}`)
    .digest('hex');
  return {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    libraryId: env.BUNNY_STREAM_LIBRARY_ID,
    videoId,
    signature,
    expiration,
  };
}

/** Faz upload do conteúdo do vídeo já criado. */
export async function uploadVideo(guid: string, data: Buffer): Promise<void> {
  assertConfigured();
  try {
    await axios.put(`${apiBase}/videos/${guid}`, data, {
      headers: { AccessKey: env.BUNNY_STREAM_KEY, 'Content-Type': 'application/octet-stream' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (err) {
    logger.error({ err, guid }, 'falha no upload Bunny Stream');
    throw new ApiError('Falha ao enviar vídeo', 502);
  }
}

export async function deleteVideo(guid: string): Promise<void> {
  assertConfigured();
  try {
    await axios.delete(`${apiBase}/videos/${guid}`, { headers: headers() });
  } catch (err) {
    logger.warn({ err, guid }, 'falha ao deletar vídeo Bunny Stream');
  }
}

/** Playlist HLS pública do vídeo (sem token — só se a lib permitir acesso direto). */
export function playbackUrl(guid: string): string {
  return `https://${env.BUNNY_STREAM_CDN_HOST}/${guid}/playlist.m3u8`;
}

/** Thumbnail gerada automaticamente pela Bunny. */
export function thumbnailUrl(guid: string): string {
  return `https://${env.BUNNY_STREAM_CDN_HOST}/${guid}/thumbnail.jpg`;
}

/**
 * CDN Token Authentication da Bunny (token de DIRETÓRIO): assina `/{guid}/`, então
 * o MESMO token vale pro playlist.m3u8, sub-playlists, segmentos .ts e thumbnail
 * (a Bunny reescreve o manifesto injetando o token nos segmentos). Formato:
 *   token = base64url( sha256_raw( key + token_path + expires ) )
 *   url   = arquivo?token=...&expires=...&token_path=<url-encoded token_path>
 * Sem token key configurada, cai na URL pública (playbackUrl).
 */
/**
 * Token de DIRETÓRIO (Bunny CDN token auth) que vale pra TODO arquivo em `/{guid}/`.
 * Algoritmo oficial: token = base64url( sha256( key + token_path + expires + "token_path=<path>" ) ).
 * Devolve a query string pronta + o host. Null se não houver token key.
 */
export function streamToken(guid: string, expiresInSec = 24 * 3600): { qs: string; host: string } | null {
  const key = env.BUNNY_STREAM_TOKEN_KEY;
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const tokenPath = `/${guid}/`;
  const parameterData = `token_path=${tokenPath}`;
  const token = crypto
    .createHash('sha256')
    .update(key + tokenPath + expires + parameterData)
    .digest('base64')
    .replace(/\n/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return { qs: `token=${token}&token_path=${encodeURIComponent(tokenPath)}&expires=${expires}`, host: env.BUNNY_STREAM_CDN_HOST };
}

/** URLs assinadas diretas (thumbnail single-file funciona; o HLS usa o proxy de manifesto). */
export function signedStream(guid: string, expiresInSec = 24 * 3600): { url: string; thumbnail: string } {
  const t = streamToken(guid, expiresInSec);
  if (!t) return { url: playbackUrl(guid), thumbnail: thumbnailUrl(guid) };
  return {
    url: `https://${t.host}/${guid}/playlist.m3u8?${t.qs}`,
    thumbnail: `https://${t.host}/${guid}/thumbnail.jpg?${t.qs}`,
  };
}
