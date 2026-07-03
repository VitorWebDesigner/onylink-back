import type { NextFunction, Request, Response } from 'express';
import { redis } from '../core/redis';
import { jsonMount } from '../core/http';
import { logger } from '../core/logger';

/**
 * Rate-limit simples por janela fixa via Redis (INCR + EXPIRE).
 * Use em login, forgot_pass, criação de post, etc.
 */
export function rateLimit(opts: { keyPrefix: string; max: number; windowSec: number }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? 'unknown';
    const id = req.user?.id ?? ip;
    const key = `rl:${opts.keyPrefix}:${id}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, opts.windowSec);
      if (count > opts.max) {
        res.status(429).json(jsonMount(false, {}, 'Muitas tentativas. Aguarde um momento.'));
        return;
      }
      next();
    } catch (err) {
      // Se o Redis cair, não derruba a rota — só loga e libera.
      logger.warn({ err, key }, 'rate-limit indisponível, liberando');
      next();
    }
  };
}
