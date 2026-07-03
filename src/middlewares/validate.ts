import type { NextFunction, Request, Response } from 'express';
import { type ZodTypeAny } from 'zod';
import { jsonMount } from '../core/http';

/**
 * Valida req.data (corpo já decodificado do envelope) contra um schema Zod.
 * Em sucesso, sobrescreve req.data com o valor parseado/tipado.
 * Use SEMPRE depois de decodePayload.
 */
export function validate(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.data);
    if (!result.success) {
      const first = result.error.issues[0];
      const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos.';
      res.status(200).json(jsonMount(false, { issues: result.error.flatten().fieldErrors }, msg));
      return;
    }
    req.data = result.data;
    next();
  };
}

/** Helper tipado para ler req.data dentro do controller. */
export function body<T>(req: Request): T {
  return req.data as T;
}

/** Valida req.query (GET com filtros). Coloca o resultado parseado em req.data. */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const first = result.error.issues[0];
      const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Filtros inválidos.';
      res.status(200).json(jsonMount(false, {}, msg));
      return;
    }
    req.data = result.data;
    next();
  };
}
