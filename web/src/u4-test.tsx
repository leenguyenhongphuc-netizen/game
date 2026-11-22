// Trang thử: /u4-test.html?xem=tientrinh|dat|dunghop|xuong|nhap[&vai=xuong|nong_dan][&tab=san_pham|may] — API giả, dữ liệu thật từ shared.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { CROPS, SPECIALTIES, recipeOf } from '../../shared/catalog.ts';
import { ACHIEVEMENTS, GIFT_BOXES, IMPORT_MACHINES, IMPORT_STAGE_NAMES, LAND_UPGRADES, LAND_UPGRADE_LEVELS, LAND_UPGRADE_MAX, LEVEL_UNLOCKS, MACHINE_MERGE, SEED_FUSIONS, SEED_TRAITS, XP_RULES, boostCost, dailyQuestsFor, fusionRate, importCost, landUpgradeCost } from '../../shared/progress.ts';
import { MACHINES, levelOf, machineStats, machineUpgradeCost, machinesForRecipe } from '../../shared/rules.ts';
import type { MachineKind } from '../../shared/rules.ts';
import type { Me } from './api.ts';
import { ImportRide } from './drive/ImportRide.tsx';
import { FusionPanel } from './fusion.tsx';
import { ProgressPanel } from './progress.tsx';
import { LandUpgrades } from './upgrades.tsx';
import { WorkshopPanel } from './workshop.tsx';
import type { ImportOrder } from './workshop.tsx';

const q = new URLSearchParams(location.search), xem = q.get('xem') ?? 'tientrinh', role = q.get('vai') ?? (xem === 'xuong' ? 'xuong' : 'nong_dan');
const now = Date.now(), M = 60_000, H = 3_600_000;
let xp = 2780, cash = 48_650_000;
const lv = () => levelOf(xp);
const me = () => ({ user: { id: 7, username: 'test', displayName: 'Nguyễn Thị Hồng Phúc', cash, homeRegionId: 'dt_caibe', role, ...lv() }, plots: [{ id: 12, regionId: 'dt_caibe', isHome: true }], inventory: [], config: { timeScale: 60, now } }) as unknown as Me;

// ---- tiến trình
const claimedLv = new Set([2, 3, 4]), claimedQ = new Set<string>(['thu_hoach_10']);
const dailyProg: Record<number, number> = { 0: 8, 1: 2, 2: 0 };
const achProg = (i: number, goal: number) => (i % 5 === 0 ? goal : i % 3 === 0 ? Math.round(goal * 0.7) : Math.round(goal * 0.2));
const progress = () => {
  const l = lv();
  return {
    ...l, maxLevel: 30, perks: {}, levels: LEVEL_UNLOCKS, unlocks: LEVEL_UNLOCKS.filter((x) => x.level <= l.level), nextUnlocks: LEVEL_UNLOCKS.filter((x) => x.level > l.level).slice(0, 3),
    levelRewards: LEVEL_UNLOCKS.filter((x) => x.level > 1 && x.level <= l.level).map((x) => ({ level: x.level, reward: x.reward, claimed: claimedLv.has(x.level) })),
    daily: dailyQuestsFor(7, 20000, role as never).map((d, i) => ({ id: d.id, text: d.text, progress: Math.min(d.goal, dailyProg[i] ?? 0), goal: d.goal, reward: { xp: d.xp, cash: d.cash }, done: (dailyProg[i] ?? 0) >= d.goal, claimed: claimedQ.has(d.id) })),
    dailyResetsAt: now + 7.4 * H,
    achievements: ACHIEVEMENTS.map((a, i) => { const p = achProg(i, a.goal); return { id: a.id, text: a.text, progress: p, goal: a.goal, reward: { xp: a.xp, cash: a.cash }, done: p >= a.goal, claimed: claimedQ.has(a.id) }; }),
    xpLog: [['thu_hoach', 5], ['cham', 1], ['giao_don', 30], ['tham_quan', 60], ['thu_hoach', 5], ['xuat_gui', 22]].map(([s, x], i) => ({ at: now - i * 7 * M, source: s, label: (XP_RULES as Record<string, { label: string }>)[s as string]?.label ?? String(s), xp: x })),
    xpRules: (Object.keys(XP_RULES) as (keyof typeof XP_RULES)[]).map((s, i) => ({ source: s, ...XP_RULES[s], todayXp: i % 4 === 0 ? XP_RULES[s].xp * 3 : 0 })),
  };
};

