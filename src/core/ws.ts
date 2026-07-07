import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './env';
import { logger } from './logger';

/**
 * WebSocket do chat (Fase C do plano-grupos-comunidades): push REAL de
 * mensagem/lida pros aparelhos conectados — o app deixa o polling como
 * fallback. Handshake: `GET /ws?token=<accessToken>` (JWT AUTH_SECRET; o
 * corpo-envelope §5.1 não se aplica — não há corpo em WS).
 *
 * ⚠️ Quando o Marcelo colocar nginx/domínio na frente, o proxy PRECISA
 * repassar upgrade:  proxy_set_header Upgrade $http_upgrade;
 *                    proxy_set_header Connection "upgrade";
 */
const clients = new Map<string, Set<WebSocket>>();

export function initWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let userId: string;
    try {
      const url = new URL(req.url ?? '', 'http://local');
      const token = url.searchParams.get('token') ?? '';
      const payload = jwt.verify(token, env.AUTH_SECRET) as { sub?: string };
      if (!payload.sub) throw new Error('sem sub');
      userId = payload.sub;
    } catch {
      ws.close(4001, 'unauthorized');
      return;
    }

    let set = clients.get(userId);
    if (!set) { set = new Set(); clients.set(userId, set); }
    set.add(ws);

    ws.on('close', () => {
      const s = clients.get(userId);
      if (s) { s.delete(ws); if (!s.size) clients.delete(userId); }
    });
    ws.on('error', () => undefined);
  });

  // keepalive: derruba conexões mortas (proxies/celular trocando de rede)
  const ping = setInterval(() => {
    wss.clients.forEach((ws) => { try { ws.ping(); } catch { /* noop */ } });
  }, 30_000);
  ping.unref();
  wss.on('close', () => clearInterval(ping));

  logger.info('WebSocket /ws pronto');
}

/** Envia um evento pra TODAS as conexões de um usuário (best-effort). */
export function wsSend(userId: string, event: Record<string, unknown>): void {
  const set = clients.get(userId);
  if (!set?.size) return;
  const data = JSON.stringify(event);
  for (const ws of set) {
    try { if (ws.readyState === WebSocket.OPEN) ws.send(data); } catch { /* noop */ }
  }
}
