import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { authService } from './auth.service';
import type { ForgotInput, LoginInput, NewPassInput, RefreshInput, RegisterInput } from './auth.schema';

export const authController = {
  async register(req: Request, res: Response) {
    const data = await authService.register(body<RegisterInput>(req));
    send(res, true, data, 'Conta criada com sucesso!');
  },

  async login(req: Request, res: Response) {
    const data = await authService.login(body<LoginInput>(req));
    send(res, true, data, 'Bem vindo!');
  },

  async forgot(req: Request, res: Response) {
    const data = await authService.forgotPassword(body<ForgotInput>(req));
    send(res, true, {}, data.message);
  },

  async newPass(req: Request, res: Response) {
    const data = await authService.resetPassword(body<NewPassInput>(req));
    send(res, true, {}, data.message);
  },

  async refresh(req: Request, res: Response) {
    const data = await authService.refresh(body<RefreshInput>(req).refreshToken);
    send(res, true, data, 'ok');
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = body<{ refreshToken?: string }>(req) ?? {};
    const data = await authService.logout(refreshToken ?? '');
    send(res, true, {}, data.message);
  },

  async me(req: Request, res: Response) {
    const data = await authService.me(req.user!.id);
    send(res, true, data, 'ok');
  },

  async handleAvailable(req: Request, res: Response) {
    const handle = String(req.query.handle ?? '').toLowerCase();
    const data = await authService.handleAvailable(handle);
    send(res, true, data, 'ok');
  },
};
