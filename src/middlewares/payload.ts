import type { NextFunction, Request, Response } from 'express';
import { decryptTransport } from '../core/crypto';
import { jsonMount } from '../core/http';

/**
 * Decodifica o envelope payload-in-JWT da entrada.
 * Espera body { payload: "<jwt>" } e coloca o conteúdo real em req.data.
 * Se não houver payload, deixa req.data = body cru (tolerante para GETs/healths).
 */
export function decodePayload(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as { payload?: string } | undefined;

  if (!body || body.payload === undefined) {
    req.data = body ?? {};
    return next();
  }

  const decoded = decryptTransport(body.payload);
  if (decoded === null) {
    res.status(200).json(jsonMount(false, {}, 'Requisição inválida ou expirada.'));
    return;
  }

  req.data = decoded;
  next();
}
