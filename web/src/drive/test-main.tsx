// Trang thử riêng cho màn lái: /drive-test.html?from=dt_caibe&to=qng_lyson&seconds=30&boat=1
// và cho hoạt cảnh du lịch: /drive-test.html?ride=xe_khach|tau_hoa|may_bay|tau_thuy&from=...&to=...&seconds=10
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DriveGame } from './DriveGame.tsx';
import { TravelRide } from './TravelRide.tsx';
import type { RideMode } from './TravelRide.tsx';

declare global { interface Window { __finishCount?: number } }

function Test() {
  const q = new URLSearchParams(location.search);
  const [state, setState] = useState<'run' | 'done' | 'cancel'>('run');
  if (state !== 'run') return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>{state === 'done' ? 'XONG' : 'ĐÃ HUỶ'}</h1>;
  const done = () => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; setState('done'); };
  const ride = q.get('ride') as RideMode | null;
  if (ride) return <TravelRide mode={ride} fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'ld_dalat'} km={Number(q.get('km') ?? 320)} seconds={Number(q.get('seconds') ?? 10)} onFinish={done} />;
  return (
    <DriveGame
      fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'qng_lyson'}
      km={Number(q.get('km') ?? 640)} seconds={Number(q.get('seconds') ?? 30)} needsBoat={q.get('boat') === '1'} truckColor={q.get('color') ?? '#f08a6c'}
      onFinish={() => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; setState('done'); }}
      onCancel={() => { document.title = 'ĐÃ HUỶ'; setState('cancel'); }}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
