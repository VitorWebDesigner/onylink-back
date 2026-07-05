import crypto from 'node:crypto';

/**
 * ============================================================================
 * TAXONOMIA DE MÍDIA — fonte ÚNICA e auditável de onde cada arquivo mora.
 * Toda escrita de mídia DEVE passar por aqui (nunca montar path na mão).
 * ============================================================================
 *
 * Cada usuário tem uma PASTA-RAIZ reservada, criada no cadastro:
 *   mediaRoot = "{handle}-{YYYY-MM-DD da criação da conta}"   (ex.: vitormoura-2026-07-01)
 * guardada em users.media_root. Dentro dela, SUBPASTAS por tipo e ARQUIVOS
 * nomeados pela DATA/HORA da postagem — auditoria trivial (quem, o quê, quando).
 *
 * STORAGE (imagens/arquivos — Bunny Storage `onylink`, CDN `onylink.b-cdn.net`):
 *   users/{mediaRoot}/{dir}/{YYYYMMDD_HHMMSS}_{rand}.{ext}
 *   dir (STORAGE_DIRS): profile/avatar · profile/cover · profile/company ·
 *   posts/images · comments/images · opportunities/images · stories/images · messages/images
 *
 * STREAM (vídeos — biblioteca `OnyLink`): sem pastas; cada usuário tem uma
 *   COLEÇÃO (nome = mediaRoot, id em users.stream_collection_id); o vídeo entra
 *   nela com TÍTULO estruturado `{mediaRoot}/{posts|stories|messages}/{data}`;
 *   post_media.path guarda o GUID do vídeo.
 */

const two = (n: number) => String(n).padStart(2, '0');
const rand = () => crypto.randomBytes(4).toString('hex');
const dateStamp = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}_${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}`;
};

/** Nome da pasta-raiz de mídia do usuário: {handle}-{YYYY-MM-DD}. */
export function computeMediaRoot(handle: string, createdAt: Date): string {
  const slug = handle.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'user';
  const date = `${createdAt.getUTCFullYear()}-${two(createdAt.getUTCMonth() + 1)}-${two(createdAt.getUTCDate())}`;
  return `${slug}-${date}`;
}

// ───────────────── Storage (imagens/arquivos) ─────────────────
export const STORAGE_DIRS = {
  avatar: 'profile/avatar',
  cover: 'profile/cover',
  companyLogo: 'profile/company',
  communityCover: 'communities/covers',
  chatGroupPhoto: 'messages/groups',
  postImage: 'posts/images',
  commentImage: 'comments/images',
  opportunityImage: 'opportunities/images',
  storyImage: 'stories/images',
  messageImage: 'messages/images',
} as const;
export type StorageKind = keyof typeof STORAGE_DIRS;

/** Caminho de uma imagem no Storage: users/{mediaRoot}/{dir}/{data}_{rand}.{ext}. */
export function storagePath(mediaRoot: string, kind: StorageKind, ext = 'jpg'): string {
  return `users/${mediaRoot}/${STORAGE_DIRS[kind]}/${dateStamp()}_${rand()}.${ext.replace(/^\.+/, '')}`;
}

/** Arquivo placeholder que RESERVA a pasta-raiz no Storage (Bunny cria pasta ao subir arquivo). */
export function rootKeepPath(mediaRoot: string): string {
  return `users/${mediaRoot}/_onylink.txt`;
}

// ───────────────── Stream (vídeos) ─────────────────
export const STREAM_DIRS = {
  postVideo: 'posts',
  storyVideo: 'stories',
  messageVideo: 'messages',
} as const;
export type StreamKind = keyof typeof STREAM_DIRS;

/** Título estruturado do vídeo (aparece na lib da Bunny — facilita auditoria). */
export function streamVideoTitle(mediaRoot: string, kind: StreamKind): string {
  return `${mediaRoot}/${STREAM_DIRS[kind]}/${dateStamp()}_${rand()}`;
}
