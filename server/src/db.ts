import pg from 'pg';
import { SPECIALTIES } from '../../shared/catalog.ts';
import { SCHEMA } from './schema.ts';

pg.types.setTypeParser(20, (v) => Number(v)); // bigint → number (tiền và mã đều nằm trong giới hạn an toàn)

export type Q = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface Db extends Q {
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface DbOptions {
  /** Số kết nối tối đa. Hàm serverless nên để 1–2 và dùng chuỗi kết nối qua pooler. */
  max?: number;
  /** 'no-verify': bật SSL nhưng không kiểm chứng chỉ (cần cho pooler của Supabase). */
  ssl?: 'no-verify';
}

export async function openDb(connectionString: string, options: DbOptions = {}): Promise<Db> {
  const pool = new pg.Pool({ connectionString, max: options.max ?? 10, ssl: options.ssl === 'no-verify' ? { rejectUnauthorized: false } : undefined });
  const db: Db = {
    query: (text, params) => pool.query(text, params as any[]),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn({ query: (t, p) => client.query(t, p as any[]) });
        await client.query('commit');
        return out;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
  await db.query(SCHEMA);
  // Nạp giá mẫu cho đặc sản chưa có giá nào.
  const ids = Object.keys(SPECIALTIES);
  await db.query(
    `insert into price_ticks (specialty_id, price, source)
     select t.id, t.price, 'gia_mau' from unnest($1::text[], $2::bigint[]) as t(id, price)
     where not exists (select 1 from price_ticks p where p.specialty_id = t.id)`,
    [ids, ids.map((id) => SPECIALTIES[id].refPrice)],
  );
  return db;
}
