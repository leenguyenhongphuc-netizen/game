// Mua sắm quần áo, nón, phụ kiện, kiểu nhà, nội thất, đồ sân vườn, xe cá nhân. Đăng ký từ app.ts qua registerShopping.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db, Q } from './db.ts';
import { levelOf } from '../../shared/rules.ts';
import type { SightRoute } from '../../shared/rules.ts';
import { EQUIP_SLOTS, GOODS, GOODS_BY_ID, GOOD_CATEGORIES } from '../../shared/shop.ts';
import type { EquipSlot } from '../../shared/shop.ts';
import { LICENSES, PERSONAL_RIDES, licenseCovers, personalLegFare } from '../../shared/vehicles.ts';

export interface ShoppingDeps {
  db: Db;
  requireUser: (req: FastifyRequest) => Promise<number>;
  bad: (code: string, message: string, status?: number) => Error;
  addCash: (q: Q, userId: number, delta: number, reason: string) => Promise<void>;
  /** Các tỉnh người chơi đang có mặt (vùng nhà, nơi đang tham quan, nơi xe đỗ). */
  provincesOf: (q: Q, userId: number) => Promise<string[]>;
  licensesOf: (q: Q, userId: number) => Promise<string[]>;
}
type Equipped = Partial<Record<EquipSlot, string>>;

