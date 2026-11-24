// Đi phượt bằng xe máy: chọn cung đường, chọn xe (xe của mình hoặc thuê tại chỗ), lái, nhận tem sổ phượt.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import type { PhuotCheckpoint, PhuotRoute, PhuotTheme, WeatherSpan } from '../../shared/moto.ts';
import { WEATHER_ICON } from '../../shared/moto.ts';
import { CONVOY_MAX, normCode } from '../../shared/convoy.ts';
import type { ConvoyInvite, ConvoyView } from '../../shared/convoy.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import { MotoRide } from './drive/MotoRide.tsx';
import type { MotoRideResult } from './drive/MotoRide.tsx';
import type { MotoStyle } from './drive/MotoParts.ts';
import './vehicles.css';
import './phuot.css';

interface BikeOut { kind: string; name: string; emoji: string; moto: MotoStyle; cc: number | null; kw: number | null; power: string; unit: string; tank: number; per100: number; maxKmh: number; cargoKg: number; license: string; licenseName: string; price: number }
interface OwnBike extends BikeOut { id: number; energy: number; odoKm: number; active: boolean; canRide: boolean }
interface Rental extends BikeOut { perDay: number; canRide: boolean }
interface RouteOut extends PhuotRoute { seconds: number; stamps: { cpId: string; at: number }[]; done: { firstAt: number; times: number } | null; photos: number; forecast: { month: number; rain: number; fog: number } | null }
interface PhuotData { energy: number; energyMax: number; rules: { cafeCost: number; cafeEnergy: number; energyPer10Km: number; firstFinishReward: number }; licenses: string[]; bikes: OwnBike[]; rentals: Rental[]; routes: RouteOut[]; open: { tripId: number; routeId: string } | null }
interface Started { tripId: number; route: RouteOut; bike: BikeOut; rented: boolean; rentCost: number; fuel: number; fuelNeed: number; fuelPrice: number; weather: WeatherSpan[]; raincoat: { cost: number }; convoyId: number | null }
interface Finished { wetLost: number; coatCost: number; convoyBonusXp: number; convoyTogether: number; convoyWaiting: boolean; kmDone: number; aborted: boolean; fuelUsed: number; refuel: number; fuelCost: number; rescue: number; cafes: number; cafeCost: number; energyLost: number; energyBack: number; freshStamps: string[]; firstFinish: boolean; reward: number; unit: string; xpGained?: number; levelUp?: boolean; level?: number }

const THEME_NAME: Record<PhuotTheme, string> = { karst: 'Cao nguyên đá, đèo núi', pass_sea: 'Đèo ven biển', coast: 'Cung đường biển' };
const hex = (s: string | undefined, fb: number) => (s && /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : fb);
const KIND_ICON: Record<PhuotCheckpoint['kind'], string> = { photo: '📸', fuel: '⛽', cafe: '☕' };
/** Chế độ thử tăng tốc: chỉ khi trang có ?nhanh=1 (máy chủ chỉ chấp nhận với tài khoản thử). */
const FAST = typeof location !== 'undefined' && new URLSearchParams(location.search).get('nhanh') === '1';
/** Kiểm thử: ép thời tiết (?troi=mua|suong|nang|doi), máy chủ chỉ nhận với tài khoản thử. */
const FORCE_WX = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('troi') : null;
const pct = (x: number) => `${Math.round(x * 100)}%`;
function forecastText(f: RouteOut['forecast']): string {
  if (!f) return '';
  const tag = f.rain >= 0.4 ? 'mùa mưa, rất hay mưa' : f.rain >= 0.15 ? 'có thể gặp mưa' : 'ít mưa';
  return `Tháng ${f.month}: ${tag} (khả năng mưa ${pct(f.rain)}${f.fog > 0.05 ? `, sương mù ${pct(f.fog)}` : ''})`;
}

