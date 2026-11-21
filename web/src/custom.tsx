// Cá nhân hoá: nhà và cổng, gian hàng, nhân vật, đồ trang trí sân vườn.
import { useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  AWNING_COLORS, DECOR_ITEMS, DECOR_MAX, DEFAULT_AVATAR, DEFAULT_STYLE, FENCE_STYLES, HATS, HOUSE_TYPES, ROOF_COLORS, SHIRT_COLORS,
  TRUCK_COLORS, WALL_COLORS,
} from '../../shared/custom.ts';
import type { Avatar, DecorPlacement, PlotStyle } from '../../shared/custom.ts';
import { fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { LotView, Me } from './api.ts';
import type { World } from './scene/World.ts';
import { useAction } from './ui.ts';

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatch-row"><span>{label}</span>
      <div className="swatches">{colors.map((c) => <button key={c} type="button" className="swatch" aria-label={`${label} ${c}`} aria-pressed={c === value} style={{ background: c }} onClick={() => onPick(c)} />)}</div>
    </div>
  );
}

export function CustomizePanel({ me, home, worldRef, atHome, onChanged }: { me: Me; home: LotView | null; worldRef: MutableRefObject<World | null>; atHome: boolean; onChanged: () => void }) {
  const [tab, setTab] = useState<'nha' | 'sap' | 'nguoi' | 'san'>('nha');
  const [style, setStyle] = useState<PlotStyle>({ ...DEFAULT_STYLE, ...(home?.plot.style ?? {}) });
  const [avatar, setAvatar] = useState<Avatar>({ ...DEFAULT_AVATAR, ...(me.user.avatar ?? {}) });
  const decor: DecorPlacement[] = home?.plot.decor ?? [];
  const act = useAction(onChanged);
  if (!home) return <p className="hint">Đang tải…</p>;
  const owned = new Set(home.plot.ownedHouses ?? []);
  const saveStyle = (next: PlotStyle) => { setStyle(next); void act.run(() => api('POST', `/api/plots/${home.plot.id}/style`, next)); };
  const saveAvatar = (next: Avatar) => { setAvatar(next); void act.run(() => api('POST', '/api/avatar', next)); };
  const saveDecor = (items: DecorPlacement[]) => act.run(() => api('POST', `/api/plots/${home.plot.id}/decor`, { items }));

  return (
    <div>
      <div className="tabs">
        <button aria-selected={tab === 'nha'} onClick={() => setTab('nha')}>Nhà & cổng</button>
        <button aria-selected={tab === 'sap'} onClick={() => setTab('sap')}>Gian hàng</button>
        <button aria-selected={tab === 'nguoi'} onClick={() => setTab('nguoi')}>Nhân vật</button>
        <button aria-selected={tab === 'san'} onClick={() => setTab('san')}>Sân vườn</button>
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}

      {tab === 'nha' && (
        <div className="custom">
          <label>Tên vườn trên cổng
            <input value={style.gateName} maxLength={24} placeholder="Ví dụ: Vườn Chú Tư" onChange={(e) => setStyle({ ...style, gateName: e.target.value })} onBlur={() => saveStyle(style)} />
          </label>
          <div className="pick-row">
            {HOUSE_TYPES.map((h) => (
              <button key={h.id} type="button" className="pick" aria-pressed={style.house === h.id} disabled={act.busy || (!owned.has(h.id) && h.price > me.user.cash && style.house !== h.id)} onClick={() => saveStyle({ ...style, house: h.id })}>
                <strong>{h.name}</strong><small>{h.price === 0 || owned.has(h.id) ? 'Đã có' : fmtMoney(h.price)}</small>
              </button>
            ))}
          </div>
          <Swatches label="Màu tường" colors={WALL_COLORS} value={style.wall} onPick={(c) => saveStyle({ ...style, wall: c })} />
          <Swatches label="Màu mái" colors={ROOF_COLORS} value={style.roof} onPick={(c) => saveStyle({ ...style, roof: c })} />
          <div className="pick-row">
            {FENCE_STYLES.map((f) => <button key={f.id} type="button" className="pick" aria-pressed={style.fence === f.id} disabled={act.busy} onClick={() => saveStyle({ ...style, fence: f.id })}><strong>Rào {f.name.toLowerCase()}</strong></button>)}
          </div>
        </div>
      )}

      {tab === 'sap' && (
        <div className="custom">
          <label>Biển hiệu gian hàng
            <input value={style.stallName} maxLength={24} placeholder="Ví dụ: Sạp Xoài Cô Ba" onChange={(e) => setStyle({ ...style, stallName: e.target.value })} onBlur={() => saveStyle(style)} />
          </label>
          <Swatches label="Màu mái che" colors={AWNING_COLORS} value={style.awning} onPick={(c) => saveStyle({ ...style, awning: c })} />
          <p className="muted">Hàng bày trên sạp là các món bạn đang rao bán. Tên trên biển hiệu và cổng ai ghé thăm cũng thấy, nên hãy đặt lịch sự.</p>
        </div>
      )}

      {tab === 'nguoi' && (
        <div className="custom">
          <Swatches label="Màu áo" colors={SHIRT_COLORS} value={avatar.shirt} onPick={(c) => saveAvatar({ ...avatar, shirt: c })} />
          <div className="pick-row">
            {HATS.map((h) => <button key={h.id} type="button" className="pick" aria-pressed={avatar.hat === h.id} disabled={act.busy} onClick={() => saveAvatar({ ...avatar, hat: h.id })}><strong>{h.name}</strong></button>)}
          </div>
          {me.user.role === 'thuong_lai' && <Swatches label="Màu xe tải" colors={TRUCK_COLORS} value={avatar.truck} onPick={(c) => saveAvatar({ ...avatar, truck: c })} />}
        </div>
      )}

      {tab === 'san' && (
        <div className="custom">
          <p className="muted">Đi tới chỗ muốn đặt trong sân nhà, mở lại màn này rồi chọn món: món đồ sẽ nằm ngay chỗ nhân vật đang đứng. Tối đa {DECOR_MAX} món; gỡ đi không được hoàn tiền.</p>
          {!atHome && <p className="error">Bạn cần đang ở vườn nhà để đặt đồ.</p>}
          <div className="pick-row">
            {DECOR_ITEMS.map((d) => (
              <button key={d.id} type="button" className="pick" disabled={act.busy || !atHome || decor.length >= DECOR_MAX || me.user.cash < d.price}
                onClick={() => {
                  const p = worldRef.current?.position(); if (!p) return;
                  void saveDecor([...decor, { item: d.id, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, rot: 0 }]);
                }}>
                <span className="emoji">{d.emoji}</span><strong>{d.name}</strong><small>{fmtMoney(d.price)}</small>
              </button>
            ))}
          </div>
          <h3>Đã đặt ({decor.length}/{DECOR_MAX})</h3>
          {decor.length === 0 && <p className="hint">Sân chưa có món trang trí nào.</p>}
          {decor.map((d, i) => {
            const item = DECOR_ITEMS.find((x) => x.id === d.item);
            return (
              <div className="row-line" key={i}>
                <span className="emoji">{item?.emoji}</span><div className="grow">{item?.name}</div>
                <button disabled={act.busy} onClick={() => saveDecor(decor.map((x, j) => (j === i ? { ...x, rot: (x.rot + Math.PI / 2) % (Math.PI * 2) } : x)))}>Xoay</button>
                <button disabled={act.busy} onClick={() => saveDecor(decor.filter((_, j) => j !== i))}>Gỡ</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
