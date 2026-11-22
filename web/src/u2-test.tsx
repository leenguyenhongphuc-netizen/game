// Trang thử: /u2-test.html?xem=xuong|xuongkhach|xuatkhau|sieuthi|tinh|thamquan[&tinh=Quảng Ngãi][&trong=1] — API giả, dữ liệu và báo giá thật từ shared.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { CROPS, REGIONS, SPECIALTIES, recipeOf } from '../../shared/catalog.ts';
import { EXPORT_MARKETS, EXPORT_MODES, MACHINES, exportQuote, haversineKm, machineStats, machineUpgradeCost, machinesForRecipe } from '../../shared/rules.ts';
import type { ExportMarket, MachineKind } from '../../shared/rules.ts';
import { SIGHT_PROVINCES, sightsOfProvince } from '../../shared/sights.ts';
import type { Me } from './api.ts';
import { ProvinceMap } from './map/ProvinceMap.tsx';
import { SightsPanel, SupermarketPanel } from './sights.tsx';
import { ExportPanel } from './trade.tsx';
import { WorkshopPanel } from './workshop.tsx';

const q = new URLSearchParams(location.search);
const view = q.get('xem') ?? 'xuong', province = q.get('tinh') ?? 'Đà Nẵng', empty = q.get('trong') === '1';
const cur = province === 'Quảng Ngãi' ? 'qng_trabong' : 'dn_tienphuoc', here = REGIONS[cur];
const now = Date.now(), H = 3_600_000;
const rid = (sp: string) => recipeOf(CROPS[SPECIALTIES[sp].crop]).id;
const pname = (sp: string) => `${SPECIALTIES[sp].name} (${recipeOf(CROPS[SPECIALTIES[sp].crop]).name.toLowerCase()})`;
const pref = (sp: string) => Math.round((SPECIALTIES[sp].refPrice * recipeOf(CROPS[SPECIALTIES[sp].crop]).value) / 100) * 100;
const recipes = [...new Map(Object.values(SPECIALTIES).map((s) => { const r = recipeOf(CROPS[s.crop]); return [r.id, { ...r, machines: machinesForRecipe(r.id) }] as const; })).values()];
const machine = (id: number, kind: MachineKind, level: number, jobs: unknown[]) => { const st = machineStats(kind, level), i = MACHINES[kind]; return { id, kind, name: i.name, emoji: i.emoji, level, slots: st.slots, time: st.time, recipes: i.recipes, support: i.slots === 0, bonus: i.bonus ?? null, upgradeCost: level < 3 ? machineUpgradeCost(kind, level) : null, jobs }; };
const job = (id: number, machineId: number, sp: string, kgIn: number, inMs: number) => ({ id, machineId, specialtyId: sp, recipeId: rid(sp), kgIn, kgOut: Math.floor(kgIn * recipeOf(CROPS[SPECIALTIES[sp].crop]).ratio), readyAt: now + inMs });
const machines = empty ? [machine(1, 'may_say', 1, [])] : [
  machine(1, 'may_say', 2, [job(11, 1, 'xoai_hoa_loc', 120, 1.4 * H), job(12, 1, 'sau_rieng_ngu_hiep', 80, -1000)]),
  machine(2, 'may_rang_xay', 1, [job(13, 2, 'ca_phe_cau_dat', 200, 0.6 * H)]),
  machine(3, 'may_dong_goi', 1, []),
];
const inv: [string, 'A' | 'B' | 'C', number][] = empty ? [] : [['xoai_hoa_loc', 'A', 300], ['sau_rieng_ngu_hiep', 'B', 55], ['ca_phe_cau_dat', 'A', 240], ['chanh_day_gia_lai', 'A', 90], ['toi_ly_son', 'A', 40]];
const made: [string, number][] = empty ? [] : [['xoai_hoa_loc', 42], ['tieu_chu_se', 140]];
const workshop = (isWorkshop: boolean) => ({
  slots: isWorkshop ? machines.reduce((n, m) => n + m.slots, 0) : 0, jobs: isWorkshop ? machines.flatMap((m) => m.jobs) : [], isWorkshop,
  products: made.map(([specialtyId, kg]) => ({ specialtyId, kg })), productInfo: made.map(([specialtyId, kg]) => ({ specialtyId, kg, name: pname(specialtyId), recipeId: rid(specialtyId), refPrice: pref(specialtyId) })),
  machines: isWorkshop ? machines : [],
  catalog: (Object.keys(MACHINES) as MachineKind[]).map((kind) => { const owned = machines.filter((m) => m.kind === kind).length; return { kind, ...MACHINES[kind], owned, canBuy: isWorkshop && owned < (MACHINES[kind].slots ? 2 : 1) }; }),
  recipes,
  stock: inv.map(([specialtyId, quality, kg]) => { const kinds = machinesForRecipe(rid(specialtyId)); return { specialtyId, quality, kg, recipeId: rid(specialtyId), machineKinds: kinds, canProcess: isWorkshop && machines.some((m) => kinds.includes(m.kind)) }; }),
  bonus: { yield: 0, value: empty ? 0 : 0.08, grade: 0 }, runFeePerKg: 200, energyCost: 4, maxMachines: 8, maxPerKind: 2, maxLevel: 3,
});
const quotes = (sp: string, ql: 'A' | 'B' | 'C', have: number, processed: boolean) => (Object.keys(EXPORT_MARKETS) as ExportMarket[]).flatMap((market) => EXPORT_MARKETS[market].modes.map((mode) => exportQuote(sp, ql, Math.min(have, EXPORT_MODES[mode].maxKg), mode, market, 'dt_caibe', undefined, { processed, discount: 0.15, valueBonus: processed ? 0.08 : 0 })));
const shelf = (id: number | string, specialtyId: string, quality: string, kg: number, mult: number, seller: string, o: { mine?: boolean; npc?: boolean; processed?: boolean } = {}) => {
  const ref = o.processed ? pref(specialtyId) : SPECIALTIES[specialtyId].refPrice;
  return { id, specialtyId, quality, kg, price: Math.round((ref * mult) / 100) * 100, refPrice: ref, seller, mine: !!o.mine, npc: !!o.npc, processed: !!o.processed, name: o.processed ? pname(specialtyId) : SPECIALTIES[specialtyId].name };
};
const range = (ref: number) => ({ refPrice: ref, minPrice: ref, maxPrice: Math.round((ref * 1.6) / 100) * 100 });

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString(), get = !init?.method || init.method === 'GET';
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  if (url.startsWith('/api/workshop') && get) return json(workshop(view !== 'xuongkhach'));
  if (url.startsWith('/api/workshop')) return json({ error: 'het_suc', message: 'Bạn đã hết thể lực để đứng máy. Hãy ăn uống hoặc nghỉ một lúc rồi làm tiếp.' }, 409);
  if (url.startsWith('/api/export/options')) return json({
    allowedModes: Object.keys(EXPORT_MODES), role: 'thuong_lai', inCoop: false, active: empty ? 0 : 2, maxActive: 6, level: 3, discount: 0.15,
    stock: inv.map(([specialtyId, quality, kg]) => ({ specialtyId, quality, kg, refPrice: SPECIALTIES[specialtyId].refPrice, quotes: quotes(specialtyId, quality, kg, false) })),
    products: made.map(([specialtyId, kg]) => ({ specialtyId, quality: 'A', kg, processed: true, name: pname(specialtyId), refPrice: pref(specialtyId), quotes: quotes(specialtyId, 'A', kg, true) })),
  });
  if (url.startsWith('/api/export/shipments')) return json({ shipments: empty ? [] : [
    { id: 1, specialtyId: 'tieu_chu_se', quality: 'A', kg: 500, arriveKg: 499, mode: 'tau_lon', market: 'nga', gatewayName: 'Cảng Cái Mép', freight: 1_900_000, payout: 98_000_000, createdAt: now - 6 * 60000, arrivesAt: now + 9 * 60000, paidAt: null, status: 'dang_di', processed: true, name: pname('tieu_chu_se') },
    { id: 2, specialtyId: 'xoai_hoa_loc', quality: 'A', kg: 100, arriveKg: 97, mode: 'xe_tai', market: 'trung_quoc', gatewayName: 'Cửa khẩu Móng Cái', freight: 600_000, payout: 7_700_000, createdAt: now - 3 * 60000, arrivesAt: now + 2 * 60000, paidAt: null, status: 'dang_di', processed: false },
    { id: 3, specialtyId: 'sau_rieng_ngu_hiep', quality: 'A', kg: 200, arriveKg: 198, mode: 'hang_khong', market: 'nhat_han', gatewayName: 'Sân bay Tân Sơn Nhất', freight: 3_000_000, payout: 25_300_000, createdAt: now - 60 * 60000, arrivesAt: now - 30 * 60000, paidAt: now - 30 * 60000, status: 'da_toi', processed: false },
  ] });
  if (url.startsWith('/api/supermarket') && get) return json({
    province, here: true, earned: empty ? 0 : 486000, feeRatio: 0.05, boughtTodayKg: empty ? 30 : 12, dailyKg: 30, lots: empty ? 0 : 2, maxLots: 6, minKg: 5, maxLotKg: 300,
    shelves: q.get('ke') === 'trong' ? [] : [shelf(1, 'sau_rieng_ngu_hiep', 'A', 120, 1.25, 'Thương lái Ba Tèo'), shelf(5, 'xoai_hoa_loc', 'A', 60, 1.3, 'Xưởng Chín Mọng', { processed: true }), shelf(2, 'xoai_hoa_loc', 'A', 46, 1.1, 'Vườn Cô Út'), shelf(3, 'xoai_hoa_loc', 'B', 30, 1.05, 'Tài khoản test', { mine: true }), shelf('npc:toi_ly_son', 'toi_ly_son', 'A', 20, 1.5, 'Tiệm Ba Miền', { npc: true })],
    mine: empty ? [] : [shelf(3, 'xoai_hoa_loc', 'B', 30, 1.05, 'Tài khoản test', { mine: true }), shelf(6, 'tieu_chu_se', 'A', 40, 1.2, 'Tài khoản test', { mine: true, processed: true })],
    consignable: [...inv.map(([specialtyId, quality, kg]) => ({ specialtyId, quality, kg, ...range(SPECIALTIES[specialtyId].refPrice), processed: false, name: SPECIALTIES[specialtyId].name })), ...made.map(([specialtyId, kg]) => ({ specialtyId, quality: 'A', kg, ...range(pref(specialtyId)), processed: true, name: pname(specialtyId) }))],
  });
  if (url.startsWith('/api/supermarket')) return json({ ok: true });
  if (url.startsWith('/api/sights/')) return json({ ok: true, km: 42, taxiFare: 120000, entryFee: 12000, seconds: 12 });
  if (url.startsWith('/api/sights')) {
    const p = new URL(url, location.origin).searchParams.get('province') ?? province;
    return json({ province: p, regionId: cur, here: p === province, others: SIGHT_PROVINCES.map((x) => ({ province: x, count: sightsOfProvince(x).length })), sights: sightsOfProvince(p).map((s, i) => { const km = Math.max(3, Math.round(haversineKm(here.lat, here.lng, s.lat, s.lng) * 1.3)); return { ...s, km, taxiFare: 15000 + km * 2500, visits: i === 0 ? 1 : 0, done: i === 0, stopsSeen: i === 0 ? s.stops.map((x) => x.id) : [] }; }) });
  }
  return realFetch(input, init);
};

