import type { NextFunction, Request, Response } from 'express';
import { ApiError, jsonMount } from '../core/http';
import { logger } from '../core/logger';

/** 404 padrão (envelope). */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json(jsonMount(false, {}, 'Rota não encontrada.'));
}

/**
 * Handler global de erro. ApiError vira mensagem pública; o resto vira mensagem
 * genérica + log (não vaza stack pro cliente). Mantém o padrão do template.
 */
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(200).json(jsonMount(false, err.publicData, err.mensagem));
    return;
  }
  logger.error({ err, rota: req.originalUrl }, 'erro não tratado');
  res.status(200).json(jsonMount(false, {}, 'Tente novamente mais tarde!'));
}

/** Envolve um handler async para encaminhar rejeições ao errorMiddleware. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