export function registerShopping(app: FastifyInstance, d: ShoppingDeps) {
  const { db, bad } = d;
  const cleanEquipped = (raw: any, owned: Set<string>): Equipped => {
    const out: Equipped = {};
    for (const slot of EQUIP_SLOTS) { const id = raw?.[slot]; if (typeof id === 'string' && owned.has(id) && GOOD_CATEGORIES[GOODS_BY_ID[id]?.category]?.slot === slot) out[slot] = id; }
    return out;
  };
  const ownedOf = async (q: Q, userId: number) => new Set<string>((await q.query('select item_id from user_goods where user_id = $1', [userId])).rows.map((r) => r.item_id as string));
  async function equippedOf(q: Q, userId: number): Promise<Equipped> {
    const raw = (await q.query('select equipped from users where id = $1', [userId])).rows[0]?.equipped;
    return raw ? cleanEquipped(raw, await ownedOf(q, userId)) : {};
  }
  /** Xe cá nhân đang dùng (nếu còn bằng lái hợp lệ). */
  async function rideOf(q: Q, userId: number): Promise<string | null> {
    const id = (await equippedOf(q, userId)).xe;
    const r = id ? PERSONAL_RIDES[id] : undefined;
    if (!r) return null;
    return !r.license || licenseCovers(await d.licensesOf(q, userId), r.license) ? r.id : null;
  }
  /** Có xe riêng thì các chặng taxi trong tuyến tới địa danh chỉ tốn tiền xăng hoặc điện (nếu xe đi nổi quãng đó). */
  function applyRide<T extends SightRoute>(route: T, rideId: string | null): T & { ride: string | null } {
    if (!rideId) return { ...route, ride: null };
    let used = false;
    const legs = route.legs.map((l) => {
      const own = l.mode === 'taxi' ? personalLegFare(rideId, l.km) : null;
      if (own === null || own >= l.fare) return l;
      used = true;
      return { ...l, fare: own, own: rideId, ownName: PERSONAL_RIDES[rideId].name };
    });
    return { ...route, legs, total: legs.reduce((s, l) => s + l.fare, 0), ride: used ? rideId : null };
  }

  app.get('/api/shopping', async (req) => {
    const userId = await d.requireUser(req);
    const here = await d.provincesOf(db, userId);
    const q = (req.query ?? {}) as Record<string, unknown>;
    const where = typeof q.where === 'string' && q.where && q.where !== 'home' ? [q.where] : here;
    const [u, owned, lic] = await Promise.all([db.query('select cash, xp, equipped from users where id = $1', [userId]), ownedOf(db, userId), d.licensesOf(db, userId)]);
    const level = levelOf(u.rows[0].xp).level, cash = Number(u.rows[0].cash);
    return {
      where, here, level, cash, categories: GOOD_CATEGORIES, equipped: cleanEquipped(u.rows[0].equipped, owned),
      items: GOODS.map((g) => {
        const has = owned.has(g.id), sold = !g.region || where.includes(g.region), present = !g.region || here.includes(g.region);
        const why = has ? 'Đã có' : !sold ? `Chỉ bán ở ${g.region}` : !present ? `Phải tới ${g.region} mới mua được` : level < (g.minLevel ?? 1) ? `Cần cấp ${g.minLevel}`
          : g.license && !licenseCovers(lic, g.license) ? `Cần bằng lái ${LICENSES[g.license].name}` : cash < g.price ? 'Chưa đủ tiền' : null;
        return { ...g, owned: has, available: sold, canBuy: !why, why, slot: GOOD_CATEGORIES[g.category].slot,
          ...(g.category === 'xe' && PERSONAL_RIDES[g.id] ? { ride: PERSONAL_RIDES[g.id] } : {}) };
      }),
    };
  });

  app.post('/api/shopping/buy', async (req) => {
    const userId = await d.requireUser(req);
    const g = GOODS_BY_ID[String(((req.body ?? {}) as any).itemId ?? '')];
    if (!g) throw bad('du_lieu_sai', 'Món hàng không tồn tại.');
    return db.tx(async (q) => {
      const u = (await q.query('select cash, xp, equipped from users where id = $1 for update', [userId])).rows[0];
      const owned = await ownedOf(q, userId);
      if (owned.has(g.id)) throw bad('da_co', 'Bạn đã có món này rồi.', 409);
      if (g.region && !(await d.provincesOf(q, userId)).includes(g.region)) throw bad('khac_tinh', `${g.name} chỉ bán ở ${g.region}. Hãy tới đó rồi mua.`, 409);
      if (levelOf(u.xp).level < (g.minLevel ?? 1)) throw bad('chua_du_cap', `Cần đạt cấp ${g.minLevel} mới mua được ${g.name}.`, 409);
      if (g.license && !licenseCovers(await d.licensesOf(q, userId), g.license)) throw bad('thieu_bang_lai', `${g.name} cần bằng lái ${LICENSES[g.license].name}.`, 409);
      if (Number(u.cash) < g.price) throw bad('khong_du_tien', 'Bạn không đủ tiền.', 409);
      await d.addCash(q, userId, -g.price, `mua_sam:${g.id}`);
      await q.query('insert into user_goods (user_id, item_id) values ($1,$2)', [userId, g.id]);
      owned.add(g.id);
      const equipped = cleanEquipped(u.equipped, owned), slot = GOOD_CATEGORIES[g.category].slot as EquipSlot | null;
      // món đầu tiên của một ô thì dùng luôn
      if (slot && !equipped[slot]) { equipped[slot] = g.id; await q.query('update users set equipped = $2 where id = $1', [userId, JSON.stringify(equipped)]); }
      return { ok: true, itemId: g.id, price: g.price, cash: Number(u.cash) - g.price, equipped };
    });
  });

  /** Mặc, đội, mang, dựng nhà, chọn xe: mỗi ô một món; itemId null là cất đi. */
  app.post('/api/shopping/equip', async (req) => {
    const userId = await d.requireUser(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const slot = String(b.slot ?? '') as EquipSlot;
    if (!EQUIP_SLOTS.includes(slot)) throw bad('du_lieu_sai', 'Ô trang bị không hợp lệ.');
    return db.tx(async (q) => {
      const u = (await q.query('select equipped from users where id = $1 for update', [userId])).rows[0];
      const owned = await ownedOf(q, userId), equipped = cleanEquipped(u.equipped, owned);
      if (b.itemId === null || b.itemId === undefined) delete equipped[slot];
      else {
        const g = GOODS_BY_ID[String(b.itemId)];
        if (!g || GOOD_CATEGORIES[g.category].slot !== slot) throw bad('du_lieu_sai', 'Món này không dùng cho ô đó.');
        if (!owned.has(g.id)) throw bad('chua_co', 'Bạn chưa mua món này.', 409);
        equipped[slot] = g.id;
      }
      await q.query('update users set equipped = $2 where id = $1', [userId, JSON.stringify(equipped)]);
      return { ok: true, equipped };
    });
  });

  return { equippedOf, rideOf, applyRide };
}
export type ShoppingApi = ReturnType<typeof registerShopping>;
