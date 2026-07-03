import type { Response } from 'express';
import { encryptTransport } from './crypto';
import { logger } from './logger';

/**
 * Envelope de resposta do OnyLink (compat com o template do dono).
 * Toda resposta é { payload: <jwt({ boleano, obj, mensagem })> }.
 */
export interface ApiBody<T = unknown> {
  boleano: boolean;
  obj: T;
  mensagem: string;
}

/** Monta o envelope assinado. Use no controller: res.json(jsonMount(true, data, 'ok')). */
export function jsonMount<T>(boleano: boolean, obj: T, mensagem: string): { payload: string } {
  const body: ApiBody<T> = { boleano, obj, mensagem };
  return { payload: encryptTransport(body) };
}

/** Atalho: envia o envelope direto na Response. */
export function send<T>(res: Response, boleano: boolean, obj: T, mensagem: string, status = 200): Response {
  return res.status(status).json(jsonMount(boleano, obj, mensagem));
}

/**
 * Erro de negócio controlado. Lançado nos services; o middleware de erro
 * converte em resposta { boleano:false, mensagem }.
 */
export class ApiError extends Error {
  constructor(
    public readonly mensagem: string,
    public readonly status = 400,
    public readonly publicData: unknown = {},
  ) {
    super(mensagem);
    this.name = 'ApiError';
  }
}

/**
 * Fallback de erro inesperado (mantém o padrão do template: status 200,
 * boleano:false, mensagem genérica; detalhe só no log).
 */
export function errorHandle(error: unknown, rota: string): { payload: string } {
  logger.error({ err: error, rota }, `erro na rota ${rota}`);
  return jsonMount(false, {}, 'Tente novamente mais tarde!');
}
