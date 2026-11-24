// Thẻ phương án lộ trình nhiều chặng (bộ lập lộ trình trong shared/rules.ts: travelOptions).
// Dùng ở thẻ Các vùng trồng (bản đồ) và ở thẻ Tham quan ("Lên kế hoạch đi" tới tỉnh có địa danh).
import { useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../shared/catalog.ts';
import { LEG_MODES, TRAVEL_MODES, fmtMoney, travelOptions } from '../../shared/rules.ts';
import type { TravelLeg, TravelMode, TravelOption } from '../../shared/rules.ts';
import './travelPlans.css';

const hoursText = (h: number) => (h < 1 ? `${Math.round(h * 60)} phút` : `${h.toLocaleString('vi-VN')} giờ`);
const kmText = (l: TravelLeg) => `${l.km.toLocaleString('vi-VN')} km`;
const TAG: Record<'nhanh' | 're', string> = { nhanh: '⚡ Nhanh nhất', re: '💰 Rẻ nhất' };

/** Một chặng: "✈️ Máy bay · sân bay Liên Khương → sân bay Nội Bài · 1.088 km · 1.797.000đ". */
function LegRow({ l }: { l: TravelLeg }): JSX.Element {
  const m = LEG_MODES[l.mode];
  return (
    <li className={`tp-leg ${l.mode}`}>
      <span className="tp-leg-ic" aria-hidden="true">{m.icon}</span>
      <span className="tp-leg-txt"><b>{m.name}</b> {l.from} → {l.to}<small>{kmText(l)} · {hoursText(Math.max(0.1, Math.round(l.hours * 10) / 10))} · {fmtMoney(l.fare)}</small></span>
    </li>
  );
}

/** Danh sách phương án: mỗi phương án một thẻ có chuỗi biểu tượng các chặng, giờ, giá; chạm "Xem chặng" để mở từng chặng. */
export function TravelPlanCards({ options, cash, busy, onPick, pickLabel = 'Đi' }: {
  options: TravelOption[]; cash: number; busy?: boolean; onPick?: (o: TravelOption) => void; pickLabel?: string;
}): JSX.Element {
  const [open, setOpen] = useState<TravelMode | null>(null);
  if (!options.length) return <p className="muted">Không có phương tiện công cộng nào đi tới đây.</p>;
  return (
    <ul className="tp-list">
      {options.map((o) => {
        const poor = cash < o.fare, isOpen = open === o.mode;
        return (
          <li key={o.mode} className={`tp-card${o.tags?.length ? ' tagged' : ''}`} data-mode={o.mode}>
            <div className="tp-top">
              <span className="tp-ic" aria-hidden="true">{TRAVEL_MODES[o.mode].icon}</span>
              <span className="tp-name"><strong>{TRAVEL_MODES[o.mode].name}</strong>{o.tags?.map((t) => <em key={t} className={`tp-tag ${t}`}>{TAG[t]}</em>)}</span>
              <span className="tp-sum"><b>{fmtMoney(o.fare)}</b><small>{hoursText(o.hours)}</small></span>
            </div>
            <div className="tp-chain" aria-label={`Các chặng: ${o.legs.map((l) => LEG_MODES[l.mode].name).join(', ')}`}>
              {o.legs.map((l, k) => (
                <span key={k} className="tp-chip">{k > 0 && <i aria-hidden="true">›</i>}<span aria-hidden="true">{LEG_MODES[l.mode].icon}</span>{l.mode === 'may_bay' || l.mode === 'tau_hoa' || l.mode === 'tau_thuy' ? l.to.replace(/^(sân bay|ga) /, '') : kmText(l)}</span>
              ))}
            </div>
            {o.via && <small className="tp-via">{o.via}</small>}
            {isOpen && <ol className="tp-legs">{o.legs.map((l, k) => <LegRow key={k} l={l} />)}</ol>}
            <div className="tp-act">
              {o.legs.length > 1 && <button type="button" className="ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.mode)}>{isOpen ? 'Ẩn chặng' : `Xem ${o.legs.length} chặng`}</button>}
              {onPick && <button type="button" className="go" disabled={busy || poor} onClick={() => onPick(o)}>{poor ? 'Không đủ tiền' : `${pickLabel} · ${fmtMoney(o.fare)}`}</button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Lên kế hoạch tới một vùng (đi từ vùng nhà như vé du lịch). `onTravel` mua vé rồi chiếu hoạt cảnh; thiếu thì chỉ xem. */
export function TripPlanner({ fromRegionId, toRegionId, cash, busy, title, onTravel }: {
  fromRegionId: string; toRegionId: string; cash: number; busy?: boolean; title?: string;
  onTravel?: (o: TravelOption) => void;
}): JSX.Element {
  const to = REGIONS[toRegionId], from = REGIONS[fromRegionId];
  const options = travelOptions(fromRegionId, toRegionId);
  return (
    <div className="tp-planner">
      <p className="tp-head">🧭 {title ?? `Lộ trình từ ${from?.name ?? 'nhà'} tới ${to?.name ?? ''}, ${to?.province ?? ''}`}</p>
      <TravelPlanCards options={options} cash={cash} busy={busy} onPick={onTravel} pickLabel="Mua vé đi" />
      {!onTravel && <p className="muted">Mở thẻ Bản đồ, chọn {to?.name} để mua vé.</p>}
    </div>
  );
}
