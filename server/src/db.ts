import pg from 'pg';
import { readFileSync } from 'node:fs';
import { SPECIALTIES } from '../../shared/catalog.ts';

pg.types.setTypeParser(20, (v) => Number(v)); // bigint → number (tiền và mã đều nằm trong giới hạn an toàn)

export type Q = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface Db extends Q {
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDb(connectionString: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString, max: 10 });
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
  await db.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
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
