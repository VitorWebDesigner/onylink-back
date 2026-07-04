import { query, queryOne, withTransaction } from '../../core/db';
import { ApiError } from '../../core/http';
import { publicUrl } from '../../core/storage/bunny';
import { signedStream } from '../../core/storage/bunnyStream';
import { notifyEvents } from '../notifications/notifications.service';
import { postsModel as M } from './posts.model';
import type { CommentInput, CreatePostInput, FeedQuery, UpdatePostInput } from './posts.schema';

interface PostRow {
  id: string;
  author_id: string;
  group_id: string | null;
  category: string;
  content: string;
  status: string;
  like_count: number;
  comment_count: number;
  repost_count?: number;
  share_count?: number;
  insight_count?: number;
  view_count?: number;
  author_followed?: boolean;
  subscribed?: boolean;
  created_at: Date;
  author_name?: string;
  author_avatar?: string | null;
  liked?: boolean;
  saved?: boolean;
  reposted?: boolean;
  shared?: boolean;
  insighted?: boolean;
  top_comment_id?: string | null;
  top_comment_content?: string | null;
  top_comment_author?: string | null;
  top_comment_like_count?: number | null;
  top_comment_insight_count?: number | null;
  top_comment_repost_count?: number | null;
  top_comment_share_count?: number | null;
  top_comment_liked?: boolean | null;
  top_comment_insighted?: boolean | null;
  top_comment_reposted?: boolean | null;
  top_comment_shared?: boolean | null;
  media?: { type: string; path: string }[];
}

/** Resolve URLs de mídia conforme o tipo (Bunny Storage vs Stream com token).
 *  VIDEO → HLS via nosso PROXY de manifesto (URL relativa; o app prefixa a apiUrl);
 *  thumbnail = URL Bunny já assinada (single-file com token funciona direto).
 *  Exportado p/ outros módulos (ex.: users → top posts/aba Mídia do perfil). */
export function mediaUrl(type: string, path: string) {
  if (type === 'VIDEO') {
    return { type, url: `/web/media/hls/${path}/master.m3u8`, thumbnail: signedStream(path).thumbnail };
  }
  return { type, url: publicUrl(path) };
}

/** Troca a mídia crua ({type,path}) do row pela resolvida ({type,url,thumbnail?}). */
function withMedia<T extends { media?: { type: string; path: string }[] }>(row: T) {
  return { ...row, media: (row.media ?? []).map((m) => mediaUrl(m.type, m.path)) };
}

