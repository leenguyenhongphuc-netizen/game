// Lớp phủ khu trạm dừng nghỉ / cây xăng / trạm sạc: cảnh 3D riêng (StopArea) + cần điều khiển, nút hành động theo chỗ đang đứng,
// quầy cửa hàng / quán ăn. Xong lượt thì trả về lượng xăng/điện đã nạp, tiền, có đi vệ sinh không.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { StopArea } from './StopArea.ts';
import type { StopAreaInfo, StopHud, StopResult } from './StopArea.ts';

export interface StopMenuItem { id: string; name: string; emoji: string; price: number; energy: number; kind?: string; regional?: string }

const CSS = `
.sa { position: absolute; inset: 0; z-index: 30; background: #bfe4f5; }
.sa-scene { position: absolute; inset: 0; }
.sa-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); display: grid; gap: 6px; pointer-events: none; }
.sa-bar { background: #fff6dcf2; border: 3px solid #7a4a22; border-radius: 16px; box-shadow: 0 3px 0 #56310f; padding: 5px 10px; display: grid; gap: 3px; }
.sa-bar h2 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 1rem; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sa-bar .row { display: flex; gap: 8px; align-items: center; font-weight: 700; font-size: 0.8rem; font-variant-numeric: tabular-nums; flex-wrap: wrap; }
.sa-gauge { flex: 1; min-width: 70px; height: 10px; border-radius: 6px; background: #e8d6a6; border: 1.5px solid #cdb67c; overflow: hidden; }
.sa-gauge u { display: block; height: 100%; background: linear-gradient(#ffd23f, #f0a51e); text-decoration: none; transition: width 0.1s linear; }
.sa-gauge.ev u { background: linear-gradient(#6fe08f, #26a65b); }
.sa-tip { justify-self: center; max-width: 100%; background: #1f8a4c; color: #fff; border: 3px solid #fff; border-radius: 14px; padding: 4px 12px; font-weight: 700; font-size: 0.84rem; text-align: center; box-shadow: 0 3px 0 #0f5a30; }
.sa-msg { justify-self: center; max-width: 100%; background: #3b2a17e8; color: #fff; border-radius: 12px; padding: 4px 12px; font-weight: 700; font-size: 0.84rem; text-align: center; }
.sa-bottom { position: absolute; left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; pointer-events: none; }
.sa-joy { pointer-events: auto; touch-action: none; width: 128px; height: 128px; border-radius: 50%; background: #fff6dc99; border: 3px solid #7a4a22; box-shadow: 0 4px 0 #56310f; position: relative; flex: none; }
.sa-joy i { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; background: #f6e7bd; border: 3px solid #7a4a22; box-shadow: 0 3px 0 #56310f; }
.sa-joy small { position: absolute; left: 0; right: 0; bottom: -20px; text-align: center; font-weight: 700; font-size: 0.72rem; color: #3b2a17; text-shadow: 0 1px 0 #fff; }
.sa-acts { display: grid; gap: 6px; justify-items: end; min-width: 0; }
.sa-acts .grp { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.sa-btn { pointer-events: auto; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; min-height: 48px; padding: 4px 12px; border-radius: 14px; border: 3px solid #56310f; background: #f6e7bd; box-shadow: 0 4px 0 #56310f; color: #3b2a17; cursor: pointer; line-height: 1.1; font-size: 0.92rem; touch-action: none; }
.sa-btn small { display: block; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 600; font-size: 0.7rem; }
.sa-btn.go { background: #2f9d46; color: #fff; }
.sa-btn.main { background: #ffd23f; font-size: 1.02rem; min-height: 56px; }
.sa-btn.on { transform: translateY(3px); box-shadow: 0 1px 0 #56310f; filter: brightness(1.1); }
.sa-btn:disabled { opacity: 0.5; }
.sa-chip { pointer-events: auto; font: inherit; font-weight: 700; font-size: 0.78rem; min-height: 36px; padding: 2px 10px; border-radius: 18px; border: 2px solid #7a4a22; background: #fffdf4e6; color: #3b2a17; cursor: pointer; }
.sa-chip.sel { background: #ffd23f; }
.sa-shop { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100% - 20px)); max-height: calc(100% - 40px); overflow: auto; background: #fff6dc; border: 3px solid #7a4a22; border-radius: 18px; box-shadow: 0 5px 0 #56310f; padding: 12px; display: grid; gap: 8px; z-index: 2; }
.sa-shop h2 { margin: 0; text-align: center; font-family: 'Baloo 2', sans-serif; font-size: 1.15rem; }
.sa-wc { position: absolute; inset: 0; display: grid; place-items: center; background: #2f6fd055; pointer-events: none; }
.sa-wc span { background: #fff; border: 3px solid #2f6fd0; border-radius: 18px; padding: 12px 18px; font-weight: 800; font-size: 1rem; animation: sa-bob 0.6s ease-in-out infinite alternate; }
.sa .dg-foods { display: grid; gap: 5px; max-height: 46vh; overflow: auto; -webkit-overflow-scrolling: touch; }
.sa .dg-food { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 6px; align-items: center; background: #fffdf4; border: 2px solid #e3cf9a; border-radius: 12px; padding: 4px 6px 4px 8px; font-size: 0.84rem; font-weight: 700; }
.sa .dg-food b { font-size: 1.3rem; } .sa .dg-food small { display: block; font-weight: 600; font-size: 0.72rem; color: #7a6547; }
.sa .dg-food button { font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; min-height: 44px; min-width: 52px; border-radius: 12px; border: 2px solid #7a4a22; background: #f6e7bd; box-shadow: 0 3px 0 #7a4a22; cursor: pointer; color: inherit; padding: 2px 8px; }
.sa .dg-food button.eat { background: #ffd23f; } .sa .dg-food button:disabled { opacity: 0.5; }
.sa-shop .tot { display: flex; justify-content: space-between; font-weight: 800; }
@keyframes sa-bob { from { transform: translateY(-3px); } to { transform: translateY(3px); } }
@media (orientation: landscape) and (max-height: 500px) { .sa-joy { width: 112px; height: 112px; } .sa-btn { min-height: 44px; font-size: 0.86rem; } .sa-btn.main { min-height: 48px; } }
`;

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const SPOT_NAME = { shop: 'Cửa hàng tiện lợi', food: 'Quán ăn' } as const;

