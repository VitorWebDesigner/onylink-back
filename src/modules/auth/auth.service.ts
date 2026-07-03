import crypto from 'node:crypto';
import { query, queryOne, withTransaction } from '../../core/db';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateResetCode,
  verifyResetCode,
} from '../../core/crypto';
import { ApiError } from '../../core/http';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../../core/mailer';
import { logger } from '../../core/logger';
import { computeMediaRoot } from '../../core/storage/paths';
import { provisionUserMedia } from '../../core/storage/provision';
import { authModel as M } from './auth.model';
import type { ForgotInput, LoginInput, NewPassInput, RegisterInput } from './auth.schema';

interface UserRow {
  id: string;
  name: string;
  email: string;
  handle: string;
  password_hash: string;
  role: string;
  active: boolean;
  suspended_until: Date | null;
}

const sha = (v: string): string => crypto.createHash('sha256').update(v).digest('hex');

/** Emite par de tokens e persiste o hash do refresh. */
async function issueTokens(userId: string, role: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, role });
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000); // alinhado com REFRESH_TOKEN_TTL
  await query(M.insertRefresh(), [userId, sha(refreshToken), expires]);
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput) {
    const exists = await queryOne<UserRow>(M.findByEmail(), [input.email]);
    if (exists) throw new ApiError('E-mail já cadastrado.', 409);
    const handleTaken = await queryOne<{ id: string }>(M.findByHandle(), [input.handle]);
    if (handleTaken) throw new ApiError('Esse @ já está em uso. Escolha outro.', 409);

    const passwordHash = await hashPassword(input.password);
    const mediaRoot = computeMediaRoot(input.handle, new Date());
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; name: string; email: string; handle: string; role: string }>(M.insertUser(), [
        input.name,
        input.email,
        input.handle,
        passwordHash,
      ]);
      const u = rows[0]!;
      await client.query(M.insertProfile(), [
        u.id,
        input.roleTitle ?? null,
        input.segment ?? null,
        input.city ?? null,
        input.state ?? null,
      ]);
      await client.query('UPDATE users SET media_root = $2 WHERE id = $1', [u.id, mediaRoot]);
      return u;
    });

    // e-mail de boas-vindas + pasta de mídia (Storage/Stream) — best-effort (não derruba o cadastro)
    sendWelcomeEmail(user.email, user.name).catch((err) => logger.warn({ err }, 'welcome email falhou'));
    void provisionUserMedia(user.id, mediaRoot);

    const tokens = await issueTokens(user.id, user.role);
    return { user: { id: user.id, name: user.name, email: user.email, handle: user.handle, role: user.role }, ...tokens };
  },

  async handleAvailable(handle: string) {
    if (!/^[a-z0-9._]{3,20}$/.test(handle)) return { available: false, valid: false };
    const taken = await queryOne<{ id: string }>(M.findByHandle(), [handle]);
    return { available: !taken, valid: true };
  },

  async login({ email, password }: LoginInput) {
    const user = await queryOne<UserRow>(M.findByEmail(), [email]);
    // verificação constante: sempre roda um verify pra mitigar timing/enumeração
    const ok = user ? await verifyPassword(user.password_hash, password) : await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$invalidsaltinvalidsalt$0000000000000000000000000000000000000000000', password);
    if (!user || !ok || !user.active) throw new ApiError('Usuário/senha incorretos', 401);
    if (user.suspended_until && user.suspended_until > new Date()) {
      throw new ApiError('Conta suspensa temporariamente.', 403);
    }
    const tokens = await issueTokens(user.id, user.role);
    return { user: { id: user.id, name: user.name, email: user.email, handle: user.handle, role: user.role }, ...tokens };
  },

  async forgotPassword({ email }: ForgotInput) {
    const user = await queryOne<UserRow>(M.findByEmail(), [email]);
    // resposta idêntica exista ou não (anti-enumeração)
    if (user) {
      const code = generateResetCode();
      await sendPasswordResetEmail(email, code).catch((err) => logger.error({ err }, 'reset email falhou'));
    }
    return { message: 'Verifique sua caixa de Email!' };
  },

  async resetPassword({ email, code, password }: NewPassInput) {
    if (!verifyResetCode(code)) throw new ApiError('Token inválido ou expirado.', 400);
    const passwordHash = await hashPassword(password);
    const rows = await query(M.updatePassword(), [email, passwordHash]);
    void rows;
    // invalida sessões antigas
    const user = await queryOne<UserRow>(M.findByEmail(), [email]);
    if (user) await query(M.revokeAllForUser(), [user.id]);
    return { message: 'Senha alterada com sucesso!' };
  },

  async refresh(refreshToken: string) {
    const claims = verifyRefreshToken(refreshToken);
    if (!claims) throw new ApiError('Sessão expirada.', 401);
    const tokenHash = sha(refreshToken);
    const row = await queryOne<{ id: string; user_id: string; revoked: boolean; expires_at: Date }>(M.findRefresh(), [
      tokenHash,
    ]);
    if (!row || row.revoked || row.expires_at < new Date()) throw new ApiError('Sessão expirada.', 401);

    // rotação: revoga o antigo, emite novo par
    await query(M.revokeRefresh(), [tokenHash]);
    const tokens = await issueTokens(claims.sub, claims.role);
    return tokens;
  },

  async logout(refreshToken: string) {
    if (refreshToken) await query(M.revokeRefresh(), [sha(refreshToken)]);
    return { message: 'Sessão encerrada.' };
  },

  async me(userId: string) {
    const me = await queryOne(M.meById(), [userId]);
    if (!me) throw new ApiError('Usuário não encontrado.', 404);
    return me;
  },
};