// ---- nâng cấp đất
const ups: Record<string, number> = { cai_tao: 2, tuoi: 1, nha_mang: 0, cam_bien: 5 };
const upgrades = () => ({ plotId: 12, factory: false, level: lv().level, cash, upgrades: (Object.keys(LAND_UPGRADES) as (keyof typeof LAND_UPGRADES)[]).map((kind) => {
  const level = ups[kind] ?? 0, max = level >= LAND_UPGRADE_MAX, need = max ? null : LAND_UPGRADE_LEVELS[level], cost = max ? null : landUpgradeCost(kind, level + 1);
  return { kind, ...LAND_UPGRADES[kind], level, maxLevel: LAND_UPGRADE_MAX, nextCost: cost, needLevel: need, canUpgrade: !max && lv().level >= (need ?? 0) && cash >= (cost ?? 0) };
}) });

// ---- dung hợp
const seeds = [{ specialtyId: 'xoai_hoa_loc', trait: 'chin_som', qty: 6 }];
const boxes = [{ boxId: GIFT_BOXES[0].id, qty: 24, value: 186_000 }];
const hist: { recipeId: string; success: boolean; at: number }[] = [{ recipeId: SEED_FUSIONS[0].id, success: true, at: now - 2 * H }, { recipeId: GIFT_BOXES[0].id, success: false, at: now - 5 * H }];
const fusion = () => {
  const l = lv().level, lock = (min: number) => (l < min ? `Cần đạt cấp ${min}.` : null), rl = (r: string, n: string) => (role !== r ? `Chỉ ${n} làm được.` : null);
  const pairs = [['xoai_hoa_loc', 'xoai_cat_chu'], ['sau_rieng_ngu_hiep', 'sau_rieng_ri6'], ['buoi_nam_roi', 'buoi_da_xanh']].filter((p) => SPECIALTIES[p[0]] && SPECIALTIES[p[1]]);
  const usable = pairs.length ? pairs : [Object.keys(SPECIALTIES).slice(0, 2)];
  const prods = ['xoai_hoa_loc', 'tieu_chu_se', 'ca_phe_cau_dat', 'chanh_day_gia_lai'].filter((s) => SPECIALTIES[s]);
  return {
    level: l, role, cash,
    recipes: [
      ...SEED_FUSIONS.map((f) => ({ id: f.id, kind: 'giong', name: `Lai tạo ${SEED_TRAITS[f.trait].name.toLowerCase()}`, emoji: SEED_TRAITS[f.trait].emoji, note: SEED_TRAITS[f.trait].effect,
        inputs: [{ type: 'nong_san', count: 2, kgEach: f.kgEach, quality: 'A', rule: 'Hai đặc sản khác nhau, cùng loại cây hoặc cùng nhóm cây, hàng Loại 1' }], extras: { cost: f.cost, boostCost: boostCost(f.cost) },
        successRate: fusionRate(f.successRate, l, false), boostedRate: fusionRate(f.successRate, l, true), keepOnFail: 0.5,
        result: { type: 'giong', trait: f.trait, name: SEED_TRAITS[f.trait].name, packets: f.packets, note: `${f.packets} gói giống của đặc sản thứ nhất, mỗi gói trồng một ô không tốn tiền giống.` },
        minLevel: f.minLevel, have: true, options: usable, whyNot: lock(f.minLevel) ?? (role === 'xuong' ? 'Chủ xưởng không trồng trọt.' : null) })),
      ...GIFT_BOXES.map((b) => ({ id: b.id, kind: 'san_pham', name: `Phối ${b.name.toLowerCase()}`, emoji: b.emoji, note: b.note,
        inputs: [{ type: 'thanh_pham', count: b.kinds, kgEach: b.kgEach, rule: `${b.kinds} loại thành phẩm khác nhau` }], extras: { cost: b.packCost, boostCost: boostCost(b.packCost) },
        successRate: fusionRate(b.successRate, l, false), boostedRate: fusionRate(b.successRate, l, true), keepOnFail: 0.5,
        result: { type: 'hop_qua', boxId: b.id, name: b.name, boxes: b.boxes, valueMult: b.valueMult, note: `${b.boxes} hộp, tổng giá trị bằng ${Math.round(b.valueMult * 100)}% giá các thành phẩm bỏ vào.` },
        minLevel: b.minLevel, have: true, options: prods, whyNot: lock(b.minLevel) ?? rl('xuong', 'chủ xưởng') })),
      { id: MACHINE_MERGE.id, kind: 'may', name: 'Ghép hai máy cùng loại', emoji: '🛠️', note: 'Tháo hai máy cùng loại, cùng cấp (đang không chạy mẻ nào) để ráp thành một máy cấp cao hơn. Rẻ hơn nâng cấp nhưng mất một máy; thất bại thì giữ nguyên cả hai máy, chỉ mất tiền linh kiện.',
        inputs: [{ type: 'may', count: 2, rule: 'Hai máy chế biến cùng loại, cùng cấp, cùng xuất xứ, đang rảnh' }], extras: { cost: null, costRule: 'Linh kiện bằng 25% giá nâng cấp máy đó', boostCost: null },
        successRate: fusionRate(MACHINE_MERGE.successRate, l, false), boostedRate: fusionRate(MACHINE_MERGE.successRate, l, true), keepOnFail: 1,
        result: { type: 'may', note: 'Một máy cùng loại cao hơn một cấp, trả lại một chỗ đặt máy.' }, minLevel: MACHINE_MERGE.minLevel, have: true, options: [[4, 5]], whyNot: lock(MACHINE_MERGE.minLevel) ?? rl('xuong', 'chủ xưởng') },
    ],
    seeds: seeds.map((s) => ({ ...s, name: `${SPECIALTIES[s.specialtyId]?.name} · ${SEED_TRAITS[s.trait as keyof typeof SEED_TRAITS].name.toLowerCase()}`, effect: SEED_TRAITS[s.trait as keyof typeof SEED_TRAITS].effect })),
    boxes: boxes.map((b) => { const g = GIFT_BOXES.find((x) => x.id === b.boxId)!; return { boxId: b.boxId, name: g.name, emoji: g.emoji, qty: b.qty, value: b.value, exportValue: Math.round(b.value * 1.25) }; }),
    boxExport: { bonus: 0.25, minBoxes: 20, minLevel: 6 }, history: hist,
    rule: 'Tỉ lệ thành công ghi rõ ở từng công thức: mỗi cấp nhân vật thêm 1,5 điểm phần trăm, vật tư tăng cường thêm 15 điểm, tối đa 95%. Thất bại được trả lại một nửa nguyên liệu.',
  };
};
let fuseN = 0;

