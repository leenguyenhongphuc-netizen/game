// Trang thử: /map-test.html?xem=vn|tinh|thamquan|sieuthi[&o=xa][&trong=1] — dùng dữ liệu thật từ shared, API giả.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { REGIONS } from '../../../shared/catalog.ts';
import { haversineKm } from '../../../shared/rules.ts';
import { SIGHTS, SIGHT_PROVINCES, sightsOfProvince } from '../../../shared/sights.ts';
import type { Me } from '../api.ts';
import { SightsPanel, SupermarketPanel } from '../sights.tsx';
import { ProvinceMap } from './ProvinceMap.tsx';
import { VietnamMap } from './VietnamMap.tsx';

const q = new URLSearchParams(location.search);
const regions = Object.values(REGIONS);
const home = 'dt_caibe', cur = q.get('o') === 'xa' ? 'dt_caibe' : 'dn_tienphuoc';
const here = REGIONS[cur];
const rows = (province: string) => sightsOfProvince(province).map((s, i) => {
  const km = Math.round(haversineKm(here.lat, here.lng, s.lat, s.lng) * 1.3);
  return { ...s, km, taxiFare: 15000 + km * 2500, visits: i === 0 ? 1 : 0, done: i === 0, stopsSeen: i === 0 ? s.stops.map((x) => x.id) : i === 1 ? s.stops.slice(0, 2).map((x) => x.id) : [] };
});
const shelf = (id: number, specialtyId: string, quality: string, kg: number, mult: number, seller: string, mine = false, npc = false) => {
  const ref = Object.values(REGIONS) && (window as any).__sp[specialtyId].refPrice; return { id, specialtyId, quality, kg, price: Math.round(ref * mult / 100) * 100, refPrice: ref, seller, mine, npc };
};
// API giả
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString(), json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  if (url.startsWith('/api/sights/')) return json({ ok: true, km: 42, taxiFare: 120000, entryFee: 12000, seconds: 12 });
  if (url.startsWith('/api/sights')) {
    const p = new URL(url, location.origin).searchParams.get('province');
    const province = p ?? here.province;
    return json({ province, regionId: cur, here: !p && SIGHT_PROVINCES.includes(here.province), sights: rows(province), others: SIGHT_PROVINCES.map((x) => ({ province: x, count: sightsOfProvince(x).length })) });
  }
  if (url.startsWith('/api/supermarket') && (!init?.method || init.method === 'GET')) {
    const empty = q.get('trong') === '1';
    return json({
      province: 'Đà Nẵng', here: true, earned: empty ? 0 : 486000, feeRatio: 0.05, limits: { buyKg: 20 },
      shelves: empty ? [] : [shelf(1, 'sau_rieng_ngu_hiep', 'A', 120, 1.25, 'Thương lái Ba Tèo'), shelf(2, 'xoai_hoa_loc', 'A', 46, 1.1, 'Vườn Cô Út'), shelf(3, 'xoai_hoa_loc', 'B', 30, 0.95, 'Tài khoản test', true), shelf(4, 'man_bac_ha', 'A', 15, 1.4, 'Siêu thị', false, true)],
      mine: empty ? [] : [shelf(3, 'xoai_hoa_loc', 'B', 30, 0.95, 'Tài khoản test', true)],
      consignable: [{ specialtyId: 'sau_rieng_ngu_hiep', quality: 'A', kg: 600, refPrice: 80000, minPrice: 72000, maxPrice: 128000 }, { specialtyId: 'xoai_hoa_loc', quality: 'A', kg: 300, refPrice: 64000, minPrice: 57600, maxPrice: 102400 }],
    });
  }
  if (url.startsWith('/api/supermarket')) return json({ ok: true });
  return realFetch(input, init);
};
import('../../../shared/catalog.ts').then((m) => { (window as any).__sp = m.SPECIALTIES; render(); });

const me = { user: { id: 1, username: 'test', displayName: 'Tài khoản test', cash: 852744190, homeRegionId: home }, plots: [], inventory: [], config: { timeScale: 1, now: Date.now() } } as unknown as Me;

function Test() {
  const view = q.get('xem') ?? 'vn';
  const [sel, setSel] = useState<string | null>(q.get('chon'));
  const [sight, setSight] = useState<string | null>(null);
  const [log, setLog] = useState('');
  return (
    <div className="game" style={{ position: 'fixed', inset: 0, background: '#5d9a43' }}>
      <section className="modal panel" style={{ top: 10, bottom: 10 }}>
        <header className="modal-head"><h2>{view === 'sieuthi' ? 'Siêu thị đặc sản' : 'Du lịch và sổ tem'}</h2></header>
        <div className="modal-body">
          {view === 'vn' && <>
            <VietnamMap regions={regions} homeId={home} currentId={cur} visited={['ld_dalat', 'qng_lyson', 'dn_tienphuoc', 'gl_chuse']} owned={['ld_dalat']} sightProvinces={SIGHT_PROVINCES} selectedId={sel} onSelect={setSel} />
            <p id="picked" className="muted">{sel ? `Đang chọn: ${REGIONS[sel].name}, ${REGIONS[sel].province}` : 'Chạm một ghim để chọn vùng.'}</p>
          </>}
          {view === 'tinh' && <ProvinceMap province="Đà Nẵng" sights={rows('Đà Nẵng')} regions={regions} currentRegionId="dn_tienphuoc" selectedId={sight} onSelect={setSight} />}
          {view === 'thamquan' && <><SightsPanel me={me} refresh={() => {}} onGo={(t) => setLog(`Đi ${t.sight.name}: ${t.km} km, ${t.seconds} giây`)} /><p id="log">{log}</p></>}
          {view === 'sieuthi' && <SupermarketPanel me={me} province="Đà Nẵng" refresh={() => {}} />}
        </div>
      </section>
    </div>
  );
}
function render() { createRoot(document.getElementById('root')!).render(<Test />); }
void SIGHTS;
