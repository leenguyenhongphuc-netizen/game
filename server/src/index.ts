import { buildApp } from './app.ts';
import { openDb } from './db.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Thiếu biến môi trường DATABASE_URL (chuỗi kết nối PostgreSQL).');
  process.exit(1);
}
const timeScale = Number(process.env.TIME_SCALE ?? 1);
if (!(timeScale > 0)) {
  console.error('TIME_SCALE phải là số dương.');
  process.exit(1);
}

const db = await openDb(databaseUrl);
const app = await buildApp({
  db,
  timeScale,
  adminToken: process.env.ADMIN_TOKEN,
  secureCookies: process.env.NODE_ENV === 'production',
});
const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
console.log(`Vườn Việt đang chạy ở cổng ${port} (TIME_SCALE=${timeScale})`);
