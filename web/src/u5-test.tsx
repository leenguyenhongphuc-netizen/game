// Trang thử: /u5-test.html?xem=baixe|bang|thi|muasam|dulich[&loai=ao|non|phu_kien|nha|noi_that|san_vuon|xe][&xe=tai_990_dien][&vai=nong_dan] — API giả, dữ liệu thật từ shared.
import { createRoot } from 'react-dom/client';
import './styles.css';
import { LICENSES, LICENSE_ORDER, POWER_NAMES, TOLL_GROUP_NAMES, VEHICLES, VEHICLE_MAX_OWNED, VEHICLE_RESALE, licenseCovers, parkPrice, rangeKm, roadPrice, unitOf } from '../../shared/vehicles.ts';
import { GOODS, GOOD_CATEGORIES } from '../../shared/shop.ts';
import { PERSONAL_RIDES } from '../../shared/vehicles.ts';
import type { Me } from './api.ts';
import { TravelPanel } from './panels.tsx';
import { ShoppingPanel } from './shopping.tsx';
import { GaragePanel } from './vehicles.tsx';

const q = new URLSearchParams(location.search);
const view = q.get('xem') ?? 'baixe', activeKind = q.get('xe') ?? 'tai_990', role = q.get('vai') ?? 'thuong_lai';
const level = 4, cash = 62_000_000, lic = ['B'];
const own = [{ id: 1, kind: activeKind, energy: VEHICLES[activeKind].tank * 0.6, odo: 1840 }, { id: 2, kind: 'ba_gac', energy: 9, odo: 320 }, { id: 3, kind: 'ban_tai_dien', energy: 55, odo: 60 }];
const owned = new Set(['ao_thun', 'ao_ba_ba', 'mu_bao_hiem', 'ba_lo', 'xe_may', 'vong', 'cay_rom']);
const equipped: Record<string, string | null> = { ao: 'ao_ba_ba', non: 'mu_bao_hiem', phu_kien: 'ba_lo', nha: null, xe: 'xe_may' };
const here = ['Đồng Tháp'];
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, path = url.replace(location.origin, ''), method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (path.startsWith('/api/vehicles') && method === 'GET') return json({
    level, cash, atHome: true, active: 1, maxOwned: VEHICLE_MAX_OWNED, resale: VEHICLE_RESALE,
    catalog: Object.values(VEHICLES).map((v) => {
      const why = level < v.minLevel ? `Cần cấp ${v.minLevel}` : !licenseCovers(lic, v.license) ? `Cần bằng lái ${LICENSES[v.license].name}` : cash < v.price ? 'Chưa đủ tiền' : null;
      return { ...v, unit: unitOf(v.power), powerName: POWER_NAMES[v.power], rangeKm: rangeKm(v), roadPrice: roadPrice(v.power), parkPrice: parkPrice(v.power), tollGroupName: TOLL_GROUP_NAMES[v.tollGroup], licenseName: LICENSES[v.license].name, owned: own.filter((o) => o.kind === v.kind).length, canBuy: !why, why };
    }),
    owned: own.map((o) => { const s = VEHICLES[o.kind]; return { id: o.id, kind: s.kind, name: s.name, emoji: s.emoji, power: s.power, unit: unitOf(s.power), tank: s.tank, cargoKg: s.cargoKg, energy: o.energy, odoKm: o.odo, regionId: 'dt_caibe', active: o.id === 1, resaleValue: Math.round(s.price * VEHICLE_RESALE) }; }),
    licenses: LICENSE_ORDER.map((cls) => { const info = LICENSES[cls], has = lic.includes(cls), covered = licenseCovers(lic, cls); const why = has ? 'Đã có' : level < info.minLevel ? `Cần cấp ${info.minLevel}` : cash < info.price ? 'Chưa đủ tiền' : null; return { cls, ...info, owned: has, covered, canBuy: !why, why }; }),
  });
  if (path === '/api/licenses/buy') { lic.push(body.cls); return json({ ok: true }); }
  if (path === '/api/vehicles/buy') { own.push({ id: own.length + 1, kind: body.kind, energy: VEHICLES[body.kind].tank / 2, odo: 0 }); return json({ ok: true }); }
  if (/\/api\/vehicles\/\d+\/(activate|sell)/.test(path)) return json({ ok: true });
  if (path.startsWith('/api/shopping') && method === 'GET') return json({
    where: here, here, level, cash, categories: GOOD_CATEGORIES, equipped,
    items: GOODS.map((g) => {
      const has = owned.has(g.id), sold = !g.region || here.includes(g.region);
      const why = has ? 'Đã có' : !sold ? `Chỉ bán ở ${g.region}` : level < (g.minLevel ?? 1) ? `Cần cấp ${g.minLevel}` : g.license && !licenseCovers([...lic, 'A1'], g.license) ? `Cần bằng lái ${LICENSES[g.license].name}` : cash < g.price ? 'Chưa đủ tiền' : null;
      return { ...g, owned: has, available: sold, canBuy: !why, why, slot: GOOD_CATEGORIES[g.category].slot, ...(g.category === 'xe' && PERSONAL_RIDES[g.id] ? { ride: PERSONAL_RIDES[g.id] } : {}) };
    }),
  });
  if (path === '/api/shopping/buy') { owned.add(body.itemId); return json({ ok: true }); }
  if (path === '/api/shopping/equip') { equipped[body.slot] = body.itemId; return json({ ok: true, equipped }); }
  if (path === '/api/travel') return json({ visited: ['dt_caibe', 'ld_dalat'] });
  return realFetch(input, init);
};

const av = VEHICLES[activeKind];
const me = {
  user: { id: 1, username: 'thu', displayName: 'Người thử', cash, homeRegionId: 'dt_caibe', role, truckRegionId: 'dt_caibe', fuelL: av.tank * 0.6, etc: 500_000, avatar: { shirt: '#5aa9e6', hat: 'non_la', truck: '#f08a6c' }, level,
    vehicle: view === 'dulich' && q.get('koxe') === '1' ? null : { id: 1, kind: av.kind, name: av.name, emoji: av.emoji, cargoKg: av.cargoKg, power: av.power, unit: unitOf(av.power), tank: av.tank, per100: av.per100, maxKmh: av.maxKmh, cold: !!av.cold } },
  plots: [{ id: 1, regionId: 'dt_caibe', isHome: true }], inventory: [], products: [],
} as unknown as Me;

function Page() {
  const frame = (title: string, el: React.ReactNode) => (
    <div style={{ minHeight: '100%', background: '#8fc46a', padding: 10 }}>
      <div className="modal" style={{ position: 'static', width: 'min(560px, 100%)', margin: '0 auto', maxHeight: 'none' }}>
        <div className="modal-head"><h2>{title}</h2></div>
        <div className="modal-body" style={{ overflow: 'visible' }}>{el}</div>
      </div>
    </div>);
  if (view === 'muasam') return frame('Trung tâm mua sắm', <ShoppingPanel me={me} refresh={() => undefined} />);
  if (view === 'dulich') return frame('Du lịch và sổ tem', <TravelPanel me={me} touring={null} startRide={async () => undefined} startTrip={q.get('nostart') === '1' ? undefined : async () => undefined} openGarage={() => alert('Mở bãi xe')} />);
  return frame('Bãi xe & đại lý', <GaragePanel me={me} refresh={() => undefined} />);
}
createRoot(document.getElementById('root')!).render(<Page />);
