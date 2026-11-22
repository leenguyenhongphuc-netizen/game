// Buôn bán đường dài: thu mua sỉ khi xe tải tới một vùng, so sánh đi vé với tự lái, xuất khẩu.
import { useCallback, useEffect, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import { EXPORT_MARKETS, EXPORT_MODES, LIMIT_REASONS, QUALITY_NAMES, TRAVEL_VS_TRUCK, fmtMoney } from '../../shared/rules.ts';
import type { ExportMarket, ExportMode, ExportQuote } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { fmtDuration, useAction } from './ui.ts';

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
  buy: { specialtyId: string; refPrice: number; wholesalePrice: number; sellPrice: number; sellAt: 'nha' | 'vung_khac'; marginPerKg: number; supplyLeftKg: number; maxKg: number }[];
  sell: { specialtyId: string; quality: 'A' | 'B' | 'C'; kg: number; priceHere: number; priceHome: number; diffPerKg: number }[];
}

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
          <small>Thùng xe: <b>{info.cargo.usedKg}/{info.cargo.capacityKg} kg</b> · còn chở được {info.cargo.freeKg} kg</small>
        </div>
      ) : <p className="notice">{info.whyNot ?? 'Chỉ thương lái lái xe tải tới đây mới thu mua sỉ được.'}</p>}
      {info.buy.map((b) => {
        const sp = SPECIALTIES[b.specialtyId], q = Math.min(qty[b.specialtyId] ?? Math.min(100, b.maxKg), b.maxKg);
        const lead = b.sellAt === 'nha' ? `Chở về ${home} bán` : 'Chở sang vùng khác bán';
        return (
          <div className="deal" key={b.specialtyId}>
            <span className="emoji" aria-hidden="true">{CROPS[sp.crop].emoji}</span>
            <div className="grow">
              <strong>{sp.name}</strong>
              <small>Mua sỉ <b>{fmtMoney(b.wholesalePrice)}</b>/kg · {lead} <b>{fmtMoney(b.sellPrice)}</b>/kg</small>
              <span className={b.marginPerKg > 0 ? 'tag' : 'tag bad'}>{b.marginPerKg > 0 ? `Lời ${fmtMoney(b.marginPerKg)}/kg` : `Lỗ ${fmtMoney(-b.marginPerKg)}/kg`} · vùng còn {b.supplyLeftKg} kg hôm nay</span>
            </div>
            {info.canBuy && b.maxKg > 0 && (
              <div className="deal-buy">
                <div className="stepper">
                  <button aria-label="Bớt 50 kg" disabled={q <= 50} onClick={() => setQty({ ...qty, [b.specialtyId]: Math.max(50, q - 50) })}>−</button>
                  <b>{q} kg</b>
                  <button aria-label="Thêm 50 kg" disabled={q >= b.maxKg} onClick={() => setQty({ ...qty, [b.specialtyId]: Math.min(b.maxKg, q + 50) })}>+</button>
                </div>
                <button className="go" disabled={act.busy || me.user.cash < q * b.wholesalePrice} onClick={() => act.run(() => api('POST', '/api/wholesale/buy', { specialtyId: b.specialtyId, kg: q }))}>
                  Mua {fmtMoney(q * b.wholesalePrice)}
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
                  <small>Ở đây <b>{fmtMoney(s.priceHere)}</b>/kg · ở nhà {fmtMoney(s.priceHome)}/kg</small>
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

interface Shipment { id: number; specialtyId: string; quality: 'A' | 'B' | 'C'; kg: number; arriveKg: number; mode: ExportMode; market: ExportMarket; gatewayName: string; freight: number; payout: number; createdAt: number; arrivesAt: number; paidAt: number | null; status: 'dang_di' | 'da_toi' }
interface ExportOptions {
  allowedModes: ExportMode[]; role: string; inCoop: boolean; active: number; maxActive: number;
  stock: { specialtyId: string; quality: 'A' | 'B' | 'C'; kg: number; refPrice: number; quotes: ExportQuote[] }[];
}
export interface ExportSent { mode: ExportMode; market: ExportMarket; kg: number; specialtyId: string }

/** Xuất khẩu: chọn hàng trong kho → thị trường → đường đi; mỗi đường một giá cước, thời gian và hao hụt riêng. */
export function ExportPanel({ me, refresh, onSent }: { me: Me; refresh: () => void; onSent: (s: ExportSent) => void }) {
  const [opt, setOpt] = useState<ExportOptions | null>(null);
  const [ships, setShips] = useState<Shipment[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [market, setMarket] = useState<ExportMarket>('trung_quoc');
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    setOpt(await api<ExportOptions>('GET', '/api/export/options'));
    setShips((await api<{ shipments: Shipment[] }>('GET', '/api/export/shipments')).shipments);
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  if (!opt) return <p className="hint">Đang lấy báo giá xuất khẩu…</p>;
  const scale = me.config.timeScale || 1;
  const item = opt.stock.find((s) => s.specialtyId + s.quality === pick) ?? null;
  const going = ships.filter((s) => s.status === 'dang_di'), done = ships.filter((s) => s.status === 'da_toi').slice(0, 5);
  return (
    <div className="export">
      <p className="muted">Bán ra nước ngoài được giá hơn trong nước và không bị "được mùa mất giá". Chọn hàng, chọn nước mua, rồi chọn đường đi: mỗi đường có cước, thời gian và hao hụt riêng. Tiền về khi lô hàng tới nơi.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}

      <h3>1 · Chọn hàng trong kho</h3>
      {opt.stock.length === 0 ? <p className="hint">Kho chưa có hàng để xuất. Thu hoạch hoặc thu mua trước đã.</p> : (
        <div className="pick-row wrap">
          {opt.stock.map((s) => {
            const sp = SPECIALTIES[s.specialtyId], id = s.specialtyId + s.quality;
            return (
              <button key={id} className="pick" aria-pressed={pick === id} onClick={() => setPick(id)}>
                <span className="emoji" aria-hidden="true">{CROPS[sp.crop].emoji}</span><strong>{sp.name}</strong><small>{QUALITY_NAMES[s.quality]} · {s.kg} kg</small>
              </button>
            );
          })}
        </div>
      )}

      {item && (
        <>
          <h3>2 · Bán sang đâu</h3>
          <div className="pick-row wrap">
            {(Object.keys(EXPORT_MARKETS) as ExportMarket[]).map((m) => (
              <button key={m} className="pick" aria-pressed={market === m} onClick={() => setMarket(m)}>
                <span className="emoji" aria-hidden="true">{EXPORT_MARKETS[m].icon}</span><strong>{EXPORT_MARKETS[m].name}</strong>
                <small>giá ×{EXPORT_MARKETS[m].priceMult}{EXPORT_MARKETS[m].gradeA ? ' · chỉ Loại 1' : ''}</small>
              </button>
            ))}
          </div>
          <p className="muted">{EXPORT_MARKETS[market].note}</p>

          <h3>3 · Đi đường nào</h3>
          {item.quotes.filter((q) => q.market === market).map((q) => {
            const m = EXPORT_MODES[q.mode];
            return (
              <div className={q.ok ? 'route' : 'route off'} key={q.mode}>
                <span className="emoji" aria-hidden="true">{m.icon}</span>
                <div className="grow">
                  <strong>{m.name}</strong>
                  <small>{m.note}</small>
                  {q.ok ? (
                    <div className="route-facts">
                      <span>📦 {q.kg} kg</span>
                      <span>🧾 cước {fmtMoney(q.freight)}</span>
                      <span>⏱️ {fmtDuration((q.minutes * 60_000) / scale)}</span>
                      <span>{q.spoilKg > 0 ? `🥀 hao ${q.spoilKg} kg` : '✨ không hao'}</span>
                      <span>🏁 qua {q.gatewayName}{q.inlandKm > 0 ? ` (${q.inlandKm} km)` : ''}</span>
                    </div>
                  ) : <small className="error">{q.reason}</small>}
                </div>
                {q.ok && (
                  <button className="go" disabled={act.busy || me.user.cash < q.freight || opt.active >= opt.maxActive}
                    onClick={() => act.run(async () => { await api('POST', '/api/export/ship', { specialtyId: item.specialtyId, grade: item.quality, kg: q.kg, mode: q.mode, market: q.market }); onSent({ mode: q.mode, market: q.market, kg: q.kg, specialtyId: item.specialtyId }); setPick(null); })}>
                    Gửi đi<small>lãi {fmtMoney(q.net)}</small>
                  </button>
                )}
              </div>
            );
          })}
          {opt.active >= opt.maxActive && <p className="notice">Bạn đang có {opt.active} lô trên đường. Chờ một lô tới nơi rồi gửi tiếp.</p>}
        </>
      )}

      <h3>Lô hàng đang đi</h3>
      {going.length === 0 ? <p className="hint">Chưa có lô nào trên đường.</p> : going.map((s) => {
        const total = Math.max(1, s.arrivesAt - s.createdAt), p = Math.min(1, Math.max(0, (now - s.createdAt) / total));
        return (
          <div className="ship" key={s.id}>
            <span className="emoji" aria-hidden="true">{EXPORT_MODES[s.mode].icon}</span>
            <div className="grow">
              <strong>{s.kg} kg {SPECIALTIES[s.specialtyId].name} → {EXPORT_MARKETS[s.market].name}</strong>
              <div className="bar"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
              <small>{s.arrivesAt > now ? `Còn ${fmtDuration(s.arrivesAt - now)} · tiền về ${fmtMoney(s.payout)}` : 'Đã tới nơi, đang chốt tiền…'}</small>
            </div>
          </div>
        );
      })}
      {done.length > 0 && <><h3>Đã tới nơi</h3>{done.map((s) => (
        <div className="row-line" key={s.id}><div className="grow">{EXPORT_MODES[s.mode].icon} {s.arriveKg} kg {SPECIALTIES[s.specialtyId].name} → {EXPORT_MARKETS[s.market].name}</div><b>+{fmtMoney(s.payout)}</b></div>
      ))}</>}
      <WhyLimit k="export_role" /><WhyLimit k="export_min" /><WhyLimit k="export_active" /><WhyLimit k="export_grade" />
    </div>
  );
}