/** Đi đoàn: lập đoàn, mời bạn, vào bằng mã, sẵn sàng, trưởng đoàn cho xuất phát. */
function ConvoyBox({ route, convoy, pick, me, busy, run, friends }: {
  route: RouteOut; convoy: ConvoyView | null; pick: string; me: Me; busy: boolean; run: (f: () => Promise<unknown>) => void; friends: { userId: number; displayName: string }[];
}): JSX.Element {
  const [code, setCode] = useState('');
  const mine = convoy && convoy.routeId === route.id ? convoy : null;
  if (!mine) return (
    <div className="phuot-convoy">
      <strong>👥 Đi đoàn</strong>
      {convoy && <small className="muted">Bạn đang ở một đoàn trên cung đường khác. Lập đoàn mới ở đây sẽ rời đoàn kia.</small>}
      <div className="phuot-row">
        <button type="button" disabled={busy} onClick={() => run(() => api('POST', '/api/convoys', { routeId: route.id }))}>Lập đoàn mới</button>
        <input aria-label="Mã đoàn" placeholder="Mã đoàn" value={code} maxLength={8} onChange={(e) => setCode(normCode(e.target.value))} />
        <button type="button" disabled={busy || code.length < 6} onClick={() => run(() => api('POST', '/api/convoys/join', { code }))}>Vào đoàn</button>
      </div>
      <small className="muted">Tối đa {CONVOY_MAX} xe. Cả đoàn xuất phát cùng lúc, tập trung ở điểm chụp ảnh và quán; về đích cùng nhau được thêm 50% EXP chuyến.</small>
    </div>
  );
  const leader = mine.leaderId === me.user.id, meRow = mine.members.find((m) => m.me);
  const invitable = friends.filter((f) => !mine.members.some((m) => m.userId === f.userId) && !mine.invited.some((i) => i.userId === f.userId));
  return (
    <div className="phuot-convoy on">
      <strong>👥 Đoàn {mine.code}{mine.status === 'chay' ? ' · đang chạy' : ''}</strong>
      <ul className="phuot-members">
        {mine.members.map((m) => <li key={m.userId}><i style={{ background: m.color }} aria-hidden="true" />{m.name}{m.leader ? ' (trưởng đoàn)' : ''}{m.me ? ' · bạn' : ''} <small>{m.ready ? '✓ sẵn sàng' : 'chưa chọn xe'}</small></li>)}
        {mine.invited.map((i) => <li key={`i${i.userId}`} className="muted"><i aria-hidden="true" />{i.name} <small>đã mời, chờ nhận lời</small></li>)}
      </ul>
      {mine.status === 'lap' && <>
        <small className="muted">Gửi mã <b>{mine.code}</b> cho người cùng tuyến để họ vào đoàn.</small>
        {leader && invitable.length > 0 && <div className="phuot-row">{invitable.slice(0, 6).map((f) => <button key={f.userId} type="button" disabled={busy} onClick={() => run(() => api('POST', `/api/convoys/${mine.id}/invite`, { userId: f.userId }))}>Mời {f.displayName}</button>)}</div>}
        <div className="phuot-row">
          <button type="button" disabled={busy || (!pick && !meRow?.ready)} onClick={() => run(() => api('POST', `/api/convoys/${mine.id}/ready`, { pick: meRow?.ready && !pick ? '' : pick }))}>{meRow?.ready ? (pick ? 'Đổi xe đã chọn' : 'Bỏ sẵn sàng') : pick ? '✓ Sẵn sàng với xe đã chọn' : 'Chọn xe ở trên trước'}</button>
          {leader && <button type="button" className="go" disabled={busy || mine.members.length < 2 || !meRow?.ready} onClick={() => run(() => api('POST', `/api/convoys/${mine.id}/start`))}>🏁 Cả đoàn xuất phát</button>}
          <button type="button" className="ghost" disabled={busy} onClick={() => run(() => api('POST', `/api/convoys/${mine.id}/leave`))}>Rời đoàn</button>
        </div>
        {leader && mine.members.length < 2 && <small className="muted">Cần ít nhất 2 xe để xuất phát.</small>}
      </>}
    </div>
  );
}

