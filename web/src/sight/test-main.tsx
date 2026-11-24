// Trang thử riêng cho cảnh đi bộ tham quan: /sight-test.html?id=dn_hoi_an&auto=1&seen=cong,chua_cau&shops=1&energy=70
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SightWalk } from './SightWalk.tsx';

// &qa=1 bật đo chất lượng máy quay (tools/ui-test/camera-qa.mjs); &speed=2 tốc độ đi tự động
const Q0 = new URLSearchParams(location.search);
if (Q0.get('qa') === '1') void import('./camQA.ts').then((m) => m.startCamQA());
if (Q0.get('speed')) (window as unknown as { __sightSpeed?: number }).__sightSpeed = Number(Q0.get('speed'));
declare global { interface Window { __sightResult?: { stops: string[]; toMarket: boolean } } }
function Test() {
  const q = new URLSearchParams(location.search);
  if (q.get('auto') === '1') (window as unknown as { __sightAuto?: boolean }).__sightAuto = true;
  const [done, setDone] = useState<string | null>(null);
  if (done) return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>{done}</h1>;
  // &shops=1 đặt bốn quầy thử, &energy=70 hiện thanh thể lực
  const shops = q.get('shops') === '1' ? [{ id: 'a', name: 'Nước mía cô Ba', kind: 'nuoc_mia', emoji: '🥤' }, { id: 'b', name: 'Gánh chè dì Tư', kind: 'hang_rong', emoji: '🍡' }, { id: 'c', name: 'Cà phê vỉa hè', kind: 'ca_phe', emoji: '☕' }, { id: 'd', name: 'Tiệm tạp hoá', kind: 'tap_hoa', emoji: '🏪' }, { id: 'e', name: 'Quầy lưu niệm', kind: 'luu_niem', emoji: '🎁' }, { id: 'f', name: 'Quầy đặc sản', kind: 'dac_san', emoji: '🧺' }] : undefined;
  const energy = q.get('energy') ? { value: Number(q.get('energy')), max: 100 } : undefined;
  return <SightWalk shops={shops} energy={energy} onShop={(id) => { document.title = `QUẦY ${id}`; }} sightId={q.get('id') ?? 'dn_hoi_an'} seen={(q.get('seen') ?? '').split(',').filter(Boolean)} onExit={(r) => { window.__sightResult = r; document.title = 'XONG'; setDone(r.toMarket ? 'SANG SIÊU THỊ' : 'RỜI ĐI'); }} />;
}
createRoot(document.getElementById('root')!).render(<Test />);
