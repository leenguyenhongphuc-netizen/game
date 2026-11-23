// Các màn hình phụ: hợp tác xã, quà tặng, du lịch, sổ sưu tập.
import './roles.css';
import { useCallback, useEffect, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES, ZONE_NAMES, specialtiesOfRegion } from '../../shared/catalog.ts';
import type { Zone } from '../../shared/catalog.ts';
import {
  COOP_BONUS, COOP_CAPITAL, COOP_MAX_MEMBERS, COOP_MIN_MEMBERS, COOP_REG_FEE, COOP_REG_MINUTES, COOP_STATUS_NAMES, COOP_ORDER_BONUS, GIFT_DAILY_LIMIT, QUALITY_NAMES, TRUCK, landPrice, tripPlan, REGION_SET_REWARD,
  SOUVENIR_DAILY_BUYS, SOUVENIR_MAX_KG, SOUVENIR_RATIO, TRAVEL_MODES, fmtMoney, travelOptions,
} from '../../shared/rules.ts';
import type { TravelMode } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Collection, Coop, CoopOrder, CoopRules, CoopSummary, GiftInbox, Me } from './api.ts';
import { fmtDuration, regionLabel, useAction } from './ui.ts';
import { NpcBadge } from './work.tsx';
import { CompareCard, WhyLimit } from './trade.tsx';
import { VietnamMap } from './map/VietnamMap.tsx';
import { SIGHT_PROVINCES } from '../../shared/sights.ts';
import { VEHICLES, tripPlanFor } from '../../shared/vehicles.ts';

const ZONES = Object.keys(ZONE_NAMES) as Zone[];
const pct = (n: number) => `${Math.round(n * 100)}%`;

