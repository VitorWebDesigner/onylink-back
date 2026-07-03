import axios from 'axios';
import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { publicUrl, uploadObject } from '../../core/storage/bunny';
import { createCollection, createVideo, streamToken, tusAuth } from '../../core/storage/bunnyStream';
import { computeMediaRoot, storagePath, streamVideoTitle, type StreamKind } from '../../core/storage/paths';
import type { CreateVideoInput, UploadImageInput } from './media.schema';

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const fetchText = async (url: string): Promise<string> => String((await axios.get(url, { responseType: 'text', timeout: 15000 })).data);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB (o front comprime antes de enviar)

/**
 * Mantém só as N variantes de MAIOR bitrate do master HLS (ordenadas da melhor pra
 * pior) e descarta as de baixa qualidade. Sem isso o ABR começa numa resolução baixa
 * (pixelado) e só depois sobe — o dono quer qualidade boa desde o início. Se não for um
 * master (sem `#EXT-X-STREAM-INF`) ou já tiver <= N variantes, devolve intacto.
 */
function keepTopVariants(body: string, top = 2): string {
  const lines = body.split('\n');
  const head: string[] = [];
  const variants: { inf: string; uri: string; bw: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim().startsWith('#EXT-X-STREAM-INF')) {
      let j = i + 1;
      while (j < lines.length && !(lines[j] ?? '').trim()) j++; // próxima linha não-vazia = URI da variante
      variants.push({ inf: line, uri: lines[j] ?? '', bw: Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0) });
      i = j;
    } else {
      head.push(line);
    }
  }
  if (variants.length <= top) return body;
  const kept = [...variants].sort((a, b) => b.bw - a.bw).slice(0, top);
  return [...head, ...kept.flatMap((v) => [v.inf, v.uri])].join('\n');
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Pasta-raiz de mídia do usuário (backfill sob demanda se estiver nula). */
async function getMediaRoot(userId: string): Promise<string> {
  const row = await queryOne<{ media_root: string | null; handle: string; created_at: Date }>(
    'SELECT media_root, handle, created_at FROM users WHERE id = $1',
    [userId],
  );
  if (!row) throw new ApiError('Usuário não encontrado.', 404);
  if (row.media_root) return row.media_root;
  const root = computeMediaRoot(row.handle, row.created_at);
  await query('UPDATE users SET media_root = $2 WHERE id = $1', [userId, root]);
  return root;
}

export const mediaService = {
  /** Recebe base64, sobe pro Storage na pasta do usuário + tipo (taxonomia) e devolve caminho + URL. */
  async uploadImage(userId: string, input: UploadImageInput) {
    const buffer = Buffer.from(input.data, 'base64');
    if (!buffer.length) throw new ApiError('Imagem inválida.', 400);
    if (buffer.length > MAX_BYTES) throw new ApiError('Imagem muito grande (máx. 10MB).', 413);

    const root = await getMediaRoot(userId);
    const ext = EXT[input.contentType] ?? 'jpg';
    const path = storagePath(root, input.kind, ext);
    await uploadObject(path, buffer, input.contentType);
    return { type: 'IMAGE' as const, path, url: publicUrl(path) };
  },

  /**
   * Prepara o upload de um vídeo: garante a coleção do usuário, cria o objeto de
   * vídeo (título estruturado p/ auditoria) e devolve a autorização TUS presigned
   * pro app subir os bytes DIRETO pro Bunny. `post_media.path` = GUID do vídeo.
   */
  async createVideoUpload(userId: string, input: CreateVideoInput) {
    const u = await queryOne<{ media_root: string | null; stream_collection_id: string | null; handle: string; created_at: Date }>(
      'SELECT media_root, stream_collection_id, handle, created_at FROM users WHERE id = $1',
      [userId],
    );
    if (!u) throw new ApiError('Usuário não encontrado.', 404);
    const root = u.media_root ?? computeMediaRoot(u.handle, u.created_at);

    let collectionId = u.stream_collection_id;
    if (!collectionId) {
      collectionId = await createCollection(root);
      await query('UPDATE users SET stream_collection_id = $2, media_root = COALESCE(media_root, $3) WHERE id = $1', [userId, collectionId, root]);
    }

    const title = streamVideoTitle(root, input.kind as StreamKind);
    const videoId = await createVideo(title, collectionId);
    return { ...tusAuth(videoId), collectionId };
  },

  /**
   * PROXY de manifesto HLS (só os .m3u8 pequenos passam por aqui; os segmentos .ts
   * pesados vão DIRETO do CDN da Bunny). Necessário porque a Bunny com token auth
   * NÃO injeta o token nas URLs-filhas do manifesto, e o player nativo não re-assina.
   * master → aponta as variantes pro nosso proxy (relativo); sub → aponta os
   * segmentos pra URLs ABSOLUTAS Bunny já com o token de diretório.
   */
  async hlsMaster(guid: string): Promise<string> {
    const tok = streamToken(guid);
    if (!tok) throw new ApiError('Stream não configurado.', 500);
    const raw = await fetchText(`https://${tok.host}/${guid}/playlist.m3u8?${tok.qs}`);
    const body = keepTopVariants(raw); // só as variantes de alta qualidade (sem começar pixelado)
    const child = (sub: string) => (/^https?:/.test(sub) ? sub : `sub/${b64url(sub)}.m3u8`);
    return body
      .split('\n')
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${child(u)}"`);
        return child(t);
      })
      .join('\n');
  },

  async hlsSub(guid: string, enc: string): Promise<string> {
    const tok = streamToken(guid);
    if (!tok) throw new ApiError('Stream não configurado.', 500);
    const subPath = unb64url(enc.replace(/\.m3u8$/, ''));
    const dir = subPath.includes('/') ? subPath.slice(0, subPath.lastIndexOf('/')) : '';
    const body = await fetchText(`https://${tok.host}/${guid}/${subPath}?${tok.qs}`);
    const abs = (seg: string) => {
      if (/^https?:/.test(seg)) return seg;
      const p = dir ? `${dir}/${seg}` : seg;
      return `https://${tok.host}/${guid}/${p}?${tok.qs}`;
    };
    return body
      .split('\n')
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${abs(u)}"`);
        return abs(t);
      })
      .join('\n');
  },
};
