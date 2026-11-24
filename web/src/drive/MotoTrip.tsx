// Chuyến buôn bằng xe máy: không vào cao tốc nên chạy quốc lộ trong MotoScene (thay cho màn xe tải DriveGame).
// Trạm dừng nghỉ của kế hoạch chuyến thành quán ven quốc lộ; cây xăng rải theo tầm đi của bình xăng nhỏ.
import type { JSX } from 'react';
import { REGIONS } from '../../../shared/catalog.ts';
import { highwayKey } from '../../../shared/social.ts';
import { VEHICLES } from '../../../shared/vehicles.ts';
import { MotoRide } from './MotoRide.tsx';
import type { MotoStop, MotoTheme } from './MotoScene.ts';
import type { DrivePlan, DriveResult } from './DriveGame.tsx';

export interface MotoTripProps {
  fromRegionId: string; toRegionId: string; plan: DrivePlan; fuelL: number;
  truck: { tankL: number; lPer100km: number; fuelPrice: number; kind?: string; unit?: string; maxKmh?: number };
  truckColor: string; shirt?: string;
  onFinish: (r: DriveResult) => void; onCancel: () => void;
}
const hex = (s: string | undefined, fb: number) => (s && /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : fb);

/** Dáng địa hình theo miền của nơi đến. */
function themeOf(regionId: string): MotoTheme {
  const r = REGIONS[regionId];
  if (!r) return 'plain';
  return r.zone === 'bac' ? 'karst' : r.zone === 'trung' ? 'coast' : r.zone === 'taynguyen' ? 'pass_sea' : 'plain';
}

export function MotoTrip(p: MotoTripProps): JSX.Element {
  const spec = VEHICLES[p.truck.kind ?? ''], ev = spec?.power === 'dien';
  const km = Math.max(5, Math.round(p.plan.km));
  const stops: MotoStop[] = [];
  for (const r of p.plan.restStops ?? []) stops.push({ id: `rest:${r.atKm}`, name: `Quán nghỉ Km ${r.atKm}`, atKm: Math.min(km - 1, r.atKm), kind: 'cafe', note: 'Ghé quán ven quốc lộ uống nước, đi vệ sinh. Lái quá 4 giờ liền là vi phạm luật.' });
  // cây xăng: cách nhau khoảng 60% tầm đi của một bình
  const range = (p.truck.tankL / Math.max(0.1, p.truck.lPer100km)) * 100, every = Math.max(25, Math.round(range * 0.6));
  for (let k = every; k < km - 5; k += every) stops.push({ id: `fuel:${k}`, name: ev ? `Trạm sạc Km ${k}` : `Cây xăng Km ${k}`, atKm: k, kind: ev ? 'cafe' : 'fuel', note: ev ? 'Quán có ổ sạc xe máy điện.' : 'Cây xăng ven quốc lộ.' });
  stops.sort((a, b) => a.atKm - b.atKm);
  const from = REGIONS[p.fromRegionId]?.name ?? 'Nhà', to = REGIONS[p.toRegionId]?.name ?? 'Nơi đến';
  const seconds = Math.min(150, Math.max(40, Math.round((p.plan.seconds || 40) * 1.1)));
  return (
    <MotoRide mode="buon" cargo presenceKey={highwayKey(p.fromRegionId, p.toRegionId).key + '|xm'}
      route={{ title: `${from} → ${to}`, startName: from, endName: to, km, theme: themeOf(p.toRegionId), twisty: 0.35, seconds, stops }}
      bike={{ name: spec?.name ?? 'Xe máy', style: spec?.moto ?? 'so', tank: p.truck.tankL, per100: p.truck.lPer100km, unit: p.truck.unit ?? (ev ? 'kWh' : 'lít'), maxKmh: p.truck.maxKmh ?? 70, fuel: p.fuelL, price: p.truck.fuelPrice, color: hex(p.truckColor, 0xc0392b) }}
      shirt={hex(p.shirt, 0x2f7fd8)}
      onDone={(r) => {
        if (r.aborted) { p.onCancel(); return; }
        const total = r.refuels.reduce((a, b) => a + b.amount, 0);
        const rests = r.cafes.filter((id) => id.startsWith('rest:')).map((id) => ({ atKm: Number(id.slice(5)), wc: true }));
        p.onFinish(ev
          ? { refuelL: 0, detourKm: 0, charges: r.refuels.map((x) => ({ atKm: Number(x.at.split(':')[1]) || 0, kwh: x.amount })), rests }
          : { refuelL: Math.round(total * 10) / 10, detourKm: 0, rests });
      }} />
  );
}