// ---- xưởng + máy nhập khẩu
const rid = (sp: string) => recipeOf(CROPS[SPECIALTIES[sp].crop]).id;
const recipes = [...new Map(Object.values(SPECIALTIES).map((s) => { const r = recipeOf(CROPS[s.crop]); return [r.id, { ...r, machines: machinesForRecipe(r.id) }] as const; })).values()];
const machine = (id: number, kind: MachineKind, level: number) => { const st = machineStats(kind, level), i = MACHINES[kind]; return { id, kind, name: i.name, emoji: i.emoji, level, slots: st.slots, time: st.time, recipes: i.recipes, support: i.slots === 0, bonus: i.bonus ?? null, upgradeCost: level < 3 ? machineUpgradeCost(kind, level) : null, jobs: [] }; };
const machines = [machine(1, 'may_say', 2), machine(2, 'may_rang_xay', 1)];
const workshop = () => ({ slots: 5, jobs: [], isWorkshop: role === 'xuong', products: [{ specialtyId: 'xoai_hoa_loc', kg: 42 }], productInfo: [{ specialtyId: 'xoai_hoa_loc', kg: 42, name: 'Xoài cát Hòa Lộc (sấy dẻo)', recipeId: rid('xoai_hoa_loc'), refPrice: 243_000 }],
  machines, catalog: (Object.keys(MACHINES) as MachineKind[]).map((kind) => ({ kind, ...MACHINES[kind], owned: machines.filter((m) => m.kind === kind).length, canBuy: true })), recipes,
  stock: [{ specialtyId: 'xoai_hoa_loc', quality: 'A', kg: 300, recipeId: rid('xoai_hoa_loc'), machineKinds: machinesForRecipe(rid('xoai_hoa_loc')), canProcess: true }],
  bonus: { yield: 0, value: 0, grade: 0 }, runFeePerKg: 200, energyCost: 4, maxMachines: 8, maxPerKind: 2, maxLevel: 3 });
