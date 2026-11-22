// Trang thử: /ui-test.html?xem=hochieu|giay|tui|quay|hetsuc|hud[&trang=3][&it=1] — dữ liệu thật từ shared, API giả.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { REGIONS } from '../../shared/catalog.ts';
import { ITEMS, SHOP_KINDS, HOME_SHOP_ITEMS } from '../../shared/items.ts';
import { LEVELS, XP, levelOf, levelPerks } from '../../shared/rules.ts';
import { SIGHTS, SIGHT_PROVINCES, sightsOfProvince } from '../../shared/sights.ts';
import type { Me } from './api.ts';
import { LandCertificate, PassportPanel } from './passport.tsx';
import { BagPanel, EnergyBar, HetSucSheet, LevelBadge, ShopSheet, describeProgress } from './vital.tsx';

const q = new URLSearchParams(location.search), xem = q.get('xem') ?? 'hochieu', few = q.get('it') === '1';
const DAY = 86400000, t0 = Date.UTC(2026, 9, 3, 2);
const lv = levelOf(few ? 40 : 742);
let energy = few ? 12 : 64; const energyMax = levelPerks(lv.level).energyMax;
const bag: Record<string, number> = few ? {} : { nuoc_suoi: 3, banh_mi: 1, mi_quang: 2 };
const me = {
  user: { id: 7, username: 'test', displayName: 'Nguyễn Thị Hồng Phúc', cash: 852744190, homeRegionId: 'dt_caibe', role: 'nong_dan', avatar: { shirt: '#3f7fd0', hat: 'non_la', truck: '#f08a6c' }, ...lv, energy, energyMax, energyFullAt: Date.now() + 47 * 60000 },
  plots: [{ id: 12, regionId: 'dt_caibe', isHome: true }], inventory: [], config: { timeScale: 1, now: Date.now() },
} as unknown as Me;
const stamps: any[] = [];
const doneS = few ? [] : ['dn_hoi_an', 'dn_cau_rong'], partS: Record<string, number> = few ? { dn_hoi_an: 2 } : { dn_my_son: 4, dn_ba_na: 2, qng_ly_son: 3, dn_my_khe: 1 };
let k = 0;
for (const s of SIGHTS) {
  const n = doneS.includes(s.id) ? s.stops.length : partS[s.id] ?? 0;
  s.stops.slice(0, n).forEach((x) => stamps.push({ kind: 'stop', sightId: s.id, stopId: x.id, name: x.name, province: s.province, at: k++ % 9 === 4 ? null : t0 + k * DAY * 0.7 }));
  if (doneS.includes(s.id)) stamps.push({ kind: 'sight', sightId: s.id, name: s.name, province: s.province, at: t0 + k * DAY * 0.7 });
}
(few ? ['dt_caibe'] : ['dt_caibe', 'dn_tienphuoc', 'qng_lyson', 'ld_dalat', 'tq_hamyen', 'lc_bacha', 'bn_lucngan']).filter((id) => REGIONS[id]).forEach((id, i) => stamps.push({ kind: 'region', regionId: id, name: REGIONS[id].name, province: REGIONS[id].province, at: t0 - (9 - i) * DAY * 3 }));
const itemOut = (id: string) => ({ itemId: id, name: ITEMS[id].name, emoji: ITEMS[id].emoji, price: ITEMS[id].price, energy: ITEMS[id].energy, kind: ITEMS[id].kind, regional: ITEMS[id].regional });
const eOut = () => ({ energy, energyMax, energyFullAt: energy >= energyMax ? null : Date.now() + (energyMax - energy) * 180000 });
const bagOut = () => Object.entries(bag).filter(([, n]) => n > 0).map(([itemId, qty]) => ({ itemId, qty }));
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString(), body = init?.body ? JSON.parse(String(init.body)) : {};
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  if (url === '/api/passport') return json({ holder: me.user.displayName, issuedAt: t0 - 40 * DAY, no: 'VV0000007', ...lv, perks: levelPerks(lv.level), levels: LEVELS, xpTable: XP, stamps,
    sights: { done: doneS.length, total: SIGHTS.length }, regions: { done: stamps.filter((s) => s.kind === 'region').length, total: Object.keys(REGIONS).length },
    provinces: SIGHT_PROVINCES.map((p) => ({ province: p, done: sightsOfProvince(p).filter((s) => doneS.includes(s.id)).length, total: sightsOfProvince(p).length })) });
  if (url.includes('/certificate')) return json({ title: 'Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất', no: 'CS 04521/DT-CB', plotId: 12, owner: me.user.displayName, province: 'Đồng Tháp', ward: 'Phường Bình Xuân', regionId: 'dt_caibe', regionName: 'Cái Bè', tiles: 24, areaM2: 600,
    purpose: 'Đất trồng cây lâu năm', term: '50 năm', expiresAt: t0 + 50 * 365.25 * DAY, issuedAt: t0, origin: few ? 'Nhà nước giao đất không thu tiền sử dụng đất' : 'Nhận chuyển nhượng quyền sử dụng đất', price: few ? 0 : 48000000, fees: few ? { registration: 0, certificate: 0, total: 0 } : { registration: 240000, certificate: 100000, total: 340000 }, issuer: 'Văn phòng đăng ký đất đai Đồng Tháp',
    note: 'Theo Luật Đất đai 2024: đất nông nghiệp giao cho cá nhân có thời hạn 50 năm, hết hạn được tiếp tục sử dụng. Trong game đã đơn giản hoá: không có hạn mức, thuế sử dụng đất hay thủ tục công chứng.' });
  if (url === '/api/items') return json({ items: bagOut().map((x) => ({ ...x, ...itemOut(x.itemId) })), bagMax: 10, ...eOut() });
  if (url === '/api/shops/home') return json({ shops: [{ id: 'home', kind: 'tap_hoa', emoji: '🏪', name: 'Tiệm tạp hoá đầu xóm', items: HOME_SHOP_ITEMS.map(itemOut) }], items: bagOut(), bagMax: 10, ...eOut() });
  if (/\/api\/sights\/[^/]+\/shops/.test(url)) return json({ sightId: 'dn_hoi_an', bagMax: 10, shops: [{ id: 'dn_hoi_an:quan_an', kind: 'quan_an', emoji: SHOP_KINDS.quan_an.emoji, name: 'Quán ăn bên sông Hoài', items: ['mi_quang', 'cao_lau', 'com_hop', 'tra_da', 'banh_it_la_gai'].map(itemOut) }] });
  if (url === '/api/items/use') { const it = ITEMS[body.itemId]; if (energy >= energyMax) return json({ error: 'du_suc', message: 'Bạn đang đầy thể lực.' }, 409); const b = energy; energy = Math.min(energyMax, energy + it.energy); bag[body.itemId]--; return json({ ok: true, itemId: body.itemId, gained: energy - b, ...eOut(), items: bagOut() }); }
  if (url === '/api/shop/buy') { const it = ITEMS[body.itemId]; if (body.use) { if (energy >= energyMax) return json({ error: 'du_suc', message: 'Đầy' }, 409); energy = Math.min(energyMax, energy + it.energy); } else { if ((bag[body.itemId] ?? 0) >= 10) return json({ error: 'day_tui', message: 'Đầy túi' }, 409); bag[body.itemId] = (bag[body.itemId] ?? 0) + 1; } me.user.cash -= it.price; return json({ ok: true, itemId: body.itemId, qty: 1, total: it.price, cash: me.user.cash, used: !!body.use, ...eOut(), items: bagOut() }); }
  return json({ error: 'khong_tim_thay', message: 'Chưa giả lập ' + url }, 404);
};

