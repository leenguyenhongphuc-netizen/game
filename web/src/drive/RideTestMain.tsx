// Trang thử riêng cho hoạt cảnh du lịch: /ride-test.html?ride=xe_khach|tau_hoa|may_bay|tau_thuy|taxi&from=...&to=...&seconds=10 (taxi: &toName=...&fare=85000&km=30&side=bien|song|nui|pho)
// và hoạt cảnh xuất khẩu: /ride-test.html?xuat=xe_tai|container|tau_hoa|hang_khong|tau_nho|tau_lon&kg=500
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TravelRide } from './TravelRide.tsx';
import type { RideMode } from './TravelRide.tsx';
import { ExportRide } from './ExportRide.tsx';
import type { ExportMode } from './ExportRide.tsx';

declare global { interface Window { __finishCount?: number } }

function Test() {
  const q = new URLSearchParams(location.search);
  const [done, setDone] = useState(false);
  if (done) return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>XONG</h1>;
  const finish = () => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; window.setTimeout(() => setDone(true), 600); };
  const xuat = q.get('xuat');
  if (xuat) return (
    <ExportRide mode={xuat as ExportMode} fromName={q.get('tu') ?? 'Lục Ngạn'} marketName={q.get('toi') ?? 'Trung Quốc'}
      specialtyName={q.get('hang') ?? 'Vải thiều Lục Ngạn'} emoji={q.get('emoji') ?? '🍒'} kg={Number(q.get('kg') ?? 500)} onDone={finish} />
  );
  return (
    <TravelRide
      mode={(q.get('ride') ?? 'xe_khach') as RideMode} fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'ld_dalat'}
      km={Number(q.get('km') ?? 320)} seconds={Number(q.get('seconds') ?? 10)}
      toName={q.get('toName') ?? undefined} fare={q.get('fare') ? Number(q.get('fare')) : undefined} sideHint={(q.get('side') ?? undefined) as 'bien' | 'song' | 'nui' | 'pho' | undefined}
      onFinish={finish}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
