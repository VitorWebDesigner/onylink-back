import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Usuário autenticado (preenchido por middlewares/auth). */
      user?: { id: string; role: string };
      /** Corpo já decodificado do envelope payload-in-JWT (middlewares/payload). */
      data?: unknown;
    }
  }
}

export {};