const legsOf = (m: (typeof IMPORT_MACHINES)[number], t0: number) => [{ stage: 'tau_bien', name: IMPORT_STAGE_NAMES.tau_bien, etaAt: t0 + m.seaMinutes * 1000 }, { stage: 'thong_quan', name: IMPORT_STAGE_NAMES.thong_quan, etaAt: t0 + (m.seaMinutes + 8) * 1000 }, { stage: 'xe_ve_xuong', name: IMPORT_STAGE_NAMES.xe_ve_xuong, etaAt: t0 + (m.seaMinutes + 14) * 1000 }];
const mkOrder = (id: number, m: (typeof IMPORT_MACHINES)[number], t0: number, arrived: boolean): ImportOrder => { const legs = legsOf(m, t0); return { id, importId: m.id, kind: m.kind as MachineKind, name: m.name, origin: m.origin, flag: m.flag, port: m.port, orderedAt: t0, legs, stage: arrived ? 'da_toi' : 'tau_bien', arrived, arriveAt: legs[2].etaAt, total: importCost(m).total }; };
const orders: ImportOrder[] = IMPORT_MACHINES.length > 1 ? [mkOrder(1, IMPORT_MACHINES[1], now - 22_000, false), mkOrder(2, IMPORT_MACHINES[0], now - 90_000, true)] : [];
const imports = () => ({ isWorkshop: role === 'xuong', level: lv().level, cash, maxPending: 2, now: Date.now(),
  note: 'Máy ngoại nhanh hơn và ít hao hơn máy trong nước, nhưng phải chờ tàu chở về, nộp thuế nhập khẩu và thuế giá trị gia tăng.',
  catalog: IMPORT_MACHINES.map((m) => { const cost = importCost(m), base = MACHINES[m.kind as MachineKind]; return { ...m, emoji: base.emoji, baseName: base.name, recipes: base.recipes, cost, minutes: m.seaMinutes + 14, canOrder: lv().level >= m.minLevel && cash >= cost.total, whyNot: lv().level < m.minLevel ? `Cần đạt cấp ${m.minLevel}.` : cash < cost.total ? 'Chưa đủ tiền.' : null }; }),
  orders: orders.map((o) => ({ ...o, arrived: o.arrived || o.arriveAt <= Date.now() })) });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString(), get = !init?.method || init.method === 'GET', body = init?.body ? JSON.parse(String(init.body)) : {};
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  if (url === '/api/progress') return json(progress());
  let m = /^\/api\/progress\/levels\/(\d+)\/claim/.exec(url); if (m) { claimedLv.add(Number(m[1])); cash += 100_000; return json({ ok: true }); }
  m = /^\/api\/progress\/(daily|achievements)\/([^/]+)\/claim/.exec(url); if (m) { claimedQ.add(m[2]); cash += 20_000; xp += 30; return json({ ok: true }); }
  if (url.endsWith('/upgrades')) return json(upgrades());
  if (url.endsWith('/upgrade') && url.includes('/plots/')) { const k = body.kind as string; ups[k] = (ups[k] ?? 0) + 1; cash -= landUpgradeCost(k as never, ups[k]); return json({ ok: true, kind: k, level: ups[k], cost: 0, cash, playerLevel: lv().level }); }
  if (url === '/api/fusion' && get) return json(fusion());
  if (url === '/api/fusion') {
    const r = fusion().recipes.find((x) => x.id === body.recipeId)!, success = fuseN++ % 2 === 0; hist.unshift({ recipeId: r.id, success, at: Date.now() });
    const result = !success ? null : r.kind === 'giong' ? { type: 'giong', packets: 4, name: `${SPECIALTIES[body.inputs[0]]?.name} · ${String((r.result as { name?: string }).name).toLowerCase()}` } : r.kind === 'san_pham' ? { type: 'hop_qua', name: (r.result as { name?: string }).name, boxes: 10, value: 212_000 } : { type: 'may', level: 2 };
    return json({ ok: true, success, successRate: body.boost ? r.boostedRate : r.successRate, result, kept: null, spent: (r.extras.cost ?? 400_000) + (body.boost ? r.extras.boostCost ?? 100_000 : 0), cash, xpGained: success ? 60 : 10 });
  }
  if (url === '/api/fusion/boxes/sell') { boxes.length = 0; cash += 4_000_000; return json({ ok: true }); }
  if (url === '/api/workshop/imports') return json(imports());
  if (url === '/api/workshop/machines/import') { const im = IMPORT_MACHINES.find((x) => x.id === body.kind)!; const o = mkOrder(orders.length + 1, im, Date.now(), false); orders.unshift(o); cash -= o.total; return json({ ok: true, orderId: o.id, legs: o.legs, cost: importCost(im), cash, order: o }); }
  if (/\/api\/workshop\/imports\/\d+\/install/.test(url)) { const id = Number(/imports\/(\d+)/.exec(url)![1]); const i = orders.findIndex((o) => o.id === id); if (i >= 0) orders.splice(i, 1); return json({ ok: true }); }
  if (url.startsWith('/api/workshop') && get) return json(workshop());
  return json({ ok: true });
};