export function StopAreaView(props: {
  info: StopAreaInfo; fuelNames: string[]; menu: StopMenuItem[]; cash: number; bought: { itemId: string; qty: number; use: boolean }[];
  onBuy(itemId: string, use: boolean): void; onDone(r: StopResult): void; onFail(): void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null), area = useRef<StopArea | null>(null);
  const [hud, setHud] = useState<StopHud | null>(null), [shop, setShop] = useState<'shop' | 'food' | null>(null), [fuel, setFuel] = useState(props.fuelNames[0] ?? '');
  const [knob, setKnob] = useState<[number, number]>([0, 0]), [hold, setHold] = useState(false);
  const cb = useRef(props); cb.current = props;
  useEffect(() => {
    try { area.current = new StopArea(host.current!, props.info, { onHud: setHud, onDone: (r) => cb.current.onDone(r), onSpot: (s) => setShop(s) }); } catch { cb.current.onFail(); }
    return () => { area.current?.dispose(); area.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { area.current?.setFuelName(fuel); }, [fuel]);

  const joy = {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } move(e); },
    onPointerMove: (e: React.PointerEvent) => { if (e.buttons || e.pointerType === 'touch') move(e); },
    onPointerUp: () => stop(), onPointerCancel: () => stop(), onLostPointerCapture: () => stop(),
  };
  function move(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / (R * 0.8), y = (e.clientY - r.top - R) / (R * 0.8); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    area.current?.setJoy(x, y); setKnob([x, y]);
  }
  function stop() { area.current?.setJoy(0, 0); setKnob([0, 0]); }

  const a = area.current, h = hud, ev = props.info.electric, unit = props.info.unit;
  const fk = ev ? 'charger' : 'pump';
  const pumpBtn = (label: string, small: string, on: () => void) => <button className="sa-btn main" onClick={on}>{label}<small>{small}</small></button>;
  let acts: JSX.Element | null = null, tip = '';
  if (h) {
    if (h.phase === 'drive') {
      tip = h.autoMoving ? 'Xe đang tự vào chỗ…' : h.snapHint ? 'Thả tay — xe tự căn vào ô' : 'Kéo cần lái tới một ô trống, hoặc bấm nút để xe tự vào';
      acts = (
        <div className="grp">
          {!ev && <button className="sa-btn" onClick={() => a?.parkAt('pump')}>⛽ Vào trụ bơm<small>{vnd(props.info.price)}/lít</small></button>}
          {ev && <button className="sa-btn" onClick={() => a?.parkAt('charger')}>⚡ Vào trụ sạc<small>{vnd(props.info.price)}/kWh</small></button>}
          <button className="sa-btn" onClick={() => a?.parkAt('lot')}>🅿️ Vào ô đỗ<small>đi cửa hàng, vệ sinh</small></button>
          <button className="sa-btn go" onClick={() => a?.leave()}>↗ Đi tiếp<small>không ghé</small></button>
        </div>
      );
    } else if (h.phase === 'parked') {
      tip = h.bay === 'pump' ? `Đã dừng ở trụ số ${h.pump} — xuống xe để tự bơm` : h.bay === 'charger' ? 'Đã dừng ở ô sạc — xuống xe để cắm sạc' : 'Đã đỗ trong ô — xuống xe đi cửa hàng, nhà vệ sinh';
      acts = <div className="grp"><button className="sa-btn main" onClick={() => a?.getOut()}>🚶 Xuống xe</button><button className="sa-btn go" onClick={() => a?.leave()}>↗ Nhập lại cao tốc</button></div>;
    } else if (h.phase === 'walk') {
      const n = h.near; let main: JSX.Element | null = null;
      if (h.inWc) tip = '🚻 Đang đi vệ sinh…';
      else if (n === 'pump' || n === 'charger') main = h.holding ? pumpBtn(ev ? '🔌 Treo súng sạc' : '⛽ Treo vòi', h.added > 0 && !h.paid ? `trả ${vnd(h.cost)}` : '', () => a?.act()) : pumpBtn(ev ? '🔌 Lấy súng sạc' : `⛽ Lấy vòi ${fuel}`, `${vnd(props.info.price)}/${unit}`, () => a?.act());
      else if (n === 'car' && h.holding && !h.plugged) main = pumpBtn(ev ? '🔌 Cắm vào cổng sạc' : '⛽ Cắm vòi vào bình', '', () => a?.act());
      else if (n === 'car' && h.plugged) main = pumpBtn(ev ? '🔌 Rút súng sạc' : '⛽ Rút vòi', `${h.added.toFixed(1)} ${unit} · ${vnd(h.cost)}`, () => a?.act());
      else if (n === 'car') main = <button className="sa-btn main" onClick={() => a?.act()}>🚗 Lên xe</button>;
      else if (n === 'shop' || n === 'food') main = <button className="sa-btn main" onClick={() => a?.act()}>{n === 'shop' ? '🛒 Vào cửa hàng' : '🍜 Vào quán ăn'}</button>;
      else if (n === 'wc') main = <button className="sa-btn main" disabled={h.wc} onClick={() => a?.act()}>🚻 {h.wc ? 'Đã đi vệ sinh' : 'Đi vệ sinh'}</button>;
      if (!tip) tip = h.plugged && !ev ? 'Giữ nút Bơm (hoặc bấm Đổ đầy), xem số lít và tiền trên trụ' : h.plugged ? 'Đang sạc — chờ pin lên rồi rút súng' : h.holding ? (h.plugged ? '' : 'Đi tới nắp bình/cổng sạc của xe') : 'Kéo cần để đi bộ, hoặc chạm nút đi nhanh';
      const goChips: [string, Parameters<StopArea['walkTo']>[0]][] = [];
      if (h.bay === fk && !h.holding) goChips.push([ev ? '⚡ Trụ sạc' : '⛽ Trụ bơm', fk]);
      if (h.holding) goChips.push(h.plugged || h.added > 0 ? [ev ? '⚡ Về trụ' : '⛽ Về trụ', fk] : ['🚗 Nắp bình', 'car']);
      if (!h.holding) goChips.push(['🛒 Cửa hàng', 'shop'], ...(props.info.kind === 'rest' ? [['🍜 Quán ăn', 'food'] as [string, 'food']] : []), ['🚻 WC', 'wc'], ['🚗 Về xe', 'car']);
      acts = (
        <>
          {!ev && h.bay === 'pump' && !h.holding && !h.plugged && h.added === 0 && props.fuelNames.length > 1 && <div className="grp">{props.fuelNames.map((f) => <button key={f} className={`sa-chip ${f === fuel ? 'sel' : ''}`} onClick={() => setFuel(f)}>{f}</button>)}</div>}
          <div className="grp">{goChips.map(([t, s]) => <button key={t} className="sa-chip" onClick={() => a?.walkTo(s)}>{t}</button>)}</div>
          <div className="grp">
            {h.plugged && !ev && <button className={`sa-btn go ${hold || h.pumping ? 'on' : ''}`} disabled={h.energy >= h.tank - 0.05}
              onPointerDown={(e) => { e.preventDefault(); setHold(true); a?.setPump(true); }} onPointerUp={() => { setHold(false); a?.setPump(false); }} onPointerCancel={() => { setHold(false); a?.setPump(false); }} onPointerLeave={() => { if (hold) { setHold(false); a?.setPump(false); } }}>⛽ Bơm<small>giữ</small></button>}
            {h.plugged && !ev && <button className="sa-btn" disabled={h.energy >= h.tank - 0.05} onClick={() => a?.setPump(true)}>Đổ đầy</button>}
            {main}
          </div>
        </>
      );
    } else tip = 'Theo lối ra, nhập lại cao tốc…';
  }
  const items = props.bought.reduce((t, b) => t + b.qty, 0), spent = props.bought.reduce((t, b) => t + (props.menu.find((m) => m.id === b.itemId)?.price ?? 0) * b.qty, 0);
  const show = shop ? props.menu.filter((m) => (shop === 'food' ? m.kind !== 'uong' || m.id === 'tra_da' : true)) : [];
  return (
    <div className="sa" role="application" aria-label={props.info.name}>
      <style>{CSS}</style>
      <div ref={host} className="sa-scene" />
      <div className="sa-top">
        <div className="sa-bar">
          <h2>{props.info.kind === 'rest' ? '☕' : ev ? '⚡' : '⛽'} {props.info.name}</h2>
          <div className="row">
            <span>{ev ? 'Pin' : 'Bình'}</span>
            <span className={`sa-gauge ${ev ? 'ev' : ''}`}><u style={{ width: `${Math.min(100, ((h?.energy ?? props.info.energy) / Math.max(1, props.info.tank)) * 100)}%` }} /></span>
            <span>{(h?.energy ?? props.info.energy).toFixed(0)}/{props.info.tank.toFixed(0)} {unit}</span>
          </div>
          {(h?.added ?? 0) > 0 && <div className="row"><span>{ev ? 'Đã sạc' : 'Đã bơm'} {h!.added.toFixed(1)} {unit} · {vnd(h!.cost)}</span><span>{h!.paid ? '✅ Đã trả' : '⏳ Chưa trả'}</span></div>}
          {(items > 0 || h?.wc) && <div className="row">{items > 0 && <span>🛍️ {items} món · {vnd(spent)}</span>}{h?.wc && <span>🚻 Đã đi vệ sinh</span>}</div>}
        </div>
        {tip && <div className="sa-tip">{tip}</div>}
        {h?.msg && <div className="sa-msg" role="status">{h.msg}</div>}
      </div>
      <div className="sa-bottom">
        <div className="sa-joy" {...joy} aria-label="Cần điều khiển"><i style={{ transform: `translate(${knob[0] * 36}px, ${knob[1] * 36}px)` }} /><small>{h?.phase === 'walk' ? 'Đi bộ' : 'Lái xe'}</small></div>
        <div className="sa-acts">{acts}</div>
      </div>
      {h?.inWc && <div className="sa-wc"><span>🚻 Đi vệ sinh, rửa mặt cho tỉnh táo…</span></div>}
      {shop && (
        <div className="sa-shop" role="dialog" aria-label={SPOT_NAME[shop]}>
          <h2>{shop === 'shop' ? '🛒' : '🍜'} {SPOT_NAME[shop]}</h2>
          {!show.length && <p style={{ margin: 0, textAlign: 'center' }}>Quầy nhỏ ở cây xăng chỉ bán nước, khăn giấy. Đồ ăn, đặc sản có ở trạm dừng nghỉ ☕.</p>}
          <div className="dg-foods">
            {show.map((it) => (
              <div className="dg-food" key={it.id}>
                <b aria-hidden="true">{it.emoji}</b>
                <span>{it.name}{it.regional ? <small>Đặc sản {it.regional}</small> : null}<small>+{it.energy} thể lực · {vnd(it.price)}</small></span>
                <button className="eat" disabled={props.cash < it.price} onClick={() => props.onBuy(it.id, true)}>{it.kind === 'uong' ? 'Uống' : 'Ăn'}</button>
                <button disabled={props.cash < it.price} onClick={() => props.onBuy(it.id, false)}>Bỏ túi</button>
              </div>
            ))}
          </div>
          <div className="tot"><span>Đã mua {items} món</span><b>{vnd(spent)}</b></div>
          <button className="sa-btn go" onClick={() => setShop(null)}>Ra khỏi {shop === 'shop' ? 'cửa hàng' : 'quán'}</button>
        </div>
      )}
    </div>
  );
}
