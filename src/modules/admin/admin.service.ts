import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { adminModel as M } from './admin.model';
import type { UpdateUserInput } from './admin.schema';

export const adminService = {
  listUsers(search: string | null, limit = 50, offset = 0) {
    return query(M.listUsers(), [search ? `%${search}%` : null, limit, offset]);
  },

  async updateUser(userId: string, input: UpdateUserInput) {
    let row: unknown;
    switch (input.action) {
      case 'SUSPEND':
        row = await queryOne(M.suspendUser(), [userId, String(input.days)]);
        break;
      case 'BAN':
        row = await queryOne(M.banUser(), [userId]);
        break;
      case 'ACTIVATE':
        row = await queryOne(M.activateUser(), [userId]);
        break;
      case 'SET_ROLE':
        row = await queryOne(M.setRole(), [userId, input.role]);
        break;
    }
    if (!row) throw new ApiError('Usuário não encontrado.', 404);
    return row;
  },

  pendingPosts(limit = 50, offset = 0) {
    return query(M.pendingPosts(), [limit, offset]);
  },

  async metrics() {
    const [users, activeUsers, postsByStatus, openReports, activeGroups] = await Promise.all([
      queryOne<{ total: number }>(M.countUsers()),
      queryOne<{ total: number }>(M.countActiveUsers()),
      query<{ status: string; total: number }>(M.countPostsByStatus()),
      queryOne<{ total: number }>(M.countOpenReports()),
      queryOne<{ total: number }>(M.countActiveGroups()),
    ]);
    return {
      users: users?.total ?? 0,
      activeUsers: activeUsers?.total ?? 0,
      postsByStatus: Object.fromEntries(postsByStatus.map((r) => [r.status, r.total])),
      openReports: openReports?.total ?? 0,
      activeGroups: activeGroups?.total ?? 0,
    };
  },
};
