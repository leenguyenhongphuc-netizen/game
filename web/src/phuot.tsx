// Đi phượt bằng xe máy: chọn cung đường, chọn xe (xe của mình hoặc thuê tại chỗ), lái, nhận tem sổ phượt.
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import type { PhuotCheckpoint, PhuotRoute, PhuotTheme } from '../../shared/moto.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import { MotoRide } from './drive/MotoRide.tsx';
import type { MotoRideResult } from './drive/MotoRide.tsx';
import type { MotoStyle } from './drive/MotoParts.ts';
import './vehicles.css';

interface BikeOut { kind: string; name: string; emoji: string; moto: MotoStyle; cc: number | null; kw: number | null; power: string; unit: string; tank: number; per100: number; maxKmh: number; cargoKg: number; license: string; licenseName: string; price: number }
interface OwnBike extends BikeOut { id: number; energy: number; odoKm: number; active: boolean; canRide: boolean }
interface Rental extends BikeOut { perDay: number; canRide: boolean }
interface RouteOut extends PhuotRoute { seconds: number; stamps: { cpId: string; at: number }[]; done: { firstAt: number; times: number } | null; photos: number }
interface PhuotData { energy: number; energyMax: number; rules: { cafeCost: number; cafeEnergy: number; energyPer10Km: number; firstFinishReward: number }; licenses: string[]; bikes: OwnBike[]; rentals: Rental[]; routes: RouteOut[]; open: { tripId: number; routeId: string } | null }
interface Started { tripId: number; route: RouteOut; bike: BikeOut; rented: boolean; rentCost: number; fuel: number; fuelNeed: number; fuelPrice: number }
interface Finished { kmDone: number; aborted: boolean; fuelUsed: number; refuel: number; fuelCost: number; rescue: number; cafes: number; cafeCost: number; energyLost: number; energyBack: number; freshStamps: string[]; firstFinish: boolean; reward: number; unit: string; xpGained?: number; levelUp?: boolean; level?: number }

const THEME_NAME: Record<PhuotTheme, string> = { karst: 'Cao nguyên đá, đèo núi', pass_sea: 'Đèo ven biển', coast: 'Cung đường biển' };
const hex = (s: string | undefined, fb: number) => (s && /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : fb);
const KIND_ICON: Record<PhuotCheckpoint['kind'], string> = { photo: '📸', fuel: '⛽', cafe: '☕' };

