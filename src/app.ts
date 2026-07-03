import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { corsOrigins, isProd } from './core/env';
import { logger } from './core/logger';
import { errorMiddleware, notFound } from './middlewares/error';

// Routers de domínio (cada um exporta default Router e traz seus próprios
// middlewares: decodePayload, validate, requireAuth, rateLimit).
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import companiesRoutes from './modules/companies/companies.routes';
import postsRoutes from './modules/posts/posts.routes';
import mediaRoutes from './modules/media/media.routes';
import connectionsRoutes from './modules/connections/connections.routes';
import groupsRoutes from './modules/groups/groups.routes';
import messagesRoutes from './modules/messages/messages.routes';
import diagnosticsRoutes from './modules/diagnostics/diagnostics.routes';
import moderationRoutes from './modules/moderation/moderation.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import gamificationRoutes from './modules/gamification/gamification.routes';
import opportunitiesRoutes from './modules/opportunities/opportunities.routes';
import adminRoutes from './modules/admin/admin.routes';

/**
 * Monta a aplicação Express (evolução do antigo src/app.js).
 * Tudo sob o prefixo /web (compat com o template — ver CLAUDE.md §5.3).
 */
export function createApp(): Express {
  const app = express();

  // Atrás de proxy (Nginx/Bunny) — necessário para rate-limit por IP correto.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      // Em produção restringe pelas origens do env; em dev libera geral.
      origin: isProd ? (corsOrigins.length ? corsOrigins : false) : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(pinoHttp({ logger }));

  // Health check (sem envelope — usado por orquestrador/load balancer).
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, service: 'onylink-api' });
  });

  // Rotas de domínio sob /web/<modulo>.
  app.use('/web/auth', authRoutes);
  app.use('/web/users', usersRoutes);
  app.use('/web/companies', companiesRoutes);
  app.use('/web/posts', postsRoutes);
  app.use('/web/media', mediaRoutes);
  app.use('/web/connections', connectionsRoutes);
  app.use('/web/groups', groupsRoutes);
  app.use('/web/messages', messagesRoutes);
  app.use('/web/diagnostics', diagnosticsRoutes);
  app.use('/web/moderation', moderationRoutes);
  app.use('/web/notifications', notificationsRoutes);
  app.use('/web/gamification', gamificationRoutes);
  app.use('/web/opportunities', opportunitiesRoutes);
  app.use('/web/admin', adminRoutes);

  // 404 + handler global de erro (envelope payload-in-JWT).
  app.use(notFound);
  app.use(errorMiddleware);

  return app;
}
