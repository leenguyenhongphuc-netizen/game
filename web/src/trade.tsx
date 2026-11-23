// Buôn bán đường dài: thu mua sỉ khi xe tải tới một vùng, so sánh đi vé với tự lái, xuất khẩu.
import { useCallback, useEffect, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import { BULK_EASY_KG, EXPORT_MARKETS, EXPORT_MODES, LIMIT_REASONS, QUALITY_NAMES, TRAVEL_VS_TRUCK, bulkSellFactor, fmtMoney, wholesaleQuote } from '../../shared/rules.ts';
import type { ExportMarket, ExportMode, ExportQuote } from '../../shared/rules.ts';
import type { BundleQuote } from '../../shared/economy.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';
import './trade.css';

/** "Vì sao có giới hạn này?" — mở ra đọc lý do, để giới hạn không còn là con số vô cớ. */
export function WhyLimit({ k }: { k: keyof typeof LIMIT_REASONS | string }) {
  const r = LIMIT_REASONS[k];
  if (!r) return null;
  return (
    <details className="why">
      <summary><span aria-hidden="true">❓</span> {r.title}: <b>{r.limit}</b></summary>
      <p>{r.reason}</p>
    </details>
  );
}

/** Hai cột: mua vé đi chơi khác gì tự lái xe tải đi buôn. */
export function CompareCard({ isTrader }: { isTrader: boolean }) {
  return (
    <div className="compare">
      {(['ve', 'xe_tai'] as const).map((k) => {
        const c = TRAVEL_VS_TRUCK[k];
        return (
          <div key={k} className={k === 'xe_tai' ? 'side truck' : 'side'}>
            <strong><span aria-hidden="true">{c.icon}</span> {c.title}</strong>
            <small>{k === 'xe_tai' && !isTrader ? 'Chỉ thương lái có xe tải' : c.who}</small>
            <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        );
      })}
    </div>
  );
}

interface TradeInfo {
  regionId: string; homeRegionId: string; truckRegionId: string | null; role: string;
  here: boolean; canBuy: boolean; whyNot: string | null; canSellHere: boolean;
  cargo: { capacityKg: number; usedKg: number; freeKg: number };
  buy: { specialtyId: string; refPrice: number; wholesalePrice: number; sellPrice: number; sellAt: 'nha' | 'vung_khac'; marginPerKg: number; supplyLeftKg: number; maxKg: number; supplyTotalKg?: number; boughtTodayKg?: number; glut?: number; sellMarketSold24hKg?: number }[];
  tripCost?: { km: number; total: number; energyCost: number; tollCost: number; upkeepCost: number; spoilRate: number; cold: boolean } | null;
  sell: { specialtyId: string; quality: 'A' | 'B' | 'C'; kg: number; priceHere: number; priceHome: number; diffPerKg: number; soldHere24hKg?: number; avgPriceHereAll?: number }[];
}

/** Khối lượng dễ đọc: dưới 1 tấn ghi kg, từ 1 tấn ghi tấn. */
const fmtKg = (kg: number) => (kg >= 1000 ? `${(Math.round(kg / 10) / 100).toLocaleString('vi-VN')} tấn` : `${kg.toLocaleString('vi-VN')} kg`);
const QUICK: [string, number][] = [['+100 kg', 100], ['+1 tấn', 1000], ['+5 tấn', 5000]];

/** Bảng "Buôn bán ở đây": tới một vùng là thấy ngay mua gì, bán gì, lời bao nhiêu. */
export function TradePanel({ me, regionId, refresh, openStock }: { me: Me; regionId: string; refresh: () => void; openStock: () => void }) {
  const [info, setInfo] = useState<TradeInfo | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const load = useCallback(async () => { setInfo(await api<TradeInfo>('GET', `/api/regions/${regionId}/trade`)); }, [regionId]);
  useEffect(() => { void load().catch(() => setInfo(null)); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  if (!info) return <p className="hint">Đang xem giá ở {REGIONS[regionId].name}…</p>;
  const name = REGIONS[regionId].name, home = REGIONS[info.homeRegionId].name;
  const used = info.cargo.capacityKg ? info.cargo.usedKg / info.cargo.capacityKg : 0;
  return (
    <div className="trade">
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <h3>🚚 Thu mua sỉ ở {name}</h3>
      {info.canBuy ? (
        <div className="cargo" aria-label={`Thùng xe đã chất ${info.cargo.usedKg} trên ${info.cargo.capacityKg} kg`}>
          <div className="bar"><i style={{ width: `${Math.round(used * 100)}%` }} /></div>
          <small>Thùng xe: <b>{info.cargo.capacityKg >= 1000 ? `${fmtKg(info.cargo.usedKg)} / ${fmtKg(info.cargo.capacityKg)}` : `${info.cargo.usedKg}/${info.cargo.capacityKg} kg`}</b> · còn chở được {fmtKg(info.cargo.freeKg)}</small>
          {info.tripCost && <small>Chi phí chạy về nhà ({info.tripCost.km} km): khoảng <b>{fmtMoney(info.tripCost.total)}</b>{info.tripCost.spoilRate > 0 ? ` · hàng tươi hao ${(info.tripCost.spoilRate * 100).toLocaleString('vi-VN')}% dọc đường${info.tripCost.cold ? ' (thùng lạnh)' : ' (thùng thường; thùng lạnh hao ít hơn 5 lần)'}` : ''}</small>}
        </div>
      ) : <p className="notice">{info.whyNot ?? 'Chỉ thương lái lái xe tải tới đây mới thu mua sỉ được.'}</p>}
      {info.buy.map((b) => {
        const sp = SPECIALTIES[b.specialtyId], q = Math.max(0, Math.min(qty[b.specialtyId] ?? Math.min(100, b.maxKg), b.maxKg));
        const lead = b.sellAt === 'nha' ? `Chở về ${home} bán` : 'Chở sang vùng khác bán';
        const set = (v: number) => setQty({ ...qty, [b.specialtyId]: Math.max(0, Math.min(b.maxKg, Math.floor(v) || 0)) });
        // Giá mua trung bình tăng theo lượng (vét nhiều thì đắt), giá bán trung bình giảm theo lượng xả ở chợ nơi đến.
        const buyQ = b.supplyTotalKg ? wholesaleQuote(b.refPrice, b.glut ?? 1, b.supplyTotalKg, b.boughtTodayKg ?? 0, q) : { unit: b.wholesalePrice, total: b.wholesalePrice * q };
        const keep = info.tripCost ? 1 - info.tripCost.spoilRate : 1, arriveKg = Math.round(q * keep);
        const bulk = bulkSellFactor(b.sellMarketSold24hKg ?? 0, arriveKg), sellUnit = Math.round((b.sellPrice * bulk) / 100) * 100;
        const profit = sellUnit * arriveKg - buyQ.total - (info.tripCost?.total ?? 0);
        const drop = Math.round((1 - bulk) * 100);
        return (
          <div className="deal" key={b.specialtyId} style={{ flexWrap: 'wrap' }}>
            <span className="emoji" aria-hidden="true">{CROPS[sp.crop].emoji}</span>
            <div className="grow">
              <strong>{sp.name}</strong>
              <small>Mua sỉ từ <b>{fmtMoney(b.wholesalePrice)}</b>/kg · {lead} <b>{fmtMoney(b.sellPrice)}</b>/kg</small>
              <span className={b.marginPerKg > 0 ? 'tag' : 'tag bad'}>{b.marginPerKg > 0 ? `Lời tới ${fmtMoney(b.marginPerKg)}/kg` : `Lỗ ${fmtMoney(-b.marginPerKg)}/kg`} · vùng còn {fmtKg(b.supplyLeftKg)} hôm nay</span>
            </div>
            {info.canBuy && b.maxKg > 0 && (
              <div className="deal-buy" style={{ flex: '1 1 100%', display: 'grid', gap: 6 }}>
                <div className="stepper" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 6 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" inputMode="numeric" min={0} max={b.maxKg} step={50} value={q} aria-label={`Số ki-lô-gam ${sp.name} muốn mua`}
                      onChange={(e) => set(Number(e.target.value))} style={{ width: 96, minHeight: 44, fontSize: '1rem', textAlign: 'right' }} />
                    <b>kg</b>
                  </label>
                  {QUICK.map(([label, add]) => <button key={label} type="button" disabled={q >= b.maxKg} onClick={() => set(q + add)} style={{ minHeight: 44, width: 'auto', padding: '0 10px' }}>{label}</button>)}
                  <button type="button" disabled={q >= b.maxKg} onClick={() => set(b.maxKg)} style={{ minHeight: 44, width: 'auto', padding: '0 10px' }}>Đầy xe</button>
                  <button type="button" disabled={q === 0} onClick={() => set(0)} style={{ minHeight: 44, width: 'auto', padding: '0 10px' }}>Xoá</button>
                </div>
                {q > 0 && (
                  <small>
                    {fmtKg(q)} · giá mua trung bình <b>{fmtMoney(buyQ.unit)}</b>/kg{buyQ.unit > b.wholesalePrice ? ' (mua nhiều nên giá lên)' : ''} · còn chỗ {fmtKg(Math.max(0, info.cargo.freeKg - q))} trên xe
                    {b.sellAt === 'nha' && <><br />Bán ở {home} trung bình <b>{fmtMoney(sellUnit)}</b>/kg{arriveKg < q ? ` cho ${fmtKg(arriveKg)} còn lại sau hao hụt` : ''} · <b style={{ color: profit >= 0 ? 'var(--green-dark)' : '#b3261e' }}>{profit >= 0 ? `lời dự kiến ${fmtMoney(profit)}` : `lỗ dự kiến ${fmtMoney(-profit)}`}</b> sau chi phí chuyến</>}
                  </small>
                )}
                {q > 0 && b.sellAt === 'nha' && drop >= 5 && <small className="tag bad" role="status">Xả {fmtKg(arriveKg)} một lúc làm giá ở {home} rớt khoảng {drop}%. Chợ chỉ giữ giá cho khoảng {fmtKg(BULK_EASY_KG)} đầu mỗi ngày: chia ra bán ở vài vùng sẽ lời hơn.</small>}
                <button className="go" disabled={act.busy || q <= 0 || me.user.cash < buyQ.total} onClick={() => act.run(() => api('POST', '/api/wholesale/buy', { specialtyId: b.specialtyId, kg: q }))}>
                  Mua {fmtKg(q)} · {fmtMoney(buyQ.total)}
                </button>
              </div>
            )}
          </div>
        );
      })}
      <WhyLimit k="wholesale_cargo" /><WhyLimit k="wholesale_supply" /><WhyLimit k="wholesale_role" />

      <h3>💰 Hàng trong kho của bạn, bán ở {name}</h3>
      {info.sell.length === 0 ? <p className="hint">Kho đang trống. Lần sau chất hàng ở nhà rồi hãy lên đường.</p> : (
        <>
          {info.sell.slice(0, 6).map((s) => {
            const sp = SPECIALTIES[s.specialtyId];
            return (
              <div className="deal" key={s.specialtyId + s.quality}>
                <span className="emoji" aria-hidden="true">{CROPS[sp.crop].emoji}</span>
                <div className="grow">
                  <strong>{sp.name} <small>· {QUALITY_NAMES[s.quality]} · {s.kg} kg</small></strong>
                  <small>Ở đây <b>{fmtMoney(s.priceHere)}</b>/kg · ở nhà {fmtMoney(s.priceHome)}/kg{s.avgPriceHereAll !== undefined && s.avgPriceHereAll < s.priceHere ? ` · bán hết ${fmtKg(s.kg)} một lúc chỉ còn khoảng ${fmtMoney(s.avgPriceHereAll)}/kg` : ''}</small>
                  {s.diffPerKg !== 0 && <span className={s.diffPerKg > 0 ? 'tag' : 'tag bad'}>{s.diffPerKg > 0 ? `Bán ở đây hơn ${fmtMoney(s.diffPerKg * s.kg)}` : `Bán ở đây thiệt ${fmtMoney(-s.diffPerKg * s.kg)}`}</span>}
                </div>
              </div>
            );
          })}
          <button className="primary" onClick={openStock}>Mở kho để bán ở {name}</button>
        </>
      )}
    </div>
  );
}

interface Shipment { id: number; specialtyId: string; quality: 'A' | 'B' | 'C'; kg: number; arriveKg: number; mode: ExportMode; market: ExportMarket; gatewayName: string; freight: number; payout: number; createdAt: number; arrivesAt: number; paidAt: number | null; status: 'dang_di' | 'da_toi'; processed?: boolean; name?: string }
interface ExportLot { specialtyId: string; quality: 'A' | 'B' | 'C'; kg: number; refPrice: number; quotes: ExportQuote[]; processed?: boolean; name?: string }
interface ExportOptions {
  allowedModes: ExportMode[]; role: string; inCoop: boolean; active: number; maxActive: number; level?: number; discount?: number;
  stock: ExportLot[]; products?: ExportLot[];
}
export interface ExportSent { mode: ExportMode; market: ExportMarket; kg: number; specialtyId: string }
const MARKET_IDS = Object.keys(EXPORT_MARKETS) as ExportMarket[];
const lotId = (l: ExportLot) => (l.processed ? 'cb:' : '') + l.specialtyId + l.quality;
const lotName = (l: { specialtyId: string; name?: string }) => l.name ?? SPECIALTIES[l.specialtyId]?.name ?? l.specialtyId;

/** Xuất khẩu: chọn hàng tươi hoặc hàng chế biến → thị trường → đường đi; mỗi đường một giá cước, thời gian và hao hụt riêng. */
type CartQuote = BundleQuote & { allowed: boolean; minKg: number; maxKg: number };
export function ExportPanel({ me, refresh, onSent }: { me: Me; refresh: () => void; onSent: (s: ExportSent) => void }) {
  const [opt, setOpt] = useState<ExportOptions | null>(null);
  const [ships, setShips] = useState<Shipment[]>([]);
  /** Giỏ hàng xuất khẩu: mã lô → số kg muốn gửi. */
  const [cart, setCart] = useState<Record<string, number>>({});
  const [quotes, setQuotes] = useState<CartQuote[] | null>(null);
  const [market, setMarket] = useState<ExportMarket>('trung_quoc');
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    setOpt(await api<ExportOptions>('GET', '/api/export/options'));
    setShips((await api<{ shipments: Shipment[] }>('GET', '/api/export/shipments')).shipments);
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  const products = opt?.products ?? [], lots = opt ? [...opt.stock, ...products] : [];
  const inCart = lots.filter((l) => (cart[lotId(l)] ?? 0) > 0).map((l) => ({ lot: l, kg: Math.min(l.kg, cart[lotId(l)]) }));
  const items = inCart.map(({ lot, kg }) => ({ specialtyId: lot.specialtyId, grade: lot.quality, kg, ...(lot.processed ? { processed: true } : {}) }));
  const cartKey = JSON.stringify(items);
  // báo giá lại cả giỏ cho mọi thị trường mỗi khi giỏ đổi
  useEffect(() => {
    if (!items.length) { setQuotes(null); return; }
    let live = true;
    const t = setTimeout(() => {
      void api<{ quotes: CartQuote[] }>('POST', '/api/export/quote', { items }).then((r) => {
        if (!live) return;
        setQuotes(r.quotes);
        setMarket((cur) => r.quotes.some((q) => q.market === cur && q.ok) ? cur : r.quotes.filter((q) => q.ok).sort((a, b) => b.net - a.net)[0]?.market ?? cur);
      }).catch(() => live && setQuotes([]));
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);
  if (!opt) return <p className="hint">Đang lấy báo giá xuất khẩu…</p>;
  const scale = me.config.timeScale || 1;
  const going = ships.filter((s) => s.status === 'dang_di'), done = ships.filter((s) => s.status === 'da_toi').slice(0, 5);
  const full = opt.active >= opt.maxActive, discount = opt.discount ?? 0;
  const totalKg = inCart.reduce((s, x) => s + x.kg, 0);
  const cash = me.user.cash;
  const bestOf = (m: ExportMarket) => quotes?.filter((q) => q.market === m && q.ok && q.allowed).sort((a, b) => b.net - a.net)[0] ?? null;
  const overall = quotes ? MARKET_IDS.map(bestOf).filter((q): q is CartQuote => !!q).sort((a, b) => b.net - a.net)[0] ?? null : null;
  const here = quotes ? quotes.filter((q) => q.market === market).sort((a, b) => Number(b.ok) - Number(a.ok) || b.net - a.net) : [];
  const top = here.find((q) => q.ok) ?? null;
  const setKg = (l: ExportLot, kg: number) => setCart((c) => ({ ...c, [lotId(l)]: Math.max(0, Math.min(l.kg, Math.round(kg))) }));
  const toggle = (l: ExportLot) => setCart((c) => { const id = lotId(l), n = { ...c }; if (n[id]) delete n[id]; else n[id] = l.kg; return n; });
  const lotButton = (l: ExportLot) => {
    const sp = SPECIALTIES[l.specialtyId], id = lotId(l);
    return (
      <button key={id} className={l.processed ? 'pick processed' : 'pick'} aria-pressed={(cart[id] ?? 0) > 0} onClick={() => toggle(l)}>
        <span className="emoji" aria-hidden="true">{l.processed ? '📦' : sp ? CROPS[sp.crop].emoji : '📦'}</span><strong>{lotName(l)}</strong><small>{l.processed ? 'Chế biến' : QUALITY_NAMES[l.quality]} · {l.kg} kg</small>
      </button>
    );
  };
  const send = (q: CartQuote) => act.run(async () => {
    // chỉ gửi các mặt hàng thị trường này nhận; mặt hàng bị loại ở lại kho
    const okLines = q.lines.filter((x) => x.ok).map((x) => ({ specialtyId: x.specialtyId, grade: x.grade, kg: x.kg, ...(x.processed ? { processed: true } : {}) }));
    await api('POST', '/api/export/ship', { items: okLines, mode: q.mode, market: q.market });
    onSent({ mode: q.mode, market: q.market, kg: q.kg, specialtyId: okLines[0].specialtyId });
    setCart({});
  });
  return (
    <div className="export">
      <p className="muted">Gom nhiều mặt hàng vào một lô: mức tối thiểu tính trên tổng lô, cước chia theo kg. Nước ngoài trả cao hơn trong nước nhưng mỗi thị trường chỉ mua dễ vài tấn mỗi loại một ngày, xả nhiều thì giá rớt; giá thế giới lên xuống mỗi ngày. Tiền về khi lô tới nơi.</p>
      <div className="ex-status">
        <span>Đang có <b>{opt.active}</b> lô trên đường.</span>
        {discount > 0 && <span className="tag">Bạn được giảm {Math.round(discount * 100)}% cước</span>}
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}

      <h3>1 · Giỏ hàng xuất khẩu</h3>
      {lots.length === 0 && <p className="hint">Kho chưa có hàng để xuất. Thu hoạch, thu mua, chế biến — hoặc nhận hợp đồng của công ty xuất nhập khẩu ở thẻ Hợp đồng.</p>}
      {opt.stock.length > 0 && <><h4>Nông sản tươi</h4><div className="pick-row wrap">{opt.stock.map(lotButton)}</div></>}
      {products.length > 0 && <><h4>Hàng chế biến <small>hao hụt thấp, không xét loại, miễn kiểm dịch</small></h4><div className="pick-row wrap">{products.map(lotButton)}</div></>}
      {inCart.length > 0 && (
        <div className="ex-cart">
          <p className="ex-cart-total">Lô gộp: <b>{totalKg.toLocaleString('vi-VN')} kg</b> · {inCart.length} mặt hàng{overall ? <> · lãi tới <b>{fmtMoney(overall.net)}</b></> : null}</p>
          {inCart.map(({ lot, kg }) => (
            <div className="row-line ex-cart-line" key={lotId(lot)}>
              <div className="grow"><strong>{lotName(lot)}</strong> <small>{lot.processed ? 'chế biến' : QUALITY_NAMES[lot.quality]} · có {lot.kg} kg</small></div>
              <div className="qty">
                <button className="ghost" onClick={() => setKg(lot, kg - 100)} aria-label="Bớt 100 kg">−100</button>
                <input type="number" inputMode="numeric" min={1} max={lot.kg} value={kg} onChange={(e) => setKg(lot, Number(e.target.value) || 0)} aria-label={`Số kg ${lotName(lot)}`} />
                <button className="ghost" onClick={() => setKg(lot, kg + 100)} aria-label="Thêm 100 kg">+100</button>
                <button className="ghost wide" onClick={() => setKg(lot, lot.kg / 2)} aria-label="Một nửa">½</button>
                <button className="ghost" onClick={() => setKg(lot, lot.kg)}>Hết</button>
                <button className="ghost wide" onClick={() => toggle(lot)} aria-label={`Bỏ ${lotName(lot)}`}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {inCart.length > 0 && (
        <>
          <h3>2 · Bán sang đâu</h3>
          {!quotes && <p className="hint">Đang báo giá cả lô…</p>}
          {overall && <p className="notice ex-best">💡 Lô {totalKg.toLocaleString('vi-VN')} kg lãi nhất khi sang <b>{EXPORT_MARKETS[overall.market].name}</b> bằng <b>{EXPORT_MODES[overall.mode].name}</b>: lãi {fmtMoney(overall.net)}.</p>}
          {quotes && (
            <div className="pick-row wrap ex-markets">
              {MARKET_IDS.map((m) => {
                const mk = EXPORT_MARKETS[m], b = bestOf(m), any = quotes.find((q) => q.market === m);
                return (
                  <button key={m} className={b ? 'pick' : 'pick off'} aria-pressed={market === m} onClick={() => setMarket(m)}>
                    <span className="emoji" aria-hidden="true">{mk.icon}</span><strong>{mk.name}</strong>
                    <small>giá ×{mk.priceMult}{mk.processedOnly ? ' · chỉ hàng chế biến, hàng khô' : mk.gradeA ? ' · tươi: chỉ Loại 1' : ''}</small>
                    <small className={b ? 'up' : 'down'}>{b ? `lãi tới ${fmtMoney(b.net)}` : any?.reason ?? 'không nhận lô này'}</small>
                  </button>
                );
              })}
            </div>
          )}
          <p className="muted">{EXPORT_MARKETS[market].note}{EXPORT_MARKETS[market].treat ? ` ${EXPORT_MARKETS[market].treat} trái tươi: thêm ${fmtMoney(EXPORT_MARKETS[market].treatFee ?? 0)}/kg và ${fmtDuration(((EXPORT_MARKETS[market].treatMinutes ?? 0) * 60_000) / scale)}.` : ''}</p>

          <h3>3 · Đi đường nào</h3>
          {here.map((q) => {
            const m = EXPORT_MODES[q.mode], out = q.lines.filter((x) => !x.ok), short = cash < q.freight;
            return (
              <div className={q.ok ? 'route ex-route' : 'route ex-route off'} key={q.mode}>
                <div className="ex-route-head">
                  <span className="emoji" aria-hidden="true">{m.icon}</span>
                  <strong>{m.name}{q === top && here.filter((x) => x.ok).length > 1 ? <span className="tag"> lãi nhất</span> : null}</strong>
                  {q.ok && <b className={q.net >= 0 ? 'ex-net up' : 'ex-net down'}>lãi {fmtMoney(q.net)}</b>}
                </div>
                {q.ok ? (
                  <>
                    <div className="ex-route-sum">
                      <span>⏱️ {fmtDuration((q.minutes * 60_000) / scale)}</span>
                      <span>🧾 cước {fmtMoney(q.freight)}</span>
                      <span>💵 về {fmtMoney(q.payout)}</span>
                      {q.lcl && <span className="tag lcl">hàng lẻ</span>}
                    </div>
                    <details className="ex-detail">
                      <summary>{q.lines.length} mặt hàng · {q.kg.toLocaleString('vi-VN')} kg{q.spoilKg > 0 ? ` · hao ${q.spoilKg.toLocaleString('vi-VN')} kg` : ''}{out.length ? ` · ${out.length} không đi` : ''}</summary>
                      <ul className="ex-lines">
                        {q.lines.map((x) => (
                          <li key={x.specialtyId + x.grade + (x.processed ? 'P' : '')} className={x.ok ? '' : 'off'}>
                            <span className="ex-l-name">{x.name}{x.processed ? '' : ` · ${QUALITY_NAMES[x.grade]}`}</span>
                            {x.ok ? <><span className="ex-l-kg">{x.kg.toLocaleString('vi-VN')} kg</span><span className="ex-l-money">{fmtMoney(x.payout)}</span>
                              <small className="ex-l-more">hao {x.spoilKg} kg · {fmtMoney(x.unitPrice)}/kg · cước {fmtMoney(x.freight)}{x.demand < 1 ? ` · thị trường đã nhiều hàng, giá ×${x.demand}` : ''}</small></>
                              : <small className="error ex-l-more">không đi: {x.reason}</small>}
                          </li>
                        ))}
                      </ul>
                      <small className="muted">Qua {q.gatewayName}{q.inlandKm > 0 ? ` (${q.inlandKm} km đường bộ)` : ''}. {m.note} Nhận lô {m.minKg.toLocaleString('vi-VN')}–{m.maxKg.toLocaleString('vi-VN')} kg.</small>
                    </details>
                    <button className="go ex-go" disabled={act.busy || short || full || !q.allowed} onClick={() => send(q)}>
                      Gửi đi{short ? ' · thiếu tiền cước' : out.length ? ` · bỏ ${out.length} mặt hàng` : ''}
                    </button>
                  </>
                ) : <small className="error">{q.reason}</small>}
              </div>
            );
          })}
          {quotes && here.length === 0 && <p className="hint">Chưa có đường nào tới thị trường này.</p>}
          {full && <p className="notice">Bạn đang có {opt.active} lô trên đường, đã chạm mức tối đa {opt.maxActive} lô. Chờ một lô tới nơi rồi gửi tiếp.</p>}
        </>
      )}

      <h3>Lô hàng đang đi ({going.length})</h3>
      {going.length === 0 ? <p className="hint">Chưa có lô nào trên đường.</p> : going.map((s) => {
        const total = Math.max(1, s.arrivesAt - s.createdAt), p = Math.min(1, Math.max(0, (now - s.createdAt) / total));
        return (
          <div className="ship" key={s.id}>
            <span className="emoji" aria-hidden="true">{EXPORT_MODES[s.mode].icon}</span>
            <div className="grow">
              <strong>{s.kg} kg {lotName(s)} → {EXPORT_MARKETS[s.market].name}</strong>
              <div className="bar"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
              <small>{s.arrivesAt > now ? `Còn ${fmtDuration(s.arrivesAt - now)} · tiền về ${fmtMoney(s.payout)}` : 'Đã tới nơi, đang chốt tiền…'}</small>
            </div>
          </div>
        );
      })}
      {done.length > 0 && <><h3>Đã tới nơi</h3>{done.map((s) => (
        <div className="row-line" key={s.id}><div className="grow">{EXPORT_MODES[s.mode].icon} {s.arriveKg} kg {lotName(s)} → {EXPORT_MARKETS[s.market].name}</div><b>+{fmtMoney(s.payout)}</b></div>
      ))}</>}
      <WhyLimit k="export_role" /><WhyLimit k="export_min" /><WhyLimit k="export_active" /><WhyLimit k="export_grade" /><WhyLimit k="export_processed" />
    </div>
  );
}