export function PhuotPanel({ me, refresh, openGarage }: { me: Me; refresh: () => void; openGarage?: () => void }): JSX.Element {
  const [data, setData] = useState<PhuotData | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<string>('');
  const [ride, setRide] = useState<Started | null>(null);
  const [done, setDone] = useState<{ route: RouteOut; r: Finished } | null>(null);
  const load = useCallback(() => api<PhuotData>('GET', '/api/phuot').then(setData).catch(() => setData(null)), []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  if (!data) return <p className="hint">Đang mở bản đồ phượt…</p>;
  const hasA = data.licenses.length > 0;

  const start = (route: RouteOut) => act.run(async () => {
    const own = pick.startsWith('xe:') ? Number(pick.slice(3)) : null, rent = pick.startsWith('thue:') ? pick.slice(5) : null;
    if (!own && !rent) throw new Error('Hãy chọn xe: xe của bạn hoặc thuê xe tại chỗ.');
    const s = await api<Started>('POST', '/api/phuot/start', own ? { routeId: route.id, vehicleId: own } : { routeId: route.id, rent });
    setRide({ ...s, route: { ...route, ...s.route } });
  });
  const finish = async (r: MotoRideResult) => {
    const cur = ride; setRide(null); if (!cur) return;
    await act.run(async () => {
      const f = await api<Finished>('POST', `/api/phuot/${cur.tripId}/finish`, { aborted: r.aborted, km: r.kmDone, photos: r.photos, cafes: r.cafes, refuels: r.refuels });
      setDone({ route: cur.route, r: f });
    });
  };

  return (
    <div className="phuot">
      <p className="muted">Xe máy không được vào cao tốc nên đi phượt theo quốc lộ, đường đèo: chậm hơn nhưng nhiều cảnh. Dừng ở các điểm ngắm cảnh để chụp ảnh nhận tem sổ phượt, đổ xăng ở cây xăng, ghé quán nghỉ chân lấy lại sức. Vào cua quá nhanh là trượt ngã.</p>
      {!hasA && (
        <p className="veh-tip">Bạn chưa có bằng lái xe máy. Thi bằng <b>A1</b> (xe đến 125 cm³) hoặc <b>A</b> (xe trên 125 cm³) ở Bãi xe → Bằng lái: lý thuyết rồi sa hình 4 bài (hình số 8, đường thẳng, vạch cản, đường gồ ghề). Thuê xe cũng phải có bằng.
          {openGarage && <> <button type="button" className="link" onClick={openGarage}>Mở Bãi xe</button></>}</p>
      )}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {done && (
        <div className="veh-card on" role="status">
          <strong>{done.r.aborted ? '🛑 Đã dừng chuyến' : `🏁 Đã đi ${done.route.name}`}</strong>
          <small>{done.r.kmDone} km · xăng hết {done.r.fuelUsed} {done.r.unit}{done.r.fuelCost ? ` · đổ ${fmtMoney(done.r.fuelCost)}` : ''}{done.r.rescue ? ` · chở xăng cứu hộ ${fmtMoney(done.r.rescue)}` : ''}{done.r.cafeCost ? ` · quán ${fmtMoney(done.r.cafeCost)}` : ''}</small>
          <small>Thể lực −{done.r.energyLost}{done.r.energyBack ? ` +${done.r.energyBack}` : ''}{done.r.freshStamps.length ? ` · ${done.r.freshStamps.length} tem mới` : ''}{done.r.firstFinish ? ` · lần đầu đi trọn tuyến +${fmtMoney(done.r.reward)}` : ''}{done.r.xpGained ? ` · +${done.r.xpGained} EXP` : ''}</small>
          <button type="button" onClick={() => setDone(null)}>Đóng</button>
        </div>
      )}
      {data.routes.map((r) => {
        const isOpen = open === r.id, got = new Set(r.stamps.map((s) => s.cpId)), photos = r.checkpoints.filter((c) => c.kind === 'photo');
        return (
          <div className={`veh-card${r.done ? ' owned' : ''}`} key={r.id}>
            <button type="button" className="veh-head toggle" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : r.id); setPick(''); }}>
              <span className="phuot-ico" aria-hidden="true">{r.theme === 'karst' ? '⛰️' : r.theme === 'pass_sea' ? '🌄' : '🏖️'}</span>
              <div><strong>{r.name}</strong><small>{r.province} · {r.startName} → {r.endName} · {r.km} km · {THEME_NAME[r.theme]}</small>
                <small>Tem {photos.filter((c) => got.has(c.id)).length}/{photos.length}{r.done ? ` · đã đi ${r.done.times} lần` : ''}</small></div>
            </button>
            {isOpen && (
              <>
                <p className="veh-tip">{r.advice}</p>
                <ol className="phuot-cps">
                  {r.checkpoints.map((c) => <li key={c.id} className={got.has(c.id) ? 'done' : ''}><span aria-hidden="true">{KIND_ICON[c.kind]}</span> <b>Km {c.atKm}</b> {c.name}{got.has(c.id) ? ' ✓' : ''}</li>)}
                </ol>
                <fieldset className="phuot-bikes">
                  <legend>Chọn xe</legend>
                  {data.bikes.map((b) => (
                    <label key={b.id} className={b.canRide ? '' : 'off'}>
                      <input type="radio" name={`xe-${r.id}`} value={`xe:${b.id}`} checked={pick === `xe:${b.id}`} disabled={!b.canRide} onChange={() => setPick(`xe:${b.id}`)} />
                      <span>{b.emoji} {b.name} của bạn · {b.energy.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/{b.tank} {b.unit}{!b.canRide ? ` · cần ${b.licenseName}` : ''}</span>
                    </label>
                  ))}
                  {data.rentals.map((b) => (
                    <label key={b.kind} className={b.canRide ? '' : 'off'}>
                      <input type="radio" name={`xe-${r.id}`} value={`thue:${b.kind}`} checked={pick === `thue:${b.kind}`} disabled={!b.canRide} onChange={() => setPick(`thue:${b.kind}`)} />
                      <span>Thuê {b.emoji} {b.name} · {fmtMoney(b.perDay)}/ngày · đầy bình{!b.canRide ? ` · cần ${b.licenseName}` : ''}</span>
                    </label>
                  ))}
                </fieldset>
                <small className="muted">Cần {r.minEnergy} thể lực (đang có {data.energy}). Đi đèo mất khoảng {Math.round(r.km / 10 * data.rules.energyPer10Km)} thể lực; ghé quán hồi {data.rules.cafeEnergy}. Lần đầu đi trọn tuyến thưởng {fmtMoney(data.rules.firstFinishReward)}.</small>
                <button type="button" className="go wide" disabled={act.busy || !pick || data.energy < r.minEnergy} onClick={() => start(r)}>{data.energy < r.minEnergy ? 'Chưa đủ thể lực' : '🏍️ Lên đường'}</button>
              </>
            )}
          </div>);
      })}
      {ride && (
        <MotoRide mode="phuot" presenceKey={`phuot:${ride.route.id}`} cafe={{ cost: data.rules.cafeCost, energy: data.rules.cafeEnergy }}
          route={{ title: ride.route.name, startName: ride.route.startName, endName: ride.route.endName, km: ride.route.km, theme: ride.route.theme, twisty: ride.route.twisty, seconds: ride.route.seconds, stops: ride.route.checkpoints }}
          bike={{ name: ride.bike.name, style: ride.bike.moto, tank: ride.bike.tank, per100: ride.bike.per100, unit: ride.bike.unit, maxKmh: ride.bike.maxKmh, fuel: ride.fuel, price: ride.fuelPrice, color: hex(me.user.avatar?.truck, 0xc0392b) }}
          shirt={hex(me.user.avatar?.shirt, 0x2f7fd8)} onDone={(r) => void finish(r)} />
      )}
    </div>);
}
