// Tài sản thương mại: siêu thị riêng và xưởng chi nhánh ở tỉnh khác.
// ProvinceShops gắn trong SupermarketPanel (nút "Mở siêu thị của bạn ở <tỉnh>"); PropertiesPanel dùng ở Hồ sơ.
import { useCallback, useEffect, useState } from 'react';
import { PROVINCES } from '../../shared/catalog.ts';
import { QUALITY_NAMES, fmtMoney } from '../../shared/rules.ts';
import type { Quality } from '../../shared/rules.ts';
import { api } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';

interface PropertyView {
  id: number; kind: 'sieu_thi' | 'xuong'; name: string; emoji: string; province: string; ownerName: string | null;
  cost: number; readyAt: number; ready: boolean; pending: number; earnedTotal: number; traffic: number; machineSlots?: number;
}
interface KindView {
  kind: 'sieu_thi' | 'xuong'; name: string; emoji: string; note: string; buildHours: number; minLevel: number;
  cost?: { land: number; build: number; permit: number; total: number }; blocked: string | null; ownedHere: boolean; max: number;
}
interface PropertiesData { mine: PropertyView[]; kinds: KindView[]; province: string | null; inProvince: PropertyView[]; consignFee: number; branchSlots: number }
interface ShelfView { id: number; specialtyId: string; quality: Quality; processed: boolean; kg: number; soldKg: number; price: number; refPrice: number; name: string; sellerName: string; mine: boolean }
interface Stockable { specialtyId: string; quality: Quality; kg: number; processed: boolean; name: string; refPrice: number }
interface DetailData { property: PropertyView; mine: boolean; consignFee: number; shelves?: ShelfView[]; stockable?: Stockable[]; kgPerHour?: number; priceRange?: { minRatio: number; maxRatio: number } }

const round100 = (v: number) => Math.round(v / 100) * 100;