// ------------------------------------------------------------------ hợp tác xã (Luật HTX 2023: đủ 5 thành viên, góp vốn, nộp hồ sơ ở cấp xã)
interface CoopInvite { coopId: number; name: string; status: string; byName: string; members: number }
interface CoopCandidate { userId: number; displayName: string; friend: boolean; resident: boolean }
export function CoopPanel({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [mine, setMine] = useState<Coop | null | undefined>(undefined);
  const [rules, setRules] = useState<CoopRules>({ minMembers: COOP_MIN_MEMBERS, maxMembers: COOP_MAX_MEMBERS, capital: COOP_CAPITAL, regFee: COOP_REG_FEE, regMinutes: COOP_REG_MINUTES });
  const [list, setList] = useState<CoopSummary[]>([]);
  const [invites, setInvites] = useState<CoopInvite[]>([]);
  const [people, setPeople] = useState<CoopCandidate[]>([]);
  const [name, setName] = useState('');
  const load = useCallback(async () => {
    const [m, l, i] = await Promise.all([api('GET', '/api/coops/mine'), api('GET', '/api/coops'), api('GET', '/api/coops/invites')]);
    setMine(m.coop); if (m.rules) setRules(m.rules); setList(l.coops); setInvites(i.invites ?? []);
    if (m.coop && m.coop.status === 'dang_lap') setPeople((await api('GET', '/api/coops/candidates')).people ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  if (mine === undefined) return <p className="hint">Đang tải…</p>;
  const law = <p className="muted">Theo Luật Hợp tác xã 2023: cần ít nhất <b>{rules.minMembers} thành viên</b> tự nguyện góp vốn (game: {fmtMoney(rules.capital)}/người, ra khỏi HTX được trả lại), nộp hồ sơ ở bộ phận một cửa cấp xã, lệ phí <b>{fmtMoney(rules.regFee)}</b>. Khi được cấp giấy, thành viên bán nông sản qua HTX với giá tại vườn cộng {pct(COOP_BONUS)} (thay vì bán tháo) và cùng làm đơn lớn của HTX.</p>;
  return (
    <div className="coop">
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {invites.length > 0 && !mine && (
        <div className="coop-invites">
          <h3>Lời mời vào hợp tác xã</h3>
          {invites.map((v) => (
            <div className="row row-line" key={v.coopId}>
              <div className="grow"><strong>{v.name}</strong><br /><small>{v.byName} mời · {v.members} thành viên · góp vốn {fmtMoney(rules.capital)}</small></div>
              <button className="go" disabled={act.busy || me.user.cash < rules.capital} onClick={() => act.run(() => api('POST', `/api/coops/${v.coopId}/accept`, {}))}>Đồng ý</button>
              <button disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/coops/${v.coopId}/decline`, {}))}>Từ chối</button>
            </div>
          ))}
        </div>
      )}
      {mine ? (
        <>
          <h3>{mine.name}</h3>
          <p className="coop-status"><span className={`tag ${mine.status ?? 'hoat_dong'}`}>{COOP_STATUS_NAMES[mine.status ?? 'hoat_dong']}</span>{mine.regNo && <small> · Giấy chứng nhận số {mine.regNo}</small>}{mine.capital ? <small> · vốn góp {fmtMoney(mine.capital)}</small> : null}</p>
          {mine.status === 'dang_lap' && (
            <div className="coop-steps">
              <ol>
                <li className={mine.members.length >= 1 ? 'done' : ''}>Người sáng lập góp vốn, soạn điều lệ</li>
                <li className={mine.members.length >= rules.minMembers ? 'done' : ''}>Vận động đủ {rules.minMembers} thành viên (đang có {mine.members.length})</li>
                <li>Nộp hồ sơ ở bộ phận một cửa cấp xã, lệ phí {fmtMoney(rules.regFee)}</li>
                <li>Nhận giấy chứng nhận đăng ký HTX (game rút còn {rules.regMinutes} phút; thật là 3 ngày làm việc)</li>
              </ol>
              {mine.ownerId === me.user.id && (
                <button className="go wide" disabled={act.busy || mine.members.length < rules.minMembers || me.user.cash < rules.regFee}
                  onClick={() => act.run(() => api('POST', `/api/coops/${mine.id}/register`, {}))}>
                  📝 Nộp hồ sơ đăng ký<small>{mine.members.length < rules.minMembers ? `còn thiếu ${rules.minMembers - mine.members.length} thành viên` : `lệ phí ${fmtMoney(rules.regFee)}`}</small>
                </button>
              )}
              <h4>Mời nhà vườn cùng vùng</h4>
              {people.length === 0 && <p className="hint">Chưa có nhà vườn nào cùng vùng đang rảnh. Kết bạn với hàng xóm ở thẻ Bạn bè rồi quay lại mời.</p>}
              {people.map((p) => {
                const sent = mine.invited?.some((v) => v.userId === p.userId);
                return (
                  <div className="row row-line" key={p.userId}>
                    <div className="grow"><strong>{p.displayName}</strong> {p.friend && <span className="tag">Bạn bè</span>}{p.resident && <span className="tag">Cư dân</span>}</div>
                    <button disabled={act.busy || sent} onClick={() => act.run(() => api('POST', `/api/coops/${mine.id}/invite`, { userId: p.userId }))}>{sent ? 'Đã mời' : 'Mời'}</button>
                  </div>
                );
              })}
            </div>
          )}
          {mine.status === 'cho_cap' && <p className="hint">Hồ sơ đã nộp. Cơ quan đăng ký cấp xã trả giấy chứng nhận sau khoảng {fmtDuration(Math.max(0, (mine.dueAt ?? Date.now()) - Date.now()))}.</p>}
          {(mine.status ?? 'hoat_dong') === 'hoat_dong' && <p className="muted">{regionLabel(mine.regionId)} · 7 ngày qua cả hợp tác xã bán {mine.kgWeek.toLocaleString('vi-VN')} kg</p>}
          {mine.order && <CoopOrderCard order={mine.order} me={me} act={act} />}
          <h3>Thành viên ({mine.members.length})</h3>
          {mine.members.map((m, i) => (
            <div className="row row-line" key={m.userId}>
              <span className="rank">{i + 1}</span>
              <div className="grow"><strong>{m.displayName}</strong>{m.userId === mine.ownerId && <span className="tag">Chủ tịch HĐQT</span>}</div>
              {(mine.status ?? 'hoat_dong') === 'hoat_dong' && <span className="num">{m.kgWeek.toLocaleString('vi-VN')} kg</span>}
            </div>
          ))}
          <button disabled={act.busy} onClick={() => { if (confirm(`Rời ${mine.name}? Bạn được trả lại vốn góp.`)) void act.run(() => api('POST', '/api/coops/leave', {})); }}>Rời hợp tác xã</button>
          {law}
        </>
      ) : (
        <>
          {law}
          <h3>Hợp tác xã ở {REGIONS[me.user.homeRegionId!].name}</h3>
          {list.length === 0 && <p className="hint">Vùng này chưa có hợp tác xã nào. Hãy đứng ra vận động thành lập.</p>}
          {list.map((c) => (
            <div className="row row-line" key={c.id}>
              <div className="grow"><strong>{c.name}</strong><br /><small>{COOP_STATUS_NAMES[c.status ?? 'hoat_dong']} · {c.ownerName} · {c.members} thành viên</small></div>
              <button disabled={act.busy || c.members >= rules.maxMembers || me.user.cash < rules.capital} onClick={() => act.run(() => api('POST', `/api/coops/${c.id}/join`, {}))}>Xin vào · góp {fmtMoney(rules.capital)}</button>
            </div>
          ))}
          <h3>Vận động thành lập hợp tác xã</h3>
          <form className="coop-new" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { await api('POST', '/api/coops', { name: name.trim() }); setName(''); }); }}>
            <input placeholder="Tên, ví dụ: Dâu tây Đà Lạt xanh" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={40} required aria-label="Tên hợp tác xã" />
            <button className="go" disabled={act.busy || me.user.cash < rules.capital}>Góp vốn {fmtMoney(rules.capital)} và lập</button>
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

// ------------------------------------------------------------------ du lịch: chọn nơi đến và phương tiện
export function TravelPanel({ me, startRide, startTrip, touring, openGarage }: {
  me: Me; touring: string | null;
  /** Mở Bãi xe & đại lý (khi chưa có xe hoặc muốn đổi xe). */
  openGarage?: () => void;
  startRide: (mode: TravelMode, regionId: string, km: number) => Promise<void>;
  startTrip?: (toRegionId: string) => Promise<void>;
}) {
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void api('GET', '/api/travel').then((r) => setVisited(new Set(r.visited))); }, []);
  const act = useAction();
  const home = me.user.homeRegionId!;
  const owned = new Set(me.plots.map((p) => p.regionId));
  // Xe đang lái (mọi vai đều có thể mua xe): thông số chuyến tính theo đúng chiếc xe đó
  const veh = (me.user as { vehicle?: { kind: string; name: string; cargoKg: number; unit: string; power: string; tank: number } | null }).vehicle ?? null, vspec = veh ? VEHICLES[veh.kind] : undefined;
  return (
    <div>
      <p className="muted">Đã tới {visited.size}/{Object.keys(REGIONS).length} vùng trồng. Chạm một ghim trên bản đồ hoặc chọn trong danh sách, rồi đi bằng xe khách, taxi, tàu hoả, máy bay hoặc tàu thuỷ. Tới nơi bạn được dạo vườn mẫu, ghé quầy trưng bày để mua đặc sản và sưu tập tem.</p>
      <VietnamMap regions={Object.values(REGIONS)} homeId={home} currentId={touring ?? home} visited={visited} owned={[...owned]} sightProvinces={SIGHT_PROVINCES} selectedId={open ?? undefined}
        onSelect={(id) => { setOpen(id); window.setTimeout(() => document.getElementById(`vung-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60); }} />
      <CompareCard isTrader={!!startTrip} />
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {ZONES.map((z) => (
        <div key={z}>
          <h3>{ZONE_NAMES[z]}</h3>
          {Object.values(REGIONS).filter((r) => r.zone === z).map((r) => {
            const here = (touring ?? home) === r.id;
            return (
              <div className="row" key={r.id} id={`vung-${r.id}`}>
                <button className="row-toggle" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <span><strong>{r.name}</strong>, {r.province}{r.formerProvince ? ` (${r.formerProvince} cũ)` : ''} {r.special && <span className="tag new">Vùng đặc biệt</span>} {here ? <span className="tag">Bạn đang ở đây</span> : r.id === home ? <span className="tag">Nhà</span> : owned.has(r.id) ? <span className="tag">Có đất</span> : visited.has(r.id) ? <span className="tag">Đã tới</span> : null}<br />
                    <small>{specialtiesOfRegion(r.id).map((sp) => sp.name).join(' · ')}</small></span>
                </button>
                {open === r.id && r.id !== home && (
                  <div className="region-body">
                    <div className="pick-row">
                      {travelOptions(home, r.id).map((o) => (
                        <button key={o.mode} className="pick" disabled={act.busy || me.user.cash < o.fare} onClick={() => act.run(() => startRide(o.mode, r.id, o.km))}>
                          <span className="emoji">{TRAVEL_MODES[o.mode].icon}</span><strong>{TRAVEL_MODES[o.mode].name}</strong><small>{o.km} km · {fmtMoney(o.fare)}</small>
                        </button>
                      ))}
                    </div>
                    {startTrip && (me.user.truckRegionId ?? home) !== r.id && (() => {
                      const at = me.user.truckRegionId ?? home, plan = vspec ? tripPlanFor(vspec, at, r.id) : tripPlan(at, r.id), fuel = me.user.fuelL ?? TRUCK.startFuelL;
                      const unit = veh?.unit ?? 'lít', ev = veh?.power === 'dien', cargo = veh?.cargoKg ?? plan.cargoKg ?? TRUCK.cargoKg, rests = vspec ? (plan as ReturnType<typeof tripPlanFor>).restsNeeded : 0;
                      const stops = ev ? (plan as ReturnType<typeof tripPlanFor>).chargersAtKm.length : plan.stationsAtKm.length;
                      const cargoTxt = cargo >= 1000 ? `${(cargo / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tấn` : `${cargo} kg`;
                      return (
                        <div className="trip-card">
                          <strong>{ev ? '⚡' : '🚚'} Tự lái {veh ? veh.name.replace(/^Xe /, 'xe ') : 'xe tải'} đi buôn</strong>
                          <small>Chở hàng trong kho tới bán giá ở đó{me.user.role === 'thuong_lai' ? `, rồi thu mua sỉ tới ${cargoTxt} đặc sản chở về` : ` (xe chở được ${cargoTxt})`}. Tiền {ev ? 'điện' : 'xăng dầu'} và phí đường là tiền vốn của chuyến buôn.{rests > 0 ? ` Chuyến dài ${(plan as ReturnType<typeof tripPlanFor>).driveHours} giờ lái: phải ghé trạm dừng nghỉ ${rests} lần.` : ''}</small>
                          <div className="facts">
                            <div><span aria-hidden="true">🛣️</span><b>{plan.km} km</b><small>{plan.needsBoat ? 'có chặng tàu' : `${plan.junctions.length} nút giao`}</small></div>
                            <div><span aria-hidden="true">{ev ? '🔋' : '⛽'}</span><b>{plan.fuelNeededL} {unit}</b><small>{fuel >= plan.fuelNeededL ? `${ev ? 'pin' : 'bình'} đang có ${fuel.toFixed(0)}` : `thiếu ${(plan.fuelNeededL - fuel).toFixed(0)}, ghé ${stops} trạm${ev ? ' sạc' : ''}`}</small></div>
                            <div><span aria-hidden="true">🎫</span><b>{fmtMoney(plan.tolls * plan.tollFee)}</b><small>{plan.tolls} trạm thu phí{(me.user.etc ?? 0) < plan.tolls * plan.tollFee ? ' · ETC thiếu' : ''}</small></div>
                          </div>
                          <button className="primary" disabled={act.busy || fuel <= 0} onClick={() => act.run(() => startTrip(r.id))}>{fuel <= 0 ? `Hết ${ev ? 'pin' : 'xăng'}: lên xe ${ev ? 'sạc' : 'đổ'} trước` : 'Lên đường'}</button>
                          {openGarage && <button type="button" className="link" onClick={openGarage}>Đổi xe, mua xe ở Bãi xe</button>}
                        </div>
                      );
                    })()}
                    {!startTrip && openGarage && (me.user.truckRegionId ?? home) !== r.id && (
                      <div className="trip-card">
                        <strong>🚚 Tự lái xe chở hàng đi bán</strong>
                        <small>{veh ? `Bạn đang có ${veh.name}.` : 'Bạn chưa có xe.'} Có xe riêng thì chở hàng trong kho tới bán theo giá ở nơi đến, không phải bán tại vườn.</small>
                        <button type="button" className="primary" onClick={openGarage}>{veh ? 'Mở Bãi xe' : 'Mua xe ở Bãi xe'}</button>
                      </div>
                    )}
                    {startTrip && (me.user.truckRegionId ?? home) === r.id && <span className="tag">🚚 Xe tải đang đỗ ở đây</span>}
                  </div>
                )}
                {open === r.id && r.id === home && <div className="region-body"><small className="muted">Đây là vùng nhà của bạn.</small></div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ quầy trưng bày ở nơi đến
export function ShowcasePanel({ me, regionId, priceOf, refresh, visit }: { me: Me; regionId: string; priceOf: (id: string) => number; refresh: () => void; visit: (plotId: number) => void }) {
  const [have, setHave] = useState<Set<string>>(new Set());
  const [farms, setFarms] = useState<{ total: number; farms: { plotId: number; ownerName: string; growing: number; wardName?: string | null }[] } | null>(null);
  const load = useCallback(async () => { setHave(new Set((await api<Collection>('GET', '/api/collection')).specialties)); }, []);
  useEffect(() => { void load(); void api('GET', `/api/regions/${regionId}/farms`).then(setFarms).catch(() => setFarms({ total: 0, farms: [] })); }, [load, regionId]);
  const act = useAction(() => { void load(); refresh(); });
  const r = REGIONS[regionId], sps = specialtiesOfRegion(regionId);
  const owned = me.plots.some((p) => p.regionId === regionId);
  return (
    <div>
      <p className="muted">Đặc sản của {r.name}. Mua về làm quà là được một con tem trong sổ sưu tập. Mỗi lần tối đa {SOUVENIR_MAX_KG} kg, mỗi ngày {SOUVENIR_DAILY_BUYS} lần, giá bằng {pct(SOUVENIR_RATIO)} giá tham chiếu.</p>
      <WhyLimit k="souvenir" />
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <div className="stamps showcase">
        {sps.map((sp) => {
          const price = Math.round(priceOf(sp.id) * SOUVENIR_RATIO);
          return (
            <div key={sp.id} className={`stamp ${have.has(sp.id) ? 'got' : 'todo'}`}>
              <span className="emoji">{CROPS[sp.crop].emoji}</span><strong>{sp.name}</strong>
              <small>{have.has(sp.id) ? 'Đã có tem ✓' : 'Chưa có tem'}</small>
              <button disabled={act.busy || me.user.cash < price} onClick={() => act.run(() => api('POST', '/api/souvenir', { regionId, specialtyId: sp.id, kg: 1 }))}>Mua 1 kg · {fmtMoney(price)}</button>
            </div>
          );
        })}
      </div>
      <h3>Vườn của người chơi ở {r.name}</h3>
      {farms === null ? <p className="hint">Đang tải…</p> : farms.farms.length === 0 ? <p className="hint">Chưa có ai lập vườn ở đây.</p> : farms.farms.map((f) => (
        <div className="row-line" key={f.plotId}><div className="grow">{f.ownerName} <small className="muted">· {f.wardName ? `${f.wardName} · ` : ''}đang trồng {f.growing} ô</small></div><button onClick={() => visit(f.plotId)}>Ghé thăm</button></div>
      ))}
      <h3>Mua đất ở đây</h3>
      {owned ? <p className="hint">Bạn đã có đất ở {r.name}.</p> : <><p className="muted">Giá đất ở {r.name}: <b>{fmtMoney(landPrice(regionId))}</b> một lô. Vùng cho nông sản giá trị cao{r.island ? ', lại ở đảo,' : ''} thì đất đắt hơn.</p><button disabled={act.busy || me.user.cash < landPrice(regionId)} onClick={() => act.run(() => api('POST', '/api/plots/buy', { regionId }))}>{me.user.cash < landPrice(regionId) ? `Cần ${fmtMoney(landPrice(regionId))} để mua một lô` : `Mua một lô ${fmtMoney(landPrice(regionId))}`}</button></>}
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
