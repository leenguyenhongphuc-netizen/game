// Trang thử xe máy (không cần máy chủ): moto-test.html?tuyen=ha_giang|hai_van|bien_vinh_hy|buon&xe=so|ga|con_tay|adventure|dien&auto=1, hoặc ?thi=A1|A.
import { createRoot } from 'react-dom/client';
import { PHUOT_BY_ID } from '../../shared/moto.ts';
import { MotoRide } from './drive/MotoRide.tsx';
import { MotoExam } from './drive/MotoExam.tsx';
import type { MotoStyle } from './drive/MotoParts.ts';

const q = new URLSearchParams(location.search);
if (q.get('auto') === '1') (window as unknown as { __motoAuto?: boolean }).__motoAuto = true;
if (q.get('step')) (window as unknown as { __rideStep?: number }).__rideStep = Number(q.get('step'));
const out = window as unknown as { __motoResult?: unknown };
const style = (q.get('xe') ?? 'so') as MotoStyle;
const tank = style === 'adventure' ? 17 : style === 'dien' ? 3.5 : 3.7, per100 = style === 'adventure' ? 3.5 : style === 'dien' ? 1.75 : 1.7;
const root = createRoot(document.getElementById('root')!);
if (q.get('thi')) {
  const cls = q.get('thi') === 'A' ? 'A' : 'A1';
  root.render(<MotoExam cls={cls} title={`Hạng ${cls}`} practiceOnly onClose={(r) => { out.__motoResult = r ?? 'dong'; }} />);
} else if (q.get('tuyen') === 'buon') {
  const km = Number(q.get('km') ?? 120);
  root.render(<MotoRide mode="buon" cargo presenceKey="thu|xm" route={{ title: 'Cái Bè → Chợ Lách', startName: 'Cái Bè', endName: 'Chợ Lách', km, theme: 'plain', twisty: 0.3, seconds: 60,
    stops: [{ id: 'rest:60', name: 'Quán nghỉ Km 60', atKm: 60, kind: 'cafe' }, { id: 'fuel:80', name: 'Cây xăng Km 80', atKm: 80, kind: 'fuel' }] }}
    bike={{ name: 'Xe số 110', style, tank, per100, unit: style === 'dien' ? 'kWh' : 'lít', maxKmh: 70, fuel: tank * 0.6, price: 19100, color: 0xc0392b }} onDone={(r) => { out.__motoResult = r; }} />);
} else {
  const r = PHUOT_BY_ID[q.get('tuyen') ?? 'ha_giang'] ?? PHUOT_BY_ID.ha_giang;
  root.render(<MotoRide mode="phuot" presenceKey={`phuot:${r.id}`} cafe={{ cost: 35000, energy: 6 }}
    route={{ title: r.name, startName: r.startName, endName: r.endName, km: r.km, theme: r.theme, twisty: r.twisty, seconds: Math.round(Math.min(160, 45 + r.km * 0.55)), stops: r.checkpoints }}
    bike={{ name: 'Xe', style, tank, per100, unit: style === 'dien' ? 'kWh' : 'lít', maxKmh: 70, fuel: tank, price: 19100, color: 0xc0392b }} onDone={(res) => { out.__motoResult = res; }} />);
}