function Test() {
  const [, tick] = useState(0); const refresh = () => tick((n) => n + 1);
  const [open, setOpen] = useState(true);
  const frame = (title: string, el: React.ReactNode) => (<div className="game" style={{ position: 'fixed', inset: 0, background: '#8fc46a' }}><div className="modal" role="dialog"><div className="modal-head"><h2>{title}</h2></div><div className="modal-body">{el}</div></div></div>);
  if (xem === 'giay') return <div style={{ height: '100%', background: '#8fc46a' }}>{open && <LandCertificate plotId={12} onClose={() => setOpen(false)} />}</div>;
  if (xem === 'tui') return frame('Túi đồ và tiệm tạp hoá', <BagPanel me={me} refresh={refresh} />);
  if (xem === 'quay') return <div style={{ height: '100%', background: 'linear-gradient(#f2a65a, #7a5c8a)' }}>{open && <ShopSheet sightId="dn_hoi_an" shopId="dn_hoi_an:quan_an" onClose={() => setOpen(false)} onChanged={refresh} />}</div>;
  if (xem === 'hetsuc') return <div style={{ height: '100%', background: '#8fc46a' }}>{open && <HetSucSheet message="Bạn còn 0 thể lực, không đủ để thu hoạch (cần 2). Hãy ăn uống hoặc nghỉ một lát." onClose={() => setOpen(false)} onOpenBag={() => setOpen(false)} />}</div>;
  if (xem === 'hud') return (
    <div style={{ height: '100%', background: '#8fc46a', padding: 12, display: 'grid', gap: 12, alignContent: 'start' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><LevelBadge me={me} /><EnergyBar me={me} /></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><LevelBadge me={{ ...me, user: { ...me.user, ...levelOf(7400) } } as Me} /><EnergyBar me={{ ...me, user: { ...me.user, energy: 9, energyMax: 190 } } as Me} /></div>
      <p style={{ background: '#fff6dc', padding: 8, borderRadius: 10 }}>{describeProgress({ xpGained: 10, levelUp: true, level: 3, title: 'Người ham đi' })}<br />{describeProgress({ xpGained: 5 })}<br />{describeProgress({ gained: 25 })}</p>
    </div>
  );
  return frame('Hộ chiếu du lịch', <PassportPanel me={me} refresh={refresh} />);
}
createRoot(document.getElementById('root')!).render(<Test />);
