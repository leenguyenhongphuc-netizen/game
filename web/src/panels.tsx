// Các màn hình phụ: hợp tác xã, quà tặng, du lịch, sổ sưu tập.
import { useCallback, useEffect, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES, ZONE_NAMES, specialtiesOfRegion } from '../../shared/catalog.ts';
import type { Zone } from '../../shared/catalog.ts';
import {
  COOP_BONUS, COOP_CREATE_COST, COOP_MAX_MEMBERS, COOP_ORDER_BONUS, GIFT_DAILY_LIMIT, LAND_PRICE, QUALITY_NAMES, REGION_SET_REWARD,
  SOUVENIR_DAILY_BUYS, SOUVENIR_MAX_KG, SOUVENIR_RATIO, TRAVEL_COST, fmtMoney,
} from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Collection, Coop, CoopOrder, CoopSummary, GiftInbox, Me } from './api.ts';
import { fmtDuration, regionLabel, useAction } from './ui.ts';
import { NpcBadge } from './work.tsx';

const ZONES = Object.keys(ZONE_NAMES) as Zone[];
const pct = (n: number) => `${Math.round(n * 100)}%`;

// ------------------------------------------------------------------ hợp tác xã
export function CoopPanel({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [mine, setMine] = useState<Coop | null | undefined>(undefined);
  const [list, setList] = useState<CoopSummary[]>([]);
  const [name, setName] = useState('');
  const load = useCallback(async () => {
    const [m, l] = await Promise.all([api('GET', '/api/coops/mine'), api('GET', '/api/coops')]);
    setMine(m.coop); setList(l.coops);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  if (mine === undefined) return <p className="hint">Đang tải…</p>;
  return (
    <div>
      <p className="muted">Hợp tác xã gom người trồng cùng vùng. Thành viên bán cho thương lái được cộng {pct(COOP_BONUS)} giá. Mỗi hợp tác xã tối đa {COOP_MAX_MEMBERS} người.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {mine ? (
        <>
          <h3>{mine.name}</h3>
          <p className="muted">{regionLabel(mine.regionId)} · 7 ngày qua cả hợp tác xã bán {mine.kgWeek.toLocaleString('vi-VN')} kg</p>
          {mine.order && <CoopOrderCard order={mine.order} me={me} act={act} />}
          <h3>Thành viên</h3>
          {mine.members.map((m, i) => (
            <div className="row row-line" key={m.userId}>
              <span className="rank">{i + 1}</span>
              <div className="grow"><strong>{m.displayName}</strong>{m.userId === mine.ownerId && <span className="tag">Chủ nhiệm</span>}</div>
              <span className="num">{m.kgWeek.toLocaleString('vi-VN')} kg</span>
            </div>
          ))}
          <button disabled={act.busy} onClick={() => { if (confirm(`Rời hợp tác xã ${mine.name}?`)) void act.run(() => api('POST', '/api/coops/leave', {})); }}>Rời hợp tác xã</button>
        </>
      ) : (
        <>
          <h3>Hợp tác xã ở {REGIONS[me.user.homeRegionId!].name}</h3>
          {list.length === 0 && <p className="hint">Vùng này chưa có hợp tác xã nào. Hãy lập cái đầu tiên.</p>}
          {list.map((c) => (
            <div className="row row-line" key={c.id}>
              <div className="grow"><strong>{c.name}</strong><br /><small>Chủ nhiệm {c.ownerName} · {c.members}/{COOP_MAX_MEMBERS} người</small></div>
              <button disabled={act.busy || c.members >= COOP_MAX_MEMBERS} onClick={() => act.run(() => api('POST', `/api/coops/${c.id}/join`, {}))}>Xin vào</button>
            </div>
          ))}
          <h3>Lập hợp tác xã mới</h3>
          <form className="row-line" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { await api('POST', '/api/coops', { name: name.trim() }); setName(''); }); }}>
            <input className="grow" placeholder="Tên hợp tác xã" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={30} required aria-label="Tên hợp tác xã" />
            <button disabled={act.busy || me.user.cash < COOP_CREATE_COST}>Lập · {fmtMoney(COOP_CREATE_COST)}</button>
          </form>
        </>
      )}
    </div>
  );
}

