// Tài sản: sổ địa chính (quỹ đất từng tỉnh, sổ đỏ, rao bán, mua lại) và công trình trên đất
// (cửa hàng đặc sản, siêu thị, xưởng chi nhánh). ProvinceShops gắn trong SupermarketPanel; PropertiesPanel dùng ở Hồ sơ.
import { useCallback, useEffect, useState } from 'react';
import './properties.css';
import { PROVINCES } from '../../shared/catalog.ts';
import { QUALITY_NAMES, fmtMoney } from '../../shared/rules.ts';
import type { Quality } from '../../shared/rules.ts';
import { api } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';

type Kind = 'cua_hang' | 'sieu_thi' | 'xuong';
const isShop = (k: Kind) => k === 'sieu_thi' || k === 'cua_hang';
interface PropertyView {
  id: number; kind: Kind; name: string; emoji: string; province: string; ownerName: string | null;
  cost: number; readyAt: number; ready: boolean; pending: number; earnedTotal: number; traffic: number; machineSlots?: number;
}
interface KindView {
  kind: Kind; name: string; emoji: string; note: string; buildHours: number; minLevel: number; lots: number; use: string;
  cost?: { land: number; build: number; permit: number; total: number; lots: number; lotPrice: number; registration: number }; blocked: string | null; ownedHere: boolean; max: number;
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
      {d.mine && p.ready && isShop(p.kind) && (
        <div className="row-line">
          <div className="grow">Doanh thu chờ nhận <b>{fmtMoney(p.pending)}</b><br /><small>Tổng đã bán {fmtMoney(p.earnedTotal)} · khách {d.kgPerHour ?? 0} kg/giờ (tỉnh đông khách ×{p.traffic})</small></div>
          <button className="primary" disabled={act.busy || p.pending <= 0} onClick={() => act.run(() => api('POST', `/api/properties/${id}/collect`, {}))}>Nhận tiền</button>
        </div>
      )}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {p.kind === 'xuong' && <p className="muted">Xưởng chi nhánh thêm {p.machineSlots ?? 0} chỗ đặt máy cho xưởng của bạn (mua máy ở Xưởng như thường).</p>}
      {isShop(p.kind) && p.ready && (
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
      {k.cost && <small>{k.lots} thửa đất ({k.cost.lots ? `mua thêm ${k.cost.lots} thửa × ${fmtMoney(k.cost.lotPrice)}, gồm trước bạ: ${fmtMoney(k.cost.land)}` : 'dùng thửa trống bạn đã có'}) · xây {fmtMoney(k.cost.build)} · giấy phép {fmtMoney(k.cost.permit)} · xây {k.buildHours} giờ</small>}
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
  const shopKinds = data.kinds.filter((k) => isShop(k.kind));
  return (
    <div className="province-shops">
      <h3>Cửa hàng, siêu thị của người chơi ở {province}</h3>
      {data.inProvince.length === 0 && <p className="hint">Chưa ai mở cửa hàng hay siêu thị riêng ở đây.</p>}
      {data.inProvince.map((p) => (
        <div className="row" key={p.id}>
          <button type="button" className="row-line row-toggle" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
            <span className="emoji" aria-hidden="true">{p.emoji}</span><div className="grow"><strong>{p.name} của {p.ownerName}</strong></div><span aria-hidden="true">{open === p.id ? '▴' : '▾'}</span>
          </button>
          {open === p.id && <ShopDetail id={p.id} onChanged={refresh} />}
        </div>
      ))}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {shopKinds.map((k) => <BuyKind key={k.kind} k={k} province={province} busy={act.busy} onBuy={() => act.run(() => api('POST', '/api/properties/buy', { province, kind: k.kind }))} />)}
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
      <p className="muted">Mỗi tỉnh có quỹ đất hữu hạn theo quy hoạch thật. Thương lái mua đất thương mại mở cửa hàng, siêu thị; chủ xưởng thuê đất khu công nghiệp dựng xưởng chi nhánh; nhà nông mua đất nông nghiệp ở mục Cánh đồng. Thành phố đắt, đông khách; tỉnh xa rẻ, gần vùng nguyên liệu.</p>
      <h3>Tài sản của bạn ({data.mine.length})</h3>
      {data.mine.length === 0 && <p className="hint">Bạn chưa có công trình nào.</p>}
      {data.mine.map((p) => (
        <div className="row" key={p.id}>
          <button type="button" className="row-line row-toggle" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
            <span className="emoji" aria-hidden="true">{p.emoji}</span>
            <div className="grow"><strong>{p.name} · {p.province}</strong><br /><small>{p.ready ? (isShop(p.kind) ? `Chờ nhận ${fmtMoney(p.pending)}` : `+${p.machineSlots} chỗ máy`) : `Đang xây, còn ${fmtDuration(Math.max(0, p.readyAt - Date.now()))}`}</small></div>
            <span aria-hidden="true">{open === p.id ? '▴' : '▾'}</span>
          </button>
          {open === p.id && <ShopDetail id={p.id} onChanged={() => { void load(); refresh?.(); }} />}
        </div>
      ))}
      <h3>Sổ địa chính</h3>
      <label className="land-prov">Xem quỹ đất và mở công trình ở <select value={province} onChange={(e) => setProvince(e.target.value)}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
      <LandRegistry province={province} onChanged={() => { void load(); refresh?.(); }} />
      <h3>Mở công trình ở {province}</h3>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {data.kinds.map((k) => <BuyKind key={k.kind} k={k} province={province} busy={act.busy} onBuy={() => act.run(() => api('POST', '/api/properties/buy', { province, kind: k.kind }))} />)}
    </div>
  );
}

// ---------------------------------------------------------------- sổ địa chính
type LandUse = 'nong_nghiep' | 'thuong_mai' | 'cong_nghiep' | 'o';
interface UseRow {
  use: LandUse; short: string; name: string; emoji: string; lotM2: number; realHa: number; released: number; sold: number; left: number;
  priceM2: number; lotPrice: number; leftValue: number; open: boolean; note: string; blocked: string | null;
  cost: { price: number; registration: number; certFee: number; total: number };
}
interface LotView {
  id: number; province: string; use: LandUse; useName: string; emoji: string; areaM2: number; pricePaid: number; certNo: string; ownerName: string | null;
  mine: boolean; propertyId: number | null; fieldId: number | null; listingPrice: number | null; statePrice: number; used: boolean;
}
interface LandData { province: string | null; summary: UseRow[] | null; mine: LotView[]; listings: LotView[]; resale: { min: number; max: number } }

const short = (v: number) => (v >= 1e9 ? `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỉ` : v >= 1e6 ? `${Math.round(v / 1e6).toLocaleString('vi-VN')} triệu` : fmtMoney(v));

/** Bảng quỹ đất một tỉnh: còn bao nhiêu thửa mỗi loại, giá m², giá thửa, tổng giá trị; thửa của bạn (sổ đỏ) và thửa người khác rao bán. */
export function LandRegistry({ province, onChanged }: { province: string; onChanged?: () => void }) {
  const [d, setD] = useState<LandData | null>(null);
  const [ask, setAsk] = useState<Record<number, number>>({});
  const load = useCallback(async () => setD(await api<LandData>('GET', `/api/land?province=${encodeURIComponent(province)}`)), [province]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged?.(); });
  if (!d?.summary) return <p className="hint">Đang mở sổ địa chính…</p>;
  const mineHere = d.mine.filter((l) => l.province === province), others = d.mine.filter((l) => l.province !== province);
  const forSale = d.listings.filter((l) => !l.mine);
  return (
    <div className="land">
      <div className="land-grid" aria-label={`Quỹ đất ${province}`}>
        {d.summary.map((r) => (
          <div className={`land-card${r.open ? '' : ' closed'}`} key={r.use}>
            <div className="land-head"><span aria-hidden="true">{r.emoji}</span><strong>{r.short}</strong><span className="land-left">{r.open ? `còn ${r.left.toLocaleString('vi-VN')}/${r.released.toLocaleString('vi-VN')} thửa` : 'chưa mở bán'}</span></div>
            <div className="land-bar" aria-hidden="true"><i style={{ width: `${Math.round((r.left / Math.max(1, r.released)) * 100)}%` }} /></div>
            <dl>
              <div><dt>Giá</dt><dd>{fmtMoney(r.priceM2)}/m²</dd></div>
              <div><dt>Một thửa</dt><dd>{r.lotM2.toLocaleString('vi-VN')} m² · {short(r.lotPrice)}</dd></div>
              <div><dt>Đất còn lại</dt><dd>{short(r.leftValue)}</dd></div>
              <div><dt>Quy hoạch</dt><dd>{r.realHa.toLocaleString('vi-VN')} ha</dd></div>
            </dl>
            {r.use === 'nong_nghiep' ? <small className="muted">Mua ở Kho → Cánh đồng (mỗi thửa là một khối ruộng 100 ô).</small>
              : !r.open ? <small className="muted">{r.note}</small>
              : r.blocked ? <small className="error">{r.blocked}</small>
              : <button className="primary land-buy" disabled={act.busy || r.left < 1} onClick={() => act.run(() => api('POST', '/api/land/buy', { province, use: r.use, count: 1 }))}>
                  Mua 1 thửa<small>{short(r.cost.total)}, gồm trước bạ {short(r.cost.registration)}</small>
                </button>}
          </div>
        ))}
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <h4>Sổ đỏ của bạn ở {province} ({mineHere.length})</h4>
      {mineHere.length === 0 && <p className="hint">Chưa có thửa nào ở đây.</p>}
      {mineHere.map((l) => {
        const lo = Math.round(l.statePrice * d.resale.min), hi = Math.round(l.statePrice * d.resale.max), v = ask[l.id] ?? l.listingPrice ?? l.statePrice;
        return (
          <div className="land-lot" key={l.id}>
            <div className="land-cert"><span aria-hidden="true">{l.emoji}</span><div><strong>{l.certNo}</strong><small>{l.useName} · {l.areaM2.toLocaleString('vi-VN')} m² · mua {short(l.pricePaid)}{l.propertyId ? ' · đã có công trình' : l.fieldId ? ' · đang làm ruộng' : ' · đất trống'}</small></div></div>
            {!l.used && (l.listingPrice != null
              ? <div className="land-act"><small>Đang rao {short(l.listingPrice)}</small><button className="ghost" disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/land/${l.id}/unlist`, {}))}>Thôi rao</button></div>
              : <div className="land-act">
                  <input type="number" inputMode="numeric" min={lo} max={hi} step={1_000_000} value={v} aria-label={`Giá rao ${l.certNo}`} onChange={(e) => setAsk({ ...ask, [l.id]: Number(e.target.value) || 0 })} />
                  <button className="ghost" disabled={act.busy || v < lo || v > hi} onClick={() => act.run(() => api('POST', `/api/land/${l.id}/list`, { price: v }))}>Rao bán</button>
                  <small>bạn nhận {short(Math.round(v * 0.98))} (trừ thuế TNCN 2%)</small>
                </div>)}
          </div>
        );
      })}
      {others.length > 0 && <p className="muted">Bạn còn {others.length} thửa ở tỉnh khác: {[...new Set(others.map((l) => l.province))].join(', ')}.</p>}
      <h4>Người chơi rao bán ở {province} ({forSale.length})</h4>
      {forSale.length === 0 && <p className="hint">Chưa ai rao bán đất ở đây.</p>}
      {forSale.map((l) => (
        <div className="land-lot" key={l.id}>
          <div className="land-cert"><span aria-hidden="true">{l.emoji}</span><div><strong>{l.useName} · {l.areaM2.toLocaleString('vi-VN')} m² · {short(l.listingPrice ?? 0)}</strong><small>của {l.ownerName} · giá nhà nước {short(l.statePrice)} · {l.certNo}</small></div></div>
          <button className="primary" disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/land/${l.id}/purchase`, {}))}>Mua lại</button>
        </div>
      ))}
      <small className="muted">Người mua nộp lệ phí trước bạ 0,5% và phí cấp sổ; người bán nộp thuế thu nhập cá nhân 2%. Giá rao trong khoảng {Math.round(d.resale.min * 100)}%–{Math.round(d.resale.max * 100)}% giá nhà nước.</small>
    </div>
  );
}
