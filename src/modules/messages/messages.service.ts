import { query, queryOne, withTransaction } from '../../core/db';
import { ApiError } from '../../core/http';
import { pushOnly } from '../notifications/notifications.service';
import { messagesModel as M } from './messages.model';
import type { AddMembersInput, CreateChatGroupInput, UpdateChatGroupInput } from './messages.schema';

/**
 * FASE B (plano-grupos-comunidades.md): chat 1:1 + GRUPO de chat estilo
 * WhatsApp (máx 150). Tempo real v1 = polling curto no app; WebSocket quando o
 * nginx do Marcelo liberar upgrade. Push MESSAGE não cria linha no sino —
 * mensagem é badge da aba Mensagens, não notificação social.
 */
const MAX_CHAT_MEMBERS = 150;
const MAX_PINS = 5;

/** Normaliza o par 1:1 para satisfazer CHECK(user_a < user_b). */
const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

interface ConvRow {
  id: string;
  is_group: boolean;
  name: string | null;
  created_by: string | null;
  member_count: number;
  my_role: string | null;
  peer_id: string | null;
}

async function convFor(userId: string, conversationId: string): Promise<ConvRow> {
  const c = await queryOne<ConvRow>(M.byIdFor(), [userId, conversationId]);
  if (!c) throw new ApiError('Conversa não encontrada.', 404);
  return c;
}

function requireGroupAdmin(c: ConvRow) {
  if (!c.is_group) throw new ApiError('Ação disponível só em grupos.', 400);
  if (c.my_role !== 'ADMIN') throw new ApiError('Só admins do grupo podem fazer isso.', 403);
}

const preview = (s: string, max = 90) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Grupo de chat só com a REDE do usuário (segue OU é seguido) — decisão do dono. */
async function requireContacts(userId: string, ids: string[]) {
  if (!ids.length) return;
  const bad = await query<{ id: string }>(M.nonContacts(), [userId, ids]);
  if (bad.length) throw new ApiError('Só é possível adicionar quem você segue ou te segue.', 400);
}

