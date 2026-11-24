// Trang thử đi phượt với máy chủ thật (Vite dev, /api chuyển tới máy chủ thử):
//   phuot-test.html?auto=1&step=12&nhanh=1[&troi=mua|suong|nang|doi]   — bảng Đi phượt (đi một mình hoặc đi đoàn)
//   phuot-test.html?ho_chieu=1                                          — Hộ chiếu, mở trang Cung đường phượt
// auto: tự lái và tự làm việc ở điểm dừng; step: số bước vật lý mỗi khung (tăng tốc trên máy chậm); nhanh: máy chủ (tài khoản thử) nhận chuyến chạy nhanh.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { PhuotPanel } from './phuot.tsx';
import { PassportPanel } from './passport.tsx';
import './styles.css';

const q = new URLSearchParams(location.search);
const w = window as unknown as { __motoAuto?: boolean; __rideStep?: number };
if (q.get('auto') === '1') w.__motoAuto = true;
if (q.get('step')) w.__rideStep = Number(q.get('step'));

function Root() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState('');
  const reload = () => { api<Me>('GET', '/api/me').then(setMe).catch((e) => setErr(String(e?.message ?? e))); };
  useEffect(reload, []);
  if (err) return <p className="error">{err}</p>;
  if (!me) return <p>Đang tải…</p>;
  return (
    <div className="modal" style={{ position: 'static', maxWidth: 520, margin: '0 auto' }}>
      <div className="modal-body" style={{ maxHeight: 'none' }}>
        {q.get('ho_chieu') === '1' ? <PassportPanel me={me} refresh={reload} /> : <PhuotPanel me={me} refresh={reload} />}
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
