// Trang thử riêng cho màn lái: /drive-test.html?from=dt_caibe&to=ld_dalat&seconds=45&boat=0&fuel=30&junctions=3&stations=2&tolls=2&dirs=LRR&etc=200000
// và cho hoạt cảnh du lịch: /drive-test.html?ride=xe_khach|tau_hoa|may_bay|tau_thuy&from=...&to=...&seconds=10
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DriveGame } from './DriveGame.tsx';
import type { DrivePlan, DriveResult } from './DriveGame.tsx';
import { REGIONS } from '../../../shared/catalog.ts';
import { TravelRide } from './TravelRide.tsx';
import type { RideMode } from './TravelRide.tsx';

declare global { interface Window { __finishCount?: number; __result?: DriveResult } }

function Test() {
  const q = new URLSearchParams(location.search);
  const [state, setState] = useState<'run' | 'done' | 'cancel'>('run');
  if (state !== 'run') return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>{state === 'done' ? 'XONG' : 'ĐÃ HUỶ'}</h1>;
  const done = () => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; setState('done'); };
  const ride = q.get('ride') as RideMode | null;
  if (ride) return <TravelRide mode={ride} fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'ld_dalat'} km={Number(q.get('km') ?? 320)} seconds={Number(q.get('seconds') ?? 10)} onFinish={done} />;
  const from = q.get('from') ?? 'dt_caibe', to = q.get('to') ?? 'ld_dalat';
  const km = Number(q.get('km') ?? 320), boat = q.get('boat') === '1', roadKm = boat ? km * 0.6 : km;
  const nj = Number(q.get('junctions') ?? 3), ns = Number(q.get('stations') ?? 2), names = ['QL1A', 'Cao tốc Bắc Nam', REGIONS[to]?.name ?? 'Điểm đến', 'QL20', 'ĐT 741'];
  const dirs = (q.get('dirs') ?? 'LRR').split('');
  const plan: DrivePlan = {
    km, needsBoat: boat, seconds: Number(q.get('seconds') ?? 45), tolls: Number(q.get('tolls') ?? 2), tollFee: Number(q.get('fee') ?? 35000), fuelNeededL: Math.round(roadKm * 0.14),
    junctions: Array.from({ length: nj }, (_, i) => ({ atKm: Math.round(roadKm * (i + 1) / nj * (i === nj - 1 ? 1 : 0.92)), dir: (dirs[i % dirs.length] === 'L' ? 'L' : 'R') as 'L' | 'R', name: i === nj - 1 ? names[2] : names[i % 2] })),
    stationsAtKm: Array.from({ length: ns }, (_, i) => Math.round(roadKm * (i + 0.6) / (ns + 0.4))),
  };
  return (
    <DriveGame
      fromRegionId={from} toRegionId={to} plan={plan}
      fuelL={Number(q.get('fuel') ?? 30)} truck={{ tankL: Number(q.get('tank') ?? 60), lPer100km: 14, fuelPrice: 25000 }}
      etc={Number(q.get('etc') ?? 200000)} cash={Number(q.get('cash') ?? 5000000)} truckColor={q.get('color') ?? '#f08a6c'}
      onFinish={(r) => { window.__finishCount = (window.__finishCount ?? 0) + 1; window.__result = r; document.title = 'XONG'; setState('done'); }}
      onCancel={() => { document.title = 'ĐÃ HUỶ'; setState('cancel'); }}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