/** Một siêu thị: kệ hàng, bày hàng (chủ hoặc người ký gửi), chủ thu doanh thu. */
export function ShopDetail({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const [d, setD] = useState<DetailData | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [kg, setKg] = useState(0);
  const [ratio, setRatio] = useState(1.2);
  const load = useCallback(async () => setD(await api<DetailData>('GET', `/api/properties/${id}`)), [id]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged?.(); });
  if (!d) return <p className="hint">Đang mở…</p>;
  const p = d.property, key = (s: Stockable) => `${s.processed ? 'P' : s.quality}:${s.specialtyId}`;
  const item = d.stockable?.find((s) => key(s) === pick) ?? null;
  const range = d.priceRange ?? { minRatio: 1, maxRatio: 1.6 };
  return (
    <div className="shop-detail">
      {!p.ready && <p className="notice">🏗️ Đang xây, xong sau {fmtDuration(Math.max(0, p.readyAt - Date.now()))}.</p>}
      {d.mine && p.ready && p.kind === 'sieu_thi' && (
        <div className="row-line">
          <div className="grow">Doanh thu chờ nhận <b>{fmtMoney(p.pending)}</b><br /><small>Tổng đã bán {fmtMoney(p.earnedTotal)} · khách {d.kgPerHour ?? 0} kg/giờ (tỉnh đông khách ×{p.traffic})</small></div>
          <button className="primary" disabled={act.busy || p.pending <= 0} onClick={() => act.run(() => api('POST', `/api/properties/${id}/collect`, {}))}>Nhận tiền</button>
        </div>
      )}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {p.kind === 'xuong' && <p className="muted">Xưởng chi nhánh thêm {p.machineSlots ?? 0} chỗ đặt máy cho xưởng của bạn (mua máy ở Xưởng như thường).</p>}
      {p.kind === 'sieu_thi' && p.ready && (
        <>
          <h4>Kệ hàng ({d.shelves?.length ?? 0})</h4>
          {(d.shelves ?? []).length === 0 && <p className="hint">Kệ trống. Bày hàng để khách mua.</p>}
          {(d.shelves ?? []).map((s) => (
            <div className="row-line" key={s.id}>
              <div className="grow">{s.name} <small>{s.processed ? 'chế biến' : QUALITY_NAMES[s.quality]} · {s.kg} kg · {fmtMoney(s.price)}/kg{s.mine ? '' : ` · của ${s.sellerName}`}</small></div>
              {s.mine && <button className="ghost" disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/properties/${id}/withdraw`, { shelfId: s.id }))}>Rút về</button>}
            </div>
          ))}
          <h4>Bày hàng lên kệ {d.mine ? '' : <small>(chủ siêu thị thu {Math.round(d.consignFee * 100)}% khi bán được)</small>}</h4>
          <div className="pick-row wrap">
            {(d.stockable ?? []).map((s) => (
              <button key={key(s)} className={s.processed ? 'pick processed' : 'pick'} aria-pressed={pick === key(s)} onClick={() => { setPick(key(s)); setKg(Math.min(s.kg, 100)); }}>
                <strong>{s.name}</strong><small>{s.processed ? 'chế biến' : QUALITY_NAMES[s.quality]} · {s.kg} kg</small>
              </button>
            ))}
          </div>
          {item && (
            <div className="row-actions">
              <label>Số kg <input type="number" inputMode="numeric" min={1} max={item.kg} value={kg} onChange={(e) => setKg(Math.max(0, Math.min(item.kg, Number(e.target.value) || 0)))} /></label>
              <label>Giá ×{ratio.toFixed(2)} <input type="range" min={range.minRatio} max={range.maxRatio} step={0.05} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} /></label>
              <span>{fmtMoney(round100(item.refPrice * ratio))}/kg</span>
              <button className="primary" disabled={act.busy || kg < 1} onClick={() => act.run(async () => {
                await api('POST', `/api/properties/${id}/stock`, { specialtyId: item.specialtyId, grade: item.quality, processed: item.processed, kg, price: Math.max(round100(item.refPrice * range.minRatio), Math.min(round100(item.refPrice * ratio), Math.floor((item.refPrice * range.maxRatio) / 100) * 100)) });
                setPick(null);
              })}>Bày lên kệ</button>
            </div>
          )}
          <small className="muted">Giá tới 1,2 lần giá tham chiếu thì khách mua đều; đắt hơn thì bán chậm dần. Phải có mặt ở {p.province} (xe hoặc tham quan) mới bày hàng được.</small>
        </>
      )}
    </div>
  );
}

/** Mở siêu thị hoặc xưởng ở một tỉnh: giá đất, xây dựng, giấy phép, thời gian xây. */
function BuyKind({ k, province, busy, onBuy }: { k: KindView; province: string; busy: boolean; onBuy: () => void }) {
  if (k.ownedHere) return null;
  return (
    <div className="row prop-buy">
      <div className="row-line">
        <span className="emoji" aria-hidden="true">{k.emoji}</span>
        <div className="grow"><strong>Mở {k.name.toLowerCase()} của bạn ở {province}</strong><br /><small>{k.note}</small></div>
      </div>
      {k.cost && <small>Đất {fmtMoney(k.cost.land)} · xây {fmtMoney(k.cost.build)} · giấy phép {fmtMoney(k.cost.permit)} · xây {k.buildHours} giờ</small>}
      {k.blocked ? <small className="error">{k.blocked}</small>
        : <button className="primary prop-open" disabled={busy} onClick={onBuy}>Mở {k.name.toLowerCase()} ở {province}<small>{k.cost ? fmtMoney(k.cost.total) : ''}</small></button>}
    </div>
  );
}

/** Gắn dưới SupermarketPanel: siêu thị người chơi trong tỉnh và nút mở siêu thị riêng. */
export function ProvinceShops({ province, refresh }: { province: string; refresh?: () => void }) {
  const [data, setData] = useState<PropertiesData | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(async () => setData(await api<PropertiesData>('GET', `/api/properties?province=${encodeURIComponent(province)}`)), [province]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); refresh?.(); });
  if (!data) return null;
  const shopKind = data.kinds.find((k) => k.kind === 'sieu_thi');
  return (
    <div className="province-shops">
      <h3>Siêu thị của người chơi ở {province}</h3>
      {data.inProvince.length === 0 && <p className="hint">Chưa ai mở siêu thị riêng ở đây.</p>}
      {data.inProvince.map((p) => (
        <div className="row" key={p.id}>
          <button type="button" className="row-line row-toggle" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
            <span className="emoji" aria-hidden="true">{p.emoji}</span><div className="grow"><strong>{p.name} của {p.ownerName}</strong></div><span aria-hidden="true">{open === p.id ? '▴' : '▾'}</span>
          </button>
          {open === p.id && <ShopDetail id={p.id} onChanged={refresh} />}
        </div>
      ))}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {shopKind && <BuyKind k={shopKind} province={province} busy={act.busy} onBuy={() => act.run(() => api('POST', '/api/properties/buy', { province, kind: 'sieu_thi' }))} />}
    </div>
  );
}

/** Hồ sơ → Tài sản: siêu thị, xưởng chi nhánh đang có; mở mới ở tỉnh bất kỳ. */
export function PropertiesPanel({ refresh }: { refresh?: () => void }) {
  const [province, setProvince] = useState<string>(PROVINCES[0]);
  const [data, setData] = useState<PropertiesData | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(async () => setData(await api<PropertiesData>('GET', `/api/properties?province=${encodeURIComponent(province)}`)), [province]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); refresh?.(); });
  if (!data) return <p className="hint">Đang tải tài sản…</p>;
  return (
    <div className="properties">
      <p className="muted">Chủ xưởng và thương lái (nhà vườn từ cấp cao) mua đất thương mại ở tỉnh khác để mở siêu thị đặc sản riêng hoặc xưởng chi nhánh. Siêu thị bán hàng bạn bày cho khách du lịch, tỉnh đông khách bán nhanh hơn, và thu phí khi người khác ký gửi.</p>
      <h3>Tài sản của bạn ({data.mine.length})</h3>
      {data.mine.length === 0 && <p className="hint">Bạn chưa có công trình nào.</p>}
      {data.mine.map((p) => (
        <div className="row" key={p.id}>
          <button type="button" className="row-line row-toggle" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
            <span className="emoji" aria-hidden="true">{p.emoji}</span>
            <div className="grow"><strong>{p.name} · {p.province}</strong><br /><small>{p.ready ? (p.kind === 'sieu_thi' ? `Chờ nhận ${fmtMoney(p.pending)}` : `+${p.machineSlots} chỗ máy`) : `Đang xây, còn ${fmtDuration(Math.max(0, p.readyAt - Date.now()))}`}</small></div>
            <span aria-hidden="true">{open === p.id ? '▴' : '▾'}</span>
          </button>
          {open === p.id && <ShopDetail id={p.id} onChanged={() => { void load(); refresh?.(); }} />}
        </div>
      ))}
      <h3>Mở mới</h3>
      <label>Tỉnh, thành <select value={province} onChange={(e) => setProvince(e.target.value)}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {data.kinds.map((k) => <BuyKind key={k.kind} k={k} province={province} busy={act.busy} onBuy={() => act.run(() => api('POST', '/api/properties/buy', { province, kind: k.kind }))} />)}
    </div>
  );
}
