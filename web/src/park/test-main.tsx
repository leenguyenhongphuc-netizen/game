// Trang thử hoạt cảnh lên trò và khu trò chơi (không cần máy chủ):
//   /park-test.html?park=park_mw_da_nang&ride=tau_luon_sao_bang   (hoạt cảnh)
//   /park-test.html?park=park_mw_da_nang&arcade=1                  (khu trò chơi, ví giả)
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { park as findPark } from '../../../shared/parks.ts';
import { RideCut } from './RideCut.tsx';
import { Arcade } from './Arcade.tsx';

function Test() {
  const q = new URLSearchParams(location.search), p = findPark(q.get('park') ?? 'park_mw_da_nang')!;
  const ride = p.rides.find((r) => r.id === q.get('ride')) ?? (q.get('kind') ? p.rides.find((r) => r.kind === q.get('kind')) : null);
  const [done, setDone] = useState(false);
  const [w, setW] = useState({ tokens: 6, tickets: 70, prizes: [] as { prizeId: string; qty: number }[] });
  if (done) return <h1 id="result">XONG</h1>;
  if (ride) return <div className="sw" style={{ position: 'fixed', inset: 0 }}><RideCut park={p} ride={ride} onDone={() => setDone(true)} /></div>;
  return <div className="sw" style={{ position: 'fixed', inset: 0, background: '#4a6' }}><Arcade park={p} wallet={w} onWallet={setW} onPlayed={() => undefined} onClose={() => setDone(true)} /></div>;
}
createRoot(document.getElementById('root')!).render(<Test />);