export function PhuotPanel({ me, refresh, openGarage }: { me: Me; refresh: () => void; openGarage?: () => void }): JSX.Element {
  const [data, setData] = useState<PhuotData | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<string>('');
  const [ride, setRide] = useState<Started | null>(null);
  const [done, setDone] = useState<{ route: RouteOut; r: Finished } | null>(null);
  const [team, setTeam] = useState<{ convoy: ConvoyView | null; invites: ConvoyInvite[] }>({ convoy: null, invites: [] });
  const [friends, setFriends] = useState<{ userId: number; displayName: string }[]>([]);
  const load = useCallback(() => api<PhuotData>('GET', '/api/phuot').then(setData).catch(() => setData(null)), []);
  const loadTeam = useCallback(() => api<{ convoy: ConvoyView | null; invites: ConvoyInvite[] }>('GET', '/api/convoys/mine').then(setTeam).catch(() => undefined), []);
  useEffect(() => { void load(); void loadTeam(); api<{ friends: { userId: number; displayName: string }[] }>('GET', '/api/friends').then((r) => setFriends(r.friends ?? [])).catch(() => undefined); }, [load, loadTeam]);
  // đang trong đoàn chưa chạy: hỏi lại mỗi 3 giây để thấy người mới vào và lệnh xuất phát của trưởng đoàn
  useEffect(() => {
    if (ride || (team.convoy?.status !== 'lap' && !team.invites.length)) return;
    const t = window.setInterval(() => { if (!document.hidden) void loadTeam(); }, 3000);
    return () => window.clearInterval(t);
  }, [ride, team.convoy?.status, team.invites.length, loadTeam]);
  const act = useAction(() => { void load(); void loadTeam(); refresh(); });
  const teamRun = (f: () => Promise<unknown>) => act.run(async () => { await f(); await loadTeam(); });
  const startWith = async (route: RouteOut, chosen: string, convoyId?: number) => {
    const own = chosen.startsWith('xe:') ? Number(chosen.slice(3)) : null, rent = chosen.startsWith('thue:') ? chosen.slice(5) : null;
    if (!own && !rent) throw new Error('Hãy chọn xe: xe của bạn hoặc thuê xe tại chỗ.');
    const s = await api<Started>('POST', '/api/phuot/start', { routeId: route.id, ...(own ? { vehicleId: own } : { rent }), ...(convoyId ? { convoyId } : {}), ...(FORCE_WX ? { thoiTiet: FORCE_WX } : {}) });
    setRide({ ...s, route: { ...route, ...s.route } });
  };
  const start = (route: RouteOut) => act.run(() => startWith(route, pick));
  // trưởng đoàn đã cho xuất phát: máy mình tự lên đường với xe đã chọn (một lần cho mỗi đoàn)
  const autoStarted = useRef<number | null>(null);
  useEffect(() => {
    const c = team.convoy, d = data;
    if (!c || c.status !== 'chay' || ride || !d || autoStarted.current === c.id) return;
    const me1 = c.members.find((m) => m.me);
    if (!me1 || me1.finished || me1.km > 0) return;
    const route = d.routes.find((r) => r.id === c.routeId), chosen = c.myPick ?? pick;
    if (!route) return;
    autoStarted.current = c.id;
    void act.run(() => startWith(route, chosen, c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.convoy?.status, team.convoy?.id, ride, data]);
  if (!data) return <p className="hint">Đang mở bản đồ phượt…</p>;
  const hasA = data.licenses.length > 0;


  const finish = async (r: MotoRideResult) => {
    const cur = ride; setRide(null); if (!cur) return;
    await act.run(async () => {
      const f = await api<Finished>('POST', `/api/phuot/${cur.tripId}/finish`, { aborted: r.aborted, km: r.kmDone, photos: r.photos, cafes: r.cafes, refuels: r.refuels, raincoat: r.raincoat, ...(FAST ? { nhanh: true } : {}) });
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
      {team.invites.map((iv) => (
        <div className="veh-card on" key={iv.convoyId} role="status">
          <strong>👥 {iv.leader} mời bạn đi đoàn: {data.routes.find((r) => r.id === iv.routeId)?.name ?? iv.routeId}</strong>
          <small>Đoàn {iv.code} · {iv.members} xe</small>
          <div className="phuot-row"><button type="button" className="go" disabled={act.busy} onClick={() => { setOpen(iv.routeId); teamRun(() => api('POST', `/api/convoys/${iv.convoyId}/accept`)); }}>Vào đoàn</button>
            <button type="button" className="ghost" disabled={act.busy} onClick={() => teamRun(() => api('POST', `/api/convoys/${iv.convoyId}/decline`))}>Từ chối</button></div>
        </div>))}
      {done && (
        <div className="veh-card on" role="status">
          <strong>{done.r.aborted ? '🛑 Đã dừng chuyến' : `🏁 Đã đi ${done.route.name}`}</strong>
          <small>{done.r.kmDone} km · xăng hết {done.r.fuelUsed} {done.r.unit}{done.r.fuelCost ? ` · đổ ${fmtMoney(done.r.fuelCost)}` : ''}{done.r.rescue ? ` · chở xăng cứu hộ ${fmtMoney(done.r.rescue)}` : ''}{done.r.cafeCost ? ` · quán ${fmtMoney(done.r.cafeCost)}` : ''}</small>
          {(done.r.wetLost > 0 || done.r.coatCost > 0) && <small>{done.r.coatCost > 0 ? `🧥 Áo mưa ${fmtMoney(done.r.coatCost)}` : ''}{done.r.wetLost > 0 ? `${done.r.coatCost > 0 ? ' · ' : ''}🌧️ Dầm mưa mất thêm ${done.r.wetLost} thể lực` : ''}</small>}
          {(done.r.convoyBonusXp > 0 || done.r.convoyWaiting) && <small>{done.r.convoyBonusXp > 0 ? `👥 Cả đoàn ${done.r.convoyTogether} xe về đích cùng nhau: +${done.r.convoyBonusXp} EXP` : '👥 Đang chờ cả đoàn về đích để tính thưởng đi đoàn.'}</small>}
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
                <small>Tem {photos.filter((c) => got.has(c.id)).length}/{photos.length}{r.done ? ` · đã đi ${r.done.times} lần` : ''}{team.convoy?.routeId === r.id ? ` · 👥 đoàn ${team.convoy.code}` : ''}</small></div>
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
                {r.forecast && <small className="phuot-fc">{r.forecast.rain >= 0.15 ? WEATHER_ICON.mua : r.forecast.fog >= 0.2 ? WEATHER_ICON.suong : WEATHER_ICON.nang} {forecastText(r.forecast)}. Trời mưa đường trơn: vào cua chậm hơn, phanh dài hơn; mua áo mưa ở quán để đỡ mất sức.</small>}
                <small className="muted">Cần {r.minEnergy} thể lực (đang có {data.energy}). Đi đèo mất khoảng {Math.round(r.km / 10 * data.rules.energyPer10Km)} thể lực; ghé quán hồi {data.rules.cafeEnergy}. Lần đầu đi trọn tuyến thưởng {fmtMoney(data.rules.firstFinishReward)}.</small>
                {team.convoy?.routeId !== r.id && <button type="button" className="go wide" disabled={act.busy || !pick || data.energy < r.minEnergy} onClick={() => start(r)}>{data.energy < r.minEnergy ? 'Chưa đủ thể lực' : '🏍️ Lên đường một mình'}</button>}
                <ConvoyBox route={r} convoy={team.convoy} pick={pick} me={me} busy={act.busy} friends={friends}
                  run={(f) => teamRun(f)} />
              </>
            )}
          </div>);
      })}
      {ride && (
        <MotoRide mode="phuot" presenceKey={`phuot:${ride.route.id}`} cafe={{ cost: data.rules.cafeCost, energy: data.rules.cafeEnergy }}
          weather={ride.weather} raincoatCost={ride.raincoat?.cost} convoyId={ride.convoyId ?? undefined}
          route={{ title: ride.route.name, startName: ride.route.startName, endName: ride.route.endName, km: ride.route.km, theme: ride.route.theme, twisty: ride.route.twisty, seconds: ride.route.seconds, stops: ride.route.checkpoints }}
          bike={{ name: ride.bike.name, style: ride.bike.moto, tank: ride.bike.tank, per100: ride.bike.per100, unit: ride.bike.unit, maxKmh: ride.bike.maxKmh, fuel: ride.fuel, price: ride.fuelPrice, color: hex(me.user.avatar?.truck, 0xc0392b) }}
          shirt={hex(me.user.avatar?.shirt, 0x2f7fd8)} onDone={(r) => void finish(r)} />
      )}
    </div>);
}
