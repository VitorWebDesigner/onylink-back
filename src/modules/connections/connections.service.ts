import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { notify, notifyEvents } from '../notifications/notifications.service';
import { connectionsModel as M } from './connections.model';

export const connectionsService = {
  async follow(me: string, target: string) {
    if (me === target) throw new ApiError('Você não pode seguir a si mesmo.', 400);
    await query(M.follow(), [me, target]);
    void notifyEvents.follow(target, me);
    return { following: true };
  },
  async unfollow(me: string, target: string) {
    await query(M.unfollow(), [me, target]);
    void notifyEvents.removeFollow(target, me);
    return { following: false };
  },

  async request(me: string, target: string) {
    if (me === target) throw new ApiError('Conexão inválida.', 400);
    const row = await queryOne<{ id: string }>(M.requestConnection(), [me, target]);
    if (!row) throw new ApiError('Convite já enviado.', 409);
    await notify(target, 'CONNECTION', { from: me, connectionId: row.id, kind: 'REQUEST' });
    return row;
  },

  async accept(me: string, id: string) {
    const row = await queryOne<{ requester_id: string }>(M.accept(), [id, me]);
    if (!row) throw new ApiError('Convite não encontrado.', 404);
    await notify(row.requester_id, 'CONNECTION', { from: me, connectionId: id, kind: 'ACCEPTED' });
    return row;
  },

  async reject(me: string, id: string) {
    await query(M.reject(), [id, me]);
    return { ok: true };
  },

  async remove(me: string, id: string) {
    await query(M.remove(), [id, me]);
    return { ok: true };
  },

  list: (me: string) => query(M.myConnections(), [me]),
  pending: (me: string) => query(M.pending(), [me]),

  async recommended(me: string) {
    const profile = await queryOne<{ segment: string | null; city: string | null }>(
      'SELECT segment, city FROM profiles WHERE user_id = $1',
      [me],
    );
    return query(M.recommended(), [me, profile?.segment ?? null, profile?.city ?? null]);
  },

  /** Sugestões por afinidade com o usuário recém-seguido (seed). */
  async suggestions(me: string, seedId: string, limit = 6) {
    const seed = await queryOne<{ segment: string | null; city: string | null }>(
      'SELECT segment, city FROM profiles WHERE user_id = $1',
      [seedId],
    );
    return query(M.suggestionsLike(), [me, seed?.segment ?? null, seed?.city ?? null, seedId, limit]);
  },
};
