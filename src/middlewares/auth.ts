import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../core/crypto';
import { jsonMount } from '../core/http';

/** Extrai o accessToken do header Authorization: Bearer <jwt>. */
function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

/** Exige autenticação. Popula req.user ou responde 401-lógico. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = bearer(req);
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) {
    res.status(401).json(jsonMount(false, {}, 'Sessão expirada. Faça login novamente.'));
    return;
  }
  req.user = { id: claims.sub, role: claims.role };
  next();
}

/** Autenticação opcional: popula req.user se houver token válido, mas não bloqueia. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearer(req);
  const claims = token ? verifyAccessToken(token) : null;
  if (claims) req.user = { id: claims.sub, role: claims.role };
  next();
}

/** Exige um dos papéis informados (use depois de requireAuth). */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json(jsonMount(false, {}, 'Acesso negado.'));
      return;
    }
    next();
  };
}