const me = { user: { id: 1, username: 'test', displayName: 'Tài khoản test', cash: 52_744_000, homeRegionId: 'dt_caibe', role: view === 'xuongkhach' ? 'nong_dan' : 'xuong' }, plots: [], inventory: [], config: { timeScale: 60, now } } as unknown as Me;
const TITLES: Record<string, string> = { xuong: 'Kho, đơn hàng, xưởng', xuongkhach: 'Kho, đơn hàng, xưởng', xuatkhau: 'Kho, đơn hàng, xưởng', sieuthi: 'Du lịch và sổ tem', tinh: 'Du lịch và sổ tem', thamquan: 'Du lịch và sổ tem' };

function Test() {
  const [sight, setSight] = useState<string | null>(q.get('chon'));
  const [log, setLog] = useState('');
  return (
    <div className="game" style={{ position: 'fixed', inset: 0, background: '#5d9a43' }}>
      <section className="modal panel" style={{ top: 10, bottom: 10 }}>
        <header className="modal-head"><h2>{TITLES[view] ?? view}</h2></header>
        <div className="modal-body">
          {(view === 'xuong' || view === 'xuongkhach') && <WorkshopPanel me={me} priceOf={(id) => SPECIALTIES[id].refPrice} onChanged={() => {}} onOpen={(w) => setLog(`Mở: ${w}`)} />}
          {view === 'xuatkhau' && <ExportPanel me={me} refresh={() => {}} onSent={(s) => setLog(`Gửi ${s.kg} kg ${s.mode} → ${s.market}`)} />}
          {view === 'sieuthi' && <SupermarketPanel me={me} province={province} refresh={() => {}} />}
          {view === 'tinh' && <ProvinceMap province={province} sights={sightsOfProvince(province).map((s, i) => ({ ...s, done: i === 0 }))} regions={Object.values(REGIONS)} currentRegionId={cur} selectedId={sight} onSelect={setSight} />}
          {view === 'thamquan' && <SightsPanel me={me} refresh={() => {}} onGo={(t) => setLog(`Đi ${t.sight.name}`)} />}
          <p id="log">{log}</p>
        </div>
      </section>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