export const messagesService = {
  /** Conversas do usuário (1:1 + grupos), fixadas primeiro. */
  async list(userId: string, limit = 50, offset = 0) {
    return query(M.list(), [userId, limit, offset]);
  },

  /** Abre (ou retorna) a conversa 1:1 com outro usuário. */
  async openDm(userId: string, otherId: string) {
    if (userId === otherId) throw new ApiError('Não é possível conversar consigo mesmo.', 400);
    const other = await queryOne('SELECT 1 FROM users WHERE id = $1', [otherId]);
    if (!other) throw new ApiError('Usuário não encontrado.', 404);
    const [a, b] = pair(userId, otherId);
    const id = await withTransaction(async (client) => {
      let conv = (await client.query<{ id: string }>(M.findDm(), [a, b])).rows[0];
      if (!conv) conv = (await client.query<{ id: string }>(M.insertDm(), [a, b])).rows[0]!;
      await client.query(M.addMember(), [conv.id, a, 'MEMBER']);
      await client.query(M.addMember(), [conv.id, b, 'MEMBER']);
      await client.query(M.syncMemberCount(), [conv.id]);
      return conv.id;
    });
    return convFor(userId, id);
  },

  /** Lista de CONTATOS (sigo OU me seguem) — candidatos a grupo de chat. */
  async contacts(userId: string) {
    return query(M.contacts(), [userId]);
  },

  /** Cria GRUPO de chat: criador = membro-ADMIN (dono). Só com contatos. */
  async createGroup(userId: string, input: CreateChatGroupInput) {
    const ids = [...new Set(input.memberIds)].filter((id) => id !== userId);
    if (!ids.length) throw new ApiError('Adicione ao menos um participante.', 400);
    if (ids.length + 1 > MAX_CHAT_MEMBERS) throw new ApiError(`Grupo de chat comporta até ${MAX_CHAT_MEMBERS} pessoas.`, 400);
    await requireContacts(userId, ids);
    const id = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(M.insertGroup(), [
        input.name, input.description ?? null, input.photoPath ?? null, userId, ids.length + 1,
      ]);
      const convId = rows[0]!.id;
      await client.query(M.addMember(), [convId, userId, 'ADMIN']);
      for (const uid of ids) await client.query(M.addMember(), [convId, uid, 'MEMBER']);
      return convId;
    });
    return convFor(userId, id);
  },

  /** Detalhe: meta na visão do usuário + membros. */
  async detail(userId: string, conversationId: string) {
    const conv = await convFor(userId, conversationId);
    const members = await query(M.members(), [conversationId, userId]);
    return { ...conv, members };
  },

  /** Edita grupo (nome/descrição/foto) — só admin. */
  async updateGroup(userId: string, conversationId: string, input: UpdateChatGroupInput) {
    const c = await convFor(userId, conversationId);
    requireGroupAdmin(c);
    await query(M.updateGroup(), [conversationId, input.name ?? null, input.description ?? null, input.photoPath ?? null]);
    return convFor(userId, conversationId);
  },

  /** Mensagens (desc, paginadas). Abrir/poll marca LIDA (WhatsApp: ver = ler).
   *  1:1 devolve othersReadAt → ✓✓ nas minhas mensagens. */
  async messages(userId: string, conversationId: string, limit = 40, offset = 0) {
    const c = await convFor(userId, conversationId);
    const items = await query(M.listMessages(), [conversationId, limit, offset]);
    void query(M.markRead(), [conversationId, userId]).catch(() => undefined);
    const read = await queryOne<{ min_read: Date | null }>(M.othersMinRead(), [conversationId, userId]);
    return {
      items,
      othersReadAt: c.is_group ? null : read?.min_read ?? null,
      nextCursor: items.length === limit ? offset + limit : null,
    };
  },

  /** Envia mensagem (texto v1) + push aos demais membros (sem linha no sino). */
  async send(userId: string, conversationId: string, content: string) {
    const c = await convFor(userId, conversationId);
    const msg = await withTransaction(async (client) => {
      const { rows } = await client.query(M.insertMessage(), [conversationId, userId, content]);
      await client.query(M.touchConversation(), [conversationId]);
      await client.query(M.markRead(), [conversationId, userId]);
      return rows[0];
    });
    void (async () => {
      const members = await query<{ user_id: string }>(M.memberIds(), [conversationId]).catch(() => []);
      for (const m of members) {
        if (m.user_id === userId) continue;
        void pushOnly(m.user_id, 'MESSAGE', {
          actorId: userId,
          conversationId,
          preview: preview(content),
          ...(c.is_group && c.name ? { groupName: c.name } : {}),
        });
      }
    })();
    return msg;
  },

  /** Marca a conversa como lida (badge zera). */
  async markRead(userId: string, conversationId: string) {
    await convFor(userId, conversationId);
    await query(M.markRead(), [conversationId, userId]);
    return { read: true };
  },

  /** Adiciona participantes (só admin; respeita o teto de 150). */
  async addMembers(userId: string, conversationId: string, input: AddMembersInput) {
    const c = await convFor(userId, conversationId);
    requireGroupAdmin(c);
    const current = await query<{ user_id: string }>(M.memberIds(), [conversationId]);
    const have = new Set(current.map((r) => r.user_id));
    const toAdd = [...new Set(input.userIds)].filter((id) => !have.has(id));
    if (!toAdd.length) return { added: 0 };
    if (have.size + toAdd.length > MAX_CHAT_MEMBERS) {
      throw new ApiError(`Grupo de chat comporta até ${MAX_CHAT_MEMBERS} pessoas.`, 400);
    }
    await requireContacts(userId, toAdd);
    for (const uid of toAdd) await query(M.addMember(), [conversationId, uid, 'MEMBER']);
    await query(M.syncMemberCount(), [conversationId]);
    return { added: toAdd.length };
  },

  /** Sai/remove. Mesmas regras da comunidade: admin remove MEMBRO; só o DONO
   *  remove admins; dono não sai sem transferir a propriedade. */
  async removeMember(userId: string, conversationId: string, targetId: string) {
    const c = await convFor(userId, conversationId);
    if (!c.is_group) throw new ApiError('Numa conversa 1:1 não há remoção de participantes.', 400);
    const self = userId === targetId;
    if (self) {
      if (c.created_by === userId) {
        throw new ApiError('Você é o dono. Transfira a propriedade para outro admin antes de sair.', 409);
      }
    } else {
      if (c.my_role !== 'ADMIN') throw new ApiError('Só admins removem participantes.', 403);
      if (c.created_by === targetId) throw new ApiError('O dono do grupo não pode ser removido.', 403);
      const target = await queryOne<{ role: string }>(M.memberRole(), [conversationId, targetId]);
      if (!target) throw new ApiError('Participante não encontrado.', 404);
      if (target.role === 'ADMIN' && c.created_by !== userId) {
        throw new ApiError('Só o dono pode remover um admin.', 403);
      }
    }
    const removed = await queryOne(M.removeMember(), [conversationId, targetId]);
    if (!removed) throw new ApiError('Participante não encontrado.', 404);
    await query(M.syncMemberCount(), [conversationId]);
    return { removed: true };
  },

  /** Promove participante a ADMIN (admin). */
  async promote(userId: string, conversationId: string, targetId: string) {
    const c = await convFor(userId, conversationId);
    requireGroupAdmin(c);
    const row = await queryOne(M.setRole(), [conversationId, targetId, 'ADMIN']);
    if (!row) throw new ApiError('Participante não encontrado.', 404);
    return { promoted: true };
  },

  /** Transfere a PROPRIEDADE (só o dono; alvo vira admin + dono). */
  async transferOwnership(userId: string, conversationId: string, targetId: string) {
    const c = await convFor(userId, conversationId);
    if (!c.is_group) throw new ApiError('Ação disponível só em grupos.', 400);
    if (c.created_by !== userId) throw new ApiError('Só o dono pode transferir a propriedade.', 403);
    const target = await queryOne(M.memberRole(), [conversationId, targetId]);
    if (!target) throw new ApiError('O novo dono precisa ser participante do grupo.', 400);
    await query(M.setRole(), [conversationId, targetId, 'ADMIN']);
    await query(M.transferOwnership(), [conversationId, targetId]);
    return { transferred: true };
  },

  /** Fixa/desafixa (kind conversation|group conforme o tipo; máx 5 por tipo). */
  async pin(userId: string, conversationId: string) {
    const c = await convFor(userId, conversationId);
    const kind = c.is_group ? 'group' : 'conversation';
    const count = await queryOne<{ n: number }>(M.countPins(), [userId, kind]);
    if ((count?.n ?? 0) >= MAX_PINS) {
      throw new ApiError(`Você já fixou ${MAX_PINS} ${c.is_group ? 'grupos' : 'conversas'}. Desafixe antes.`, 400);
    }
    await query(M.addPin(), [userId, kind, conversationId]);
    return { pinned: true };
  },
  async unpin(userId: string, conversationId: string) {
    const c = await convFor(userId, conversationId);
    await query(M.removePin(), [userId, c.is_group ? 'group' : 'conversation', conversationId]);
    return { pinned: false };
  },
};
