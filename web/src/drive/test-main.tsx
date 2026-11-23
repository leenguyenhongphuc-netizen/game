// Trang thử riêng cho màn lái: /drive-test.html?from=dt_caibe&to=ld_dalat&seconds=45&boat=0&fuel=30&junctions=3&stations=2&tolls=2&dirs=LRR&etc=200000
// và cho hoạt cảnh du lịch: /drive-test.html?ride=xe_khach|tau_hoa|may_bay|tau_thuy&from=...&to=...&seconds=10
import { VEHICLES, truckOf } from '../../../shared/vehicles.ts';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DriveGame } from './DriveGame.tsx';
import type { DrivePlan, DriveResult } from './DriveGame.tsx';
import { REGIONS } from '../../../shared/catalog.ts';
import { TravelRide } from './TravelRide.tsx';
import { StopAreaView } from './StopAreaView.tsx';
import { ITEMS } from '../../../shared/items.ts';
import { restStopItems } from '../../../shared/vehicles.ts';
import type { RideMode } from './TravelRide.tsx';

declare global { interface Window { __finishCount?: number; __result?: DriveResult } }

function Test() {
  const q = new URLSearchParams(location.search);
  // &auto=1 bật ga tự động, &police=1 ép mọi điểm đều có tổ CSGT, &view=pov vào thẳng góc nhìn ca-bin
  const w = window as unknown as { __driveAuto?: boolean; __drivePolice?: boolean };
  if (q.get('auto') === '1') w.__driveAuto = true;
  if (q.has('police')) w.__drivePolice = q.get('police') === '1';
  if (q.get('view')) { try { localStorage.setItem('vv-drive-view', q.get('view') === 'pov' ? 'pov' : 'chase'); } catch { /* bỏ qua */ } }
  const [state, setState] = useState<'run' | 'done' | 'cancel'>('run');
  if (state !== 'run') return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>{state === 'done' ? 'XONG' : 'ĐÃ HUỶ'}</h1>;
  const done = () => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; setState('done'); };
  const ride = q.get('ride') as RideMode | null;
  if (ride) return <TravelRide mode={ride} fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'ld_dalat'} km={Number(q.get('km') ?? 320)} seconds={Number(q.get('seconds') ?? 10)} onFinish={done} />;
  // &stop=rest|fuel|charger mở thẳng khu trạm 3D (&ev=1 xe điện, &energy=, &kind=); &stopauto=1 cho xe tự làm hết lượt
  const stopQ = q.get('stop') as 'rest' | 'fuel' | 'charger' | null;
  if (stopQ) return <StopTest kind={stopQ} q={q} onDone={done} />;
  const from = q.get('from') ?? 'dt_caibe', to = q.get('to') ?? 'ld_dalat';
  const km = Number(q.get('km') ?? 320), boat = q.get('boat') === '1', roadKm = boat ? km * 0.6 : km;
  const nj = Number(q.get('junctions') ?? 3), ns = Number(q.get('stations') ?? 2), names = ['QL1A', 'Cao tốc Bắc Nam', REGIONS[to]?.name ?? 'Điểm đến', 'QL20', 'ĐT 741'];
  const dirs = (q.get('dirs') ?? 'LRR').split('');
  // &kind=<loại xe trong shared/vehicles.ts>, &ev=1 (bản điện của loại đó), &rests=<số trạm dừng nghỉ>, &need=<số lần phải nghỉ>
  const kindQ = q.get('kind') ?? '', spec = VEHICLES[q.get('ev') === '1' && VEHICLES[`${kindQ || 'tai_990'}_dien`] ? `${kindQ || 'tai_990'}_dien` : kindQ];
  const tk = spec ? truckOf(spec) : null, nRest = Number(q.get('rests') ?? 0);
  const restStops = Array.from({ length: nRest }, (_, i) => ({ atKm: Math.round(roadKm * (i + 1) / (nRest + 1)), name: `Trạm dừng nghỉ Km ${Math.round(roadKm * (i + 1) / (nRest + 1))}`, hasFuel: true, hasCharger: true, province: i % 2 ? 'Quảng Ngãi' : 'Đà Nẵng' }));
  const plan: DrivePlan = {
    km, needsBoat: boat, seconds: Number(q.get('seconds') ?? 45), tolls: Number(q.get('tolls') ?? 2), tollFee: Number(q.get('fee') ?? 35000), fuelNeededL: Math.round(roadKm * 0.14),
    junctions: Array.from({ length: nj }, (_, i) => ({ atKm: Math.round(roadKm * (i + 1) / nj * (i === nj - 1 ? 1 : 0.92)), dir: (dirs[i % dirs.length] === 'L' ? 'L' : 'R') as 'L' | 'R', name: i === nj - 1 ? names[2] : names[i % 2] })),
    stationsAtKm: spec?.power === 'dien' ? [] : Array.from({ length: ns }, (_, i) => Math.round(roadKm * (i + 0.6) / (ns + 0.4))),
    ...(spec ? { power: spec.power, maxKmh: spec.maxKmh, upkeepCost: Math.round(roadKm * spec.upkeepPer100 / 100 / 1000) * 1000 } : {}),
    ...(spec?.power === 'dien' ? { chargersAtKm: Array.from({ length: Math.max(1, ns) }, (_, i) => Math.round(roadKm * (i + 0.6) / (Math.max(1, ns) + 0.4))) } : {}),
    ...(nRest ? { restStops, restsNeeded: Number(q.get('need') ?? Math.min(nRest, 2)) } : {}),
  };
  return (
    <DriveGame
      fromRegionId={from} toRegionId={to} plan={plan}
      fuelL={Number(q.get('fuel') ?? (tk ? tk.tankL * 0.5 : 30))} truck={tk ? { tankL: tk.tankL, lPer100km: tk.lPer100km, fuelPrice: tk.fuelPrice, kind: tk.kind, name: tk.name, power: tk.power, unit: tk.unit, maxKmh: tk.maxKmh, cold: tk.cold } : { tankL: Number(q.get('tank') ?? 60), lPer100km: 14, fuelPrice: 25000 }}
      etc={Number(q.get('etc') ?? 200000)} cash={Number(q.get('cash') ?? 5000000)} truckColor={q.get('color') ?? '#f08a6c'}
      onFinish={(r) => { window.__finishCount = (window.__finishCount ?? 0) + 1; window.__result = r; document.title = 'XONG'; setState('done'); }}
      onCancel={() => { document.title = 'ĐÃ HUỶ'; setState('cancel'); }}
    />
  );
}
function StopTest(p: { kind: 'rest' | 'fuel' | 'charger'; q: URLSearchParams; onDone(): void }) {
  const ev = p.q.get('ev') === '1', spec = VEHICLES[p.q.get('kind') ?? (ev ? 'tai_990_dien' : 'tai_990')] ?? VEHICLES.tai_990, tk = truckOf(spec);
  const [bought, setBought] = useState<{ itemId: string; qty: number; use: boolean }[]>([]);
  if (p.q.get('stopauto') === '1') (window as unknown as { __stopAuto?: boolean }).__stopAuto = true;
  const menu = restStopItems('Đà Nẵng').map((id) => ITEMS[id]).filter(Boolean);
  return (
    <div className="dg" style={{ position: 'fixed', inset: 0 }}>
      <StopAreaView info={{ kind: p.kind, name: p.kind === 'rest' ? 'Trạm dừng nghỉ Km 182' : ev ? 'Trạm sạc Km 96' : 'Cây xăng Km 96', electric: tk.power === 'dien', energy: Number(p.q.get('energy') ?? tk.tankL * 0.3), tank: tk.tankL, unit: tk.unit, price: tk.fuelPrice, group: spec.group as never, color: 0xf08a24, cold: !!spec.cold }}
        fuelNames={tk.power === 'dien' ? [] : tk.power === 'dau' ? ['Dầu DO 0,05S'] : ['RON 95-III', 'E5 RON 92']} menu={p.kind === 'rest' ? menu : []} cash={2_000_000} bought={bought}
        onBuy={(id, use) => setBought((b) => [...b, { itemId: id, qty: 1, use }])} onFail={() => { document.title = 'LỖI'; }}
        onDone={(r) => { (window as unknown as { __stopResult?: unknown }).__stopResult = r; p.onDone(); }} />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