function CoopOrderCard({ order, me, act }: { order: CoopOrder; me: Me; act: ReturnType<typeof useAction> }) {
  const sp = SPECIALTIES[order.specialtyId];
  const stock = me.inventory.filter((i) => i.specialtyId === order.specialtyId);
  const left = order.kgTarget - order.kgFilled;
  return (
    <div className="row order-card">
      <div className="row-line"><span className="emoji">{CROPS[sp.crop].emoji}</span><div className="grow"><strong>Đơn lớn: {order.kgTarget.toLocaleString('vi-VN')} kg {sp.name}</strong><br /><NpcBadge id={order.npcId} /></div></div>
      <div className="progress"><i className="done" style={{ flex: Math.max(order.kgFilled, 0.001) }} /><i style={{ flex: Math.max(left, 0.001) }} /></div>
      <small>Đã góp {order.kgFilled}/{order.kgTarget} kg · bạn góp {order.mine} kg · còn {fmtDuration(order.expiresAt - Date.now())}. Góp được trả ngay theo giá tham chiếu; đủ đơn, mỗi người được thưởng thêm {pct(COOP_ORDER_BONUS)} phần mình góp.</small>
      {stock.length === 0 ? <small className="muted">Kho bạn chưa có {sp.name} để góp.</small> : stock.map((i) => (
        <button key={i.quality} disabled={act.busy || left <= 0} onClick={() => act.run(() => api('POST', '/api/coops/order/contribute', { quality: i.quality, kg: Math.min(i.kg, left) }))}>Góp {Math.min(i.kg, left)} kg {QUALITY_NAMES[i.quality]}</button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ quà tặng
export function GiftsPanel() {
  const [data, setData] = useState<GiftInbox | null>(null);
  useEffect(() => {
    void (async () => { setData(await api<GiftInbox>('GET', '/api/gifts')); await api('POST', '/api/gifts/seen', {}); })();
  }, []);
  if (!data) return <p className="hint">Đang tải…</p>;
  return (
    <div>
      <p className="muted">Quà bạn bè gửi sẽ vào thẳng kho và được ghi vào sổ sưu tập. Muốn tặng, mở Kho & Sạp rồi chọn “Tặng bạn”. Mỗi ngày gửi tối đa {GIFT_DAILY_LIMIT} món.</p>
      {data.inbox.length === 0 && <p className="hint">Chưa có ai gửi quà cho bạn.</p>}
      {data.inbox.map((g) => {
        const sp = SPECIALTIES[g.specialtyId];
        return (
          <div className="row row-line" key={g.id}>
            <span className="emoji">{CROPS[sp.crop].emoji}</span>
            <div className="grow"><strong>{g.kg} kg {sp.name}</strong> <span className="tag">{QUALITY_NAMES[g.quality]}</span>{!g.seen && <span className="tag new">Mới</span>}<br />
              <small>Từ {g.fromName} · {new Date(g.createdAt).toLocaleDateString('vi-VN')}</small>{g.message && <p className="gift-note">“{g.message}”</p>}</div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ du lịch
export function TravelPanel({ me, priceOf, refresh, visit }: { me: Me; priceOf: (id: string) => number; refresh: () => void; visit: (plotId: number) => void }) {
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [farms, setFarms] = useState<{ total: number; farms: { plotId: number; ownerName: string; growing: number; wardName?: string | null }[] } | null>(null);
  const load = useCallback(async () => { setVisited(new Set((await api('GET', '/api/travel')).visited)); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setFarms(null);
    if (open) void api('GET', `/api/regions/${open}/farms`).then(setFarms).catch(() => setFarms({ total: 0, farms: [] }));
  }, [open, me.plots.length]);
  const act = useAction(() => { void load(); refresh(); });
  const owned = new Set(me.plots.map((p) => p.regionId));
  return (
    <div>
      <p className="muted">Đã tới {visited.size}/{Object.keys(REGIONS).length} vùng trồng. Vé đi mỗi vùng mới {fmtMoney(TRAVEL_COST)}. Tới nơi, bạn mua được đặc sản làm quà (tối đa {SOUVENIR_MAX_KG} kg mỗi lần, {SOUVENIR_DAILY_BUYS} lần mỗi ngày, giá bằng {pct(SOUVENIR_RATIO)} giá tham chiếu), ghé vườn người khác để phụ thu hoạch và mua tại sạp, hoặc mua đất {fmtMoney(LAND_PRICE)}.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {ZONES.map((z) => (
        <div key={z}>
          <h3>{ZONE_NAMES[z]}</h3>
          {Object.values(REGIONS).filter((r) => r.zone === z).map((r) => {
            const been = visited.has(r.id);
            return (
              <div className="row" key={r.id}>
                <button className="row-toggle" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <span><strong>{r.name}</strong>, {r.province}{r.formerProvince ? ` (${r.formerProvince} cũ)` : ''} {r.special && <span className="tag new">Vùng đặc biệt</span>} {owned.has(r.id) ? <span className="tag">Có đất</span> : been ? <span className="tag">Đã tới</span> : null}<br />
                    <small>{specialtiesOfRegion(r.id).map((s) => s.name).join(' · ')}</small></span>
                </button>
                {open === r.id && (
                  <div className="region-body">
                    {!been && <button className="primary" disabled={act.busy || me.user.cash < TRAVEL_COST} onClick={() => act.run(() => api('POST', '/api/travel', { regionId: r.id }))}>🚌 Đi {r.name} · {fmtMoney(TRAVEL_COST)}</button>}
                    {been && (
                      <>
                        <small className="muted">Mua đặc sản làm quà (1 kg)</small>
                        {specialtiesOfRegion(r.id).map((sp) => {
                          const price = Math.round(priceOf(sp.id) * SOUVENIR_RATIO);
                          return (
                            <div className="row-line" key={sp.id}>
                              <span className="emoji">{CROPS[sp.crop].emoji}</span><div className="grow">{sp.name}</div>
                              <button disabled={act.busy || me.user.cash < price} onClick={() => act.run(() => api('POST', '/api/souvenir', { regionId: r.id, specialtyId: sp.id, kg: 1 }))}>Mua {fmtMoney(price)}</button>
                            </div>
                          );
                        })}
                        {!owned.has(r.id) && <button disabled={act.busy || me.user.cash < LAND_PRICE} onClick={() => act.run(() => api('POST', '/api/plots/buy', { regionId: r.id }))}>{me.user.cash < LAND_PRICE ? `Cần ${fmtMoney(LAND_PRICE)} để mua đất ở đây` : `Mua đất ở đây ${fmtMoney(LAND_PRICE)}`}</button>}
                        {farms === null ? <p className="hint">Đang tải…</p> : farms.farms.length === 0 ? <p className="hint">Chưa có ai lập vườn ở đây.</p> : (
                          <>
                            <small className="muted">{farms.total} mảnh vườn</small>
                            {farms.farms.map((f) => (
                              <div className="row-line" key={f.plotId}><div className="grow">{f.ownerName} <small className="muted">· {f.wardName ? `${f.wardName} · ` : ''}đang trồng {f.growing} ô</small></div><button onClick={() => visit(f.plotId)}>Ghé thăm</button></div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ sổ sưu tập
export function AlbumPanel() {
  const [data, setData] = useState<Collection | null>(null);
  useEffect(() => { void api<Collection>('GET', '/api/collection').then(setData); }, []);
  if (!data) return <p className="hint">Đang tải…</p>;
  const have = new Set(data.specialties), rewarded = new Set(data.regionsRewarded);
  const total = Object.keys(SPECIALTIES).length;
  return (
    <div>
      <p className="muted">Mỗi đặc sản bạn thu hoạch, mua hoặc được tặng sẽ thành một con tem. Gom đủ tem của một vùng được thưởng {fmtMoney(REGION_SET_REWARD)}.</p>
      <div className="album-total"><strong>{have.size}/{total}</strong> đặc sản<div className="progress"><i className="done" style={{ flex: have.size }} /><i style={{ flex: total - have.size }} /></div></div>
      {ZONES.map((z) => (
        <div key={z}>
          <h3>{ZONE_NAMES[z]}</h3>
          {Object.values(REGIONS).filter((r) => r.zone === z).map((r) => {
            const sps = specialtiesOfRegion(r.id), got = sps.filter((s) => have.has(s.id)).length;
            return (
              <div className="row" key={r.id}>
                <div className="row-line"><div className="grow"><strong>{r.name}</strong>, {r.province}</div>{rewarded.has(r.id) ? <span className="tag">Trọn bộ ✓</span> : <small>{got}/{sps.length}</small>}</div>
                <div className="stamps">
                  {sps.map((s) => (
                    <div key={s.id} className={`stamp ${have.has(s.id) ? 'got' : ''}`}><span className="emoji">{CROPS[s.crop].emoji}</span><small>{have.has(s.id) ? s.name : '???'}</small></div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
