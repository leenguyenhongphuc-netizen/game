// Trang thử riêng cho cảnh đi bộ tham quan: /sight-test.html?id=dn_hoi_an&auto=1&seen=cong,chua_cau
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SightWalk } from './SightWalk.tsx';

declare global { interface Window { __sightResult?: { stops: string[]; toMarket: boolean } } }
function Test() {
  const q = new URLSearchParams(location.search);
  if (q.get('auto') === '1') (window as unknown as { __sightAuto?: boolean }).__sightAuto = true;
  const [done, setDone] = useState<string | null>(null);
  if (done) return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>{done}</h1>;
  return <SightWalk sightId={q.get('id') ?? 'dn_hoi_an'} seen={(q.get('seen') ?? '').split(',').filter(Boolean)} onExit={(r) => { window.__sightResult = r; document.title = 'XONG'; setDone(r.toMarket ? 'SANG SIÊU THỊ' : 'RỜI ĐI'); }} />;
}
createRoot(document.getElementById('root')!).render(<Test />);
