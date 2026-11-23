// Điểm vào cho Vercel: gói toàn bộ máy chủ thành một hàm serverless phục vụ /api/*.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { openDb } from './db.ts';

let ready: Promise<FastifyInstance> | null = null;

async function boot(): Promise<FastifyInstance> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu biến môi trường DATABASE_URL.');
  const db = await openDb(url, { max: 2, ssl: process.env.DATABASE_SSL === 'no-verify' ? 'no-verify' : undefined });
  const app = await buildApp({
    db, timeScale: Number(process.env.TIME_SCALE ?? 1) || 1, adminToken: process.env.ADMIN_TOKEN, bots: process.env.BOTS !== 'off',
    secureCookies: true, trustProxy: true, staticDir: '/khong-co',
    testerUsernames: (process.env.TESTER_USERNAMES ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  });
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    ready ??= boot();
    const app = await ready;
    app.server.emit('request', req, res);
  } catch (err) {
    ready = null;
    console.error(err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'loi_may_chu', message: 'Máy chủ gặp lỗi, vui lòng thử lại.' }));
  }
}