function App() {
  const [, bump] = useState(0), [ride, setRide] = useState<ImportOrder | null>(xem === 'nhap' ? (orders[0] ?? null) : null), [note, setNote] = useState('');
  const refresh = () => bump((n) => n + 1), user = me();
  if (ride) return <ImportRide order={ride} onDone={() => { setRide(null); document.title = 'XONG'; }} />;
  return (
    <div className="game has-modal" style={{ position: 'fixed', inset: 0, background: '#8fc47a' }}>
      <section className="modal" role="dialog" aria-label="Thử">
        <header className="modal-head"><h2>{{ tientrinh: 'Con đường thăng hạng', dat: 'Nâng cấp đất', dunghop: 'Lò lai tạo & phối trộn', xuong: 'Kho, đơn hàng, xưởng', nhap: 'Đã chiếu xong' }[xem] ?? xem}</h2><button className="round" aria-label="Đóng">✕</button></header>
        <div className="modal-body">
          {note && <p className="notice">{note}</p>}
          {xem === 'tientrinh' && <ProgressPanel me={user} refresh={refresh} />}
          {xem === 'dat' && <LandUpgrades plotId={12} me={user} onChanged={refresh} />}
          {xem === 'dunghop' && <FusionPanel me={user} refresh={refresh} />}
          {xem === 'xuong' && <WorkshopPanel me={user} priceOf={() => 30_000} onChanged={refresh} onOpen={(w) => setNote(`App mở: ${w}`)} onImport={(o) => setRide(o)} />}
        </div>
      </section>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
