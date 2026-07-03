import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { env } from './env';
import { logger } from './logger';

/* ───────────────────────── Senhas (argon2id) ─────────────────────────
 * Substitui o MD5 do template antigo. argon2id é o estado da arte para hash
 * de senha (resistente a GPU e side-channel).
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}

/* ─────────────────── JWT de identidade (auth) ───────────────────
 * accessToken curto + refreshToken longo. Segredos separados.
 */
export interface AuthClaims {
  sub: string; // userId
  role: string;
}

export function signAccessToken(claims: AuthClaims): string {
  return jwt.sign(claims, env.AUTH_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL } as SignOptions);
}

export function signRefreshToken(claims: AuthClaims): string {
  return jwt.sign(claims, env.REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL } as SignOptions);
}

export function verifyAccessToken(token: string): (AuthClaims & JwtPayload) | null {
  try {
    return jwt.verify(token, env.AUTH_SECRET) as AuthClaims & JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): (AuthClaims & JwtPayload) | null {
  try {
    return jwt.verify(token, env.REFRESH_SECRET) as AuthClaims & JwtPayload;
  } catch {
    return null;
  }
}

/* ─────────────────── Envelope de transporte (payload-in-JWT) ───────────────────
 * Mantido do template do dono: corpo de request/response trafega dentro de um JWT
 * assinado com TRANSPORT_SECRET (simétrico). NÃO é autenticação — é ofuscação +
 * integridade do corpo. Identidade do usuário = Bearer (ver auth acima).
 */
export function encryptTransport(data: unknown): string {
  // TTL curto: o corpo de uma request não deve "viver" muito.
  return jwt.sign({ d: data }, env.TRANSPORT_SECRET, { expiresIn: '10m' });
}

export function decryptTransport<T = unknown>(payload: string): T | null {
  try {
    const decoded = jwt.verify(payload, env.TRANSPORT_SECRET) as { d: T };
    return decoded.d;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'payload de transporte inválido');
    return null;
  }
}

/* ─────────────────── Reset de senha (TOTP via speakeasy) ─────────────────── */
const TOTP_STEP = 600; // 10 min

export function generateResetCode(): string {
  return speakeasy.totp({ secret: env.TOTP_SECRET, encoding: 'hex', digits: 6, step: TOTP_STEP });
}

export function verifyResetCode(code: string): boolean {
  return speakeasy.totp.verify({
    secret: env.TOTP_SECRET,
    encoding: 'hex',
    token: code,
    step: TOTP_STEP,
    window: 1,
  });
}

/* ─────────────────── AES-256-GCM para dados sensíveis ───────────────────
 * Substitui o AES-256-CBC com IV fixo do template (CBC+IV fixo é inseguro).
 * GCM gera IV aleatório por payload e adiciona authTag. Formato: iv:tag:cipher (hex).
 */
const AES_KEY = Buffer.from(env.AES_KEY, 'hex');

export function encryptSensitive(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSensitive(blob: string): string {
  const [ivHex, tagHex, dataHex] = blob.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('blob AES malformado');
  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/** Hash determinístico (não-reversível) para indexar valores sensíveis (ex. email lookup). */
export function blindIndex(value: string): string {
  return crypto.createHmac('sha256', env.AES_KEY).update(value.toLowerCase().trim()).digest('hex');
}
