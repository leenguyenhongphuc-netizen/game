// Phần thân thẻ điểm dừng trong khu vui chơi: cổng soát vé (mua vé), trò chơi (lên trò), khu trò chơi kỹ năng.
// SightWalk gọi khi địa danh là khu vui chơi; mọi thao tác tiền, thể lực do máy chủ kiểm.
import type { JSX } from 'react';
import { ZONE_NAMES } from '../../../shared/parks.ts';
import type { Park, ParkTicket, ParkZone } from '../../../shared/parks.ts';
import './park.css';

export interface ParkPass { ticketId: string; zones: ParkZone[]; expiresAt: number }
export interface ParkView { passes: ParkPass[]; tokens: number; tickets: number; prizes: { prizeId: string; qty: number }[]; rides: Record<string, number> }
const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
const hhmm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function covered(view: ParkView | null, zone: ParkZone): boolean { return !!view?.passes.some((p) => p.zones.includes(zone)); }

function Tickets({ park, view, zone, busy, onBuy }: { park: Park; view: ParkView | null; zone?: ParkZone; busy: boolean; onBuy: (t: ParkTicket) => void }) {
  const list = park.tickets.filter((t) => !zone || t.zones.includes(zone));
  return (
    <ul className="pk-tickets">{list.map((t) => {
      const have = !!view?.passes.some((p) => t.zones.every((z) => p.zones.includes(z)));
      return (
        <li key={t.id}><div><b>{t.name}</b><small>{t.zones.map((z) => ZONE_NAMES[z]).join(' · ')}</small></div>
          <button disabled={busy || have} onClick={() => onBuy(t)}>{have ? 'Đã có' : money(t.price)}</button></li>
      );
    })}</ul>
  );
}

export function ParkStopBody(props: {
  park: Park; stopId: string; view: ParkView | null; busy: boolean; got: boolean; energy?: number;
  onBuy: (t: ParkTicket) => void; onRide: (rideId: string) => void; onArcade: () => void; onStamp: () => void;
}): JSX.Element | null {
  const { park, stopId, view, busy } = props;
  if (stopId === 'cong_ve') {
    const has = !!view?.passes.length;
    return (
      <div className="pk-stop">
        {has && <p className="pk-pass">🎫 Vé còn hạn tới {hhmm(Math.max(...view!.passes.map((p) => p.expiresAt)))}: {[...new Set(view!.passes.flatMap((p) => p.zones))].map((z) => ZONE_NAMES[z]).join(', ')}</p>}
        <Tickets park={park} view={view} busy={busy} onBuy={props.onBuy} />
        {has && !props.got && <button className="sw-snap" onClick={props.onStamp}>🎟️ Qua cổng, đóng dấu</button>}
      </div>
    );
  }
  if (stopId === 'khu_tro_choi') return <div className="pk-stop"><button className="sw-snap" disabled={!view?.passes.length} onClick={props.onArcade}>🕹️ Vào khu trò chơi</button>{!view?.passes.length && <small className="pk-need">Cần vé vào cổng trước.</small>}</div>;
  const ride = park.rides.find((r) => r.id === stopId);
  if (!ride) return null;
  const ok = covered(view, ride.zone), tired = props.energy !== undefined && props.energy < ride.energy, times = view?.rides[ride.id] ?? 0;
  return (
    <div className="pk-stop">
      <p className="pk-meta"><span>{ride.emoji} {ZONE_NAMES[ride.zone]}</span><span>⚡ −{ride.energy}</span><span>+{ride.xp} XP</span>{ride.minHeight && <span>📏 {ride.minHeight}</span>}{times > 0 && <span>Đã chơi {times} lần</span>}</p>
      {ok ? <button className="sw-snap" disabled={busy || tired} onClick={() => props.onRide(ride.id)}>{tired ? 'Mệt rồi, ăn uống đã' : `${ride.emoji} Lên trò`}</button>
        : <><small className="pk-need">Trò này cần vé có {ZONE_NAMES[ride.zone].toLowerCase()}:</small><Tickets park={park} view={view} zone={ride.zone} busy={busy} onBuy={props.onBuy} /></>}
    </div>
  );
}