export const postsService = {
  async create(authorId: string, input: CreatePostInput) {
    // publicar numa comunidade exige ser MEMBRO
    if (input.groupId) {
      const member = await queryOne(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [input.groupId, authorId],
      );
      if (!member) throw new ApiError('Você precisa ser membro para publicar nesta comunidade.', 403);
    }
    const post = await withTransaction(async (client) => {
      const { rows } = await client.query<PostRow>(M.insertPost(), [
        authorId,
        input.groupId ?? null,
        input.category,
        input.content,
      ]);
      const p = rows[0]!;
      if (input.media?.length) {
        for (let i = 0; i < input.media.length; i++) {
          const m = input.media[i]!;
          await client.query(M.insertMedia(), [p.id, m.type, m.path, i]);
        }
      }
      return p;
    });

    // Post imediato (como Instagram/X/Threads) — sem fila de moderação.
    return post;
  },

  async update(postId: string, authorId: string, input: UpdatePostInput) {
    const row = await queryOne(M.updatePost(), [postId, input.content ?? null, input.category ?? null, authorId]);
    if (!row) throw new ApiError('Post não encontrado ou sem permissão.', 404);
    return { id: postId, status: 'APPROVED' };
  },

  async remove(postId: string, authorId: string) {
    const row = await queryOne(M.deletePost(), [postId, authorId]);
    if (!row) throw new ApiError('Post não encontrado ou sem permissão.', 404);
    return { id: postId };
  },

  async getOne(postId: string) {
    const post = await queryOne<PostRow>(M.getById(), [postId]);
    if (!post) throw new ApiError('Post não encontrado.', 404);
    const media = await query<{ type: string; path: string }>(M.mediaForPost(), [postId]);
    return { ...post, media: media.map((m) => mediaUrl(m.type, m.path)) };
  },

  async feed(viewerId: string, q: FeedQuery) {
    // Feed DE COMUNIDADE: só membros veem as publicações (decisão §5.1).
    if (q.groupId) {
      const member = await queryOne(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [q.groupId, viewerId],
      );
      if (!member) throw new ApiError('Só membros veem as publicações desta comunidade.', 403);
    }
    const rows = await query<PostRow>(M.feed(), [
      viewerId,
      q.category ?? null,
      q.groupId ?? null,
      q.limit,
      q.cursor,
    ]);
    return { items: rows.map(withMedia), nextCursor: rows.length === q.limit ? q.cursor + q.limit : null };
  },

  async searchPosts(viewerId: string, term: string, limit = 20, offset = 0) {
    const rows = await query<PostRow>(M.searchPosts(), [viewerId, term, limit, offset]);
    return { items: rows.map(withMedia), nextCursor: rows.length === limit ? offset + limit : null };
  },

  /** Posts de um autor (aba Publicações do perfil). */
  async listByAuthor(viewerId: string, authorId: string, limit = 20, offset = 0) {
    const rows = await query<PostRow>(M.byAuthor(), [viewerId, authorId, limit, offset]);
    return { items: rows.map(withMedia), nextCursor: rows.length === limit ? offset + limit : null };
  },

  /** Posts repostados por um usuário (aba Reposts do perfil). */
  async listRepostedBy(viewerId: string, userId: string, limit = 20, offset = 0) {
    const rows = await query<PostRow>(M.repostedBy(), [viewerId, userId, limit, offset]);
    return { items: rows.map(withMedia), nextCursor: rows.length === limit ? offset + limit : null };
  },

  /** Fixa/desafixa post no perfil (1 por usuário; fixar limpa o anterior). */
  async pin(postId: string, authorId: string) {
    const row = await queryOne(M.pinPost(), [postId, authorId]);
    if (!row) throw new ApiError('Post não encontrado ou sem permissão.', 404);
    return { pinned: true };
  },
  async unpin(postId: string, authorId: string) {
    const row = await queryOne(M.unpinPost(), [postId, authorId]);
    if (!row) throw new ApiError('Post não encontrado ou sem permissão.', 404);
    return { pinned: false };
  },

  /** Contadores ao vivo de vários posts (polling do feed — item 2). */
  async liveCounts(ids: string[]) {
    if (!ids.length) return [];
    return query<PostRow>(M.liveCounts(), [ids]);
  },

  /** Registra 1 view do usuário (dedupe) e devolve a contagem atual. */
  async recordView(postId: string, userId: string) {
    const inserted = await queryOne(M.recordView(), [postId, userId]);
    if (inserted) await query(M.bumpView(), [postId, 1]);
    const row = await queryOne<{ view_count: number }>(M.getViewCount(), [postId]);
    return { viewCount: row?.view_count ?? 0 };
  },

  async subscribe(postId: string, userId: string) {
    await query(M.subscribe(), [postId, userId]);
    return { subscribed: true };
  },
  async unsubscribe(postId: string, userId: string) {
    await query(M.unsubscribe(), [postId, userId]);
    return { subscribed: false };
  },

  async like(postId: string, userId: string) {
    const inserted = await queryOne(M.like(), [postId, userId]);
    if (inserted) {
      await query(M.bumpLike(), [postId, 1]);
      void notifyEvents.postReaction('LIKE', postId, userId);
    }
    return { liked: true };
  },

  async unlike(postId: string, userId: string) {
    const removed = await queryOne(M.unlike(), [postId, userId]);
    if (removed) {
      await query(M.bumpLike(), [postId, -1]);
      void notifyEvents.removePostReaction('LIKE', postId, userId);
    }
    return { liked: false };
  },

  async repost(postId: string, userId: string) {
    const r = await queryOne(M.repost(), [postId, userId]);
    if (r) {
      await query(M.bumpRepost(), [postId, 1]);
      void notifyEvents.postReaction('REPOST', postId, userId);
    }
    return { reposted: true };
  },
  async unrepost(postId: string, userId: string) {
    const r = await queryOne(M.unrepost(), [postId, userId]);
    if (r) {
      await query(M.bumpRepost(), [postId, -1]);
      void notifyEvents.removePostReaction('REPOST', postId, userId);
    }
    return { reposted: false };
  },
  async share(postId: string, userId: string) {
    const r = await queryOne(M.share(), [postId, userId]);
    if (r) await query(M.bumpShare(), [postId, 1]);
    return { shared: true };
  },
  async unshare(postId: string, userId: string) {
    const r = await queryOne(M.unshare(), [postId, userId]);
    if (r) await query(M.bumpShare(), [postId, -1]);
    return { shared: false };
  },
  async insight(postId: string, userId: string) {
    const r = await queryOne(M.insight(), [postId, userId]);
    if (r) {
      await query(M.bumpInsight(), [postId, 1]);
      void notifyEvents.postReaction('INSIGHT', postId, userId);
    }
    return { insighted: true };
  },
  async uninsight(postId: string, userId: string) {
    const r = await queryOne(M.uninsight(), [postId, userId]);
    if (r) {
      await query(M.bumpInsight(), [postId, -1]);
      void notifyEvents.removePostReaction('INSIGHT', postId, userId);
    }
    return { insighted: false };
  },

  async save(postId: string, userId: string) {
    await query(M.save(), [userId, postId]);
    return { saved: true };
  },

  async unsave(postId: string, userId: string) {
    await query(M.unsave(), [userId, postId]);
    return { saved: false };
  },

  async listSaved(userId: string, cursor = 0, limit = 20) {
    const items = await query(M.listSaved(), [userId, limit, cursor]);
    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  },

  async comment(postId: string, authorId: string, input: CommentInput) {
    const c = await withTransaction(async (client) => {
      const { rows } = await client.query(M.insertComment(), [postId, authorId, input.content, input.parentId ?? null]);
      await client.query(M.bumpComment(), [postId, 1]);
      // Resposta a outro comentário → incrementa reply_count do pai (thread).
      if (input.parentId) await client.query(M.bumpReply(), [input.parentId, 1]);
      return rows[0];
    });
    const created = c as { id: string } | undefined;
    if (created?.id) void notifyEvents.comment(postId, authorId, input.content, created.id, input.parentId);
    return c;
  },

  async listComments(postId: string, viewerId: string, cursor = 0, limit = 50) {
    const items = await query(M.listComments(), [postId, viewerId, limit, cursor]);
    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  },

  async removeComment(commentId: string, authorId: string) {
    const row = await queryOne<{ post_id: string; parent_id: string | null }>(M.deleteComment(), [commentId, authorId]);
    if (!row) throw new ApiError('Comentário não encontrado ou sem permissão.', 404);
    await query(M.bumpComment(), [row.post_id, -1]);
    if (row.parent_id) await query(M.bumpReply(), [row.parent_id, -1]);
    return { id: commentId };
  },

  async likeComment(commentId: string, userId: string) {
    const r = await queryOne(M.likeComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentLike(), [commentId, 1]);
    return { liked: true };
  },
  async unlikeComment(commentId: string, userId: string) {
    const r = await queryOne(M.unlikeComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentLike(), [commentId, -1]);
    return { liked: false };
  },
  async insightComment(commentId: string, userId: string) {
    const r = await queryOne(M.insightComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentInsight(), [commentId, 1]);
    return { insighted: true };
  },
  async uninsightComment(commentId: string, userId: string) {
    const r = await queryOne(M.uninsightComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentInsight(), [commentId, -1]);
    return { insighted: false };
  },
  async repostComment(commentId: string, userId: string) {
    const r = await queryOne(M.repostComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentRepost(), [commentId, 1]);
    return { reposted: true };
  },
  async unrepostComment(commentId: string, userId: string) {
    const r = await queryOne(M.unrepostComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentRepost(), [commentId, -1]);
    return { reposted: false };
  },
  async shareComment(commentId: string, userId: string) {
    const r = await queryOne(M.shareComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentShare(), [commentId, 1]);
    return { shared: true };
  },
  async unshareComment(commentId: string, userId: string) {
    const r = await queryOne(M.unshareComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentShare(), [commentId, -1]);
    return { shared: false };
  },
};
