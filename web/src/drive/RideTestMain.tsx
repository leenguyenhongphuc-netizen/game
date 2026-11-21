// Trang thử riêng cho hoạt cảnh du lịch: /ride-test.html?ride=xe_khach|tau_hoa|may_bay|tau_thuy&from=...&to=...&seconds=10
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TravelRide } from './TravelRide.tsx';
import type { RideMode } from './TravelRide.tsx';

declare global { interface Window { __finishCount?: number } }

function Test() {
  const q = new URLSearchParams(location.search);
  const [done, setDone] = useState(false);
  if (done) return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>XONG</h1>;
  return (
    <TravelRide
      mode={(q.get('ride') ?? 'xe_khach') as RideMode} fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'ld_dalat'}
      km={Number(q.get('km') ?? 320)} seconds={Number(q.get('seconds') ?? 10)}
      onFinish={() => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; window.setTimeout(() => setDone(true), 600); }}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
