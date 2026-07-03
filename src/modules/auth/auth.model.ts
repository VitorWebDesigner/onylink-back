/**
 * SQL do módulo auth. Funções puras que devolvem string parametrizada.
 * Convenção: $1,$2... sempre; nenhuma interpolação de string.
 */
export const authModel = {
  findByEmail: () => `
    SELECT u.id, u.name, u.email, u.handle, u.password_hash, u.role, u.active, u.suspended_until
    FROM users u
    WHERE u.email = $1
    LIMIT 1`,

  findByHandle: () => `SELECT id FROM users WHERE lower(handle) = lower($1) LIMIT 1`,

  insertUser: () => `
    INSERT INTO users (name, email, handle, password_hash, role)
    VALUES ($1, $2, $3, $4, 'USER')
    RETURNING id, name, email, handle, role`,

  insertProfile: () => `
    INSERT INTO profiles (user_id, role_title, segment, city, state)
    VALUES ($1, $2, $3, $4, $5)`,

  updatePassword: () => `
    UPDATE users SET password_hash = $2 WHERE email = $1 AND active = true`,

  /* refresh tokens */
  insertRefresh: () => `
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id`,

  findRefresh: () => `
    SELECT id, user_id, revoked, expires_at
    FROM refresh_tokens
    WHERE token_hash = $1
    LIMIT 1`,

  revokeRefresh: () => `
    UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,

  revokeAllForUser: () => `
    UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,

  /* perfil resumido para /me */
  meById: () => `
    SELECT u.id, u.name, u.email, u.handle, u.role, u.email_verified,
           p.avatar_path, p.bio, p.role_title, p.segment, p.city, p.state,
           p.points, p.profile_complete, p.company_id
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1
    LIMIT 1`,
};
