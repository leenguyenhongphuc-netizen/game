// Người chơi thấy nhau (hiện diện) và cư dân ảo giữ cho chợ, cao tốc, trạm dừng luôn có người.
// Dùng chung cho máy chủ (server/src/social.ts) và trình duyệt (web/src/presence.ts).

export type PresenceScene = 'village' | 'highway' | 'rest_stop' | 'sight' | 'market';
export const PRESENCE_SCENES: PresenceScene[] = ['village', 'highway', 'rest_stop', 'sight', 'market'];
/** Một người không gửi nhịp quá lâu thì coi như đã rời cảnh. */
export const PRESENCE_TTL_MS = 10_000;
/** Số người tối đa trả về cho một cảnh (gần nhất trước). */
export const PRESENCE_MAX = 24;
/** Nhịp gửi: đang có người khác cùng cảnh thì nhanh, ở một mình thì thưa để đỡ tốn truy vấn. */
export const PRESENCE_INTERVAL = { busy: 2_500, highway: 2_000, alone: 5_000 };
/** Cao tốc: chỉ trả người cách mình trong khoảng này (km, theo trục chuyến đi). */
export const HIGHWAY_WINDOW_KM = 80;

/** Cư dân ảo: chạy một lượt cho vài người mỗi lần, cách nhau ít nhất chừng này (ms thật). */
export const BOT_TICK_MS = 120_000;
export const BOT_BATCH = 12;
/** Mỗi vùng trồng có hai cư dân: một nhà vườn và một thương lái hoặc chủ xưởng. */
export const BOTS_PER_REGION = 2;
/** Vốn ban đầu một lần khi lập cư dân (như người chơi cấp trung bình), sau đó chỉ thay đổi qua mua bán thật. */
export const BOT_START_CASH: Record<'nong_dan' | 'thuong_lai' | 'xuong', number> = { nong_dan: 30_000_000, thuong_lai: 250_000_000, xuong: 250_000_000 };
/** Sản lượng một nhà vườn ảo mỗi giờ trong game cho mỗi đặc sản của vùng (tương đương ~6 ô đất). */
export const BOT_FARM_KG_PER_HOUR = 12;
export const BOT_STOCK_CAP = 300;
export const BOT_MAX_LISTINGS = 3;
/** Thương lái/chủ xưởng ảo mua tin rao giá không quá tỉ lệ này so với giá tham chiếu (đã nhân hệ số chất lượng). */
export const BOT_BUY_MAX_RATIO = 1.15;
export const BOT_LISTING_HOURS = 4;

export interface PresenceAvatar { shirt?: string; hat?: string; truck?: string }
export interface PresenceOutfit { ao?: string | null; non?: string | null; phu_kien?: string | null }
/** Kịch bản để trình duyệt tự cho cư dân ảo đi lại (không tốn truy vấn). */
export interface BotScript { kind: 'stroll' | 'rest'; seed: number; t0: number }
export interface PresenceOther {
  id: number; name: string; role: string | null; bot: boolean;
  avatar: PresenceAvatar | null; outfit: PresenceOutfit | null;
  vehicle: { group: string; color: string } | null;
  /** Cảnh làng, trạm dừng, điểm tham quan: toạ độ trong cảnh. */
  x?: number; z?: number; yaw?: number; speed?: number; walk?: boolean;
  car?: { x: number; z: number; yaw: number } | null;
  /** Cao tốc: cách mình bao nhiêu km theo hướng mình đi (âm = phía sau), cùng chiều hay ngược chiều, tốc độ km mỗi giây thật. */
  aheadKm?: number; sameDir?: boolean; kmps?: number;
  script?: BotScript;
  /** Tuổi của số liệu khi máy chủ trả (ms) để trình duyệt ngoại suy. */
  ageMs: number;
}
export interface PresenceIn {
  scene: PresenceScene; key: string;
  x?: number; z?: number; yaw?: number; speed?: number; walk?: boolean;
  car?: { x: number; z: number; yaw: number } | null;
  /** Cao tốc: km đã đi trên chuyến, tổng km chuyến, chiều (1: từ vùng mã nhỏ sang vùng mã lớn), km mỗi giây thật. */
  km?: number; totalKm?: number; dir?: 1 | -1; kmps?: number;
  count?: boolean;
}
export interface PresenceOut { at: number; interval: number; others: PresenceOther[]; online?: number; bots?: boolean }

/** Khoá cảnh cao tốc: cặp vùng sắp theo mã, kèm chiều đi của mình. */
export function highwayKey(fromRegionId: string, toRegionId: string): { key: string; dir: 1 | -1 } {
  return fromRegionId <= toRegionId ? { key: `${fromRegionId}|${toRegionId}`, dir: 1 } : { key: `${toRegionId}|${fromRegionId}`, dir: -1 };
}

export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Số giả ngẫu nhiên 0..1 cố định theo hạt giống và chỉ số. */
export function rand01(seed: number, n = 0): number { return hash32(`${seed}:${n}`) / 4294967296; }

const CALLS = ['Cô', 'Chú', 'Anh', 'Chị', 'Bác', 'Dì', 'Ông', 'Em'];
const ORDER = ['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Út', ''];
const GIVEN = ['Hạnh', 'Lộc', 'Phúc', 'Tâm', 'Lan', 'Hùng', 'Mai', 'Thảo', 'Quang', 'Dũng', 'Hoa', 'Nga', 'Trung', 'Sơn', 'Hải', 'Hương', 'Bình', 'Linh', 'Khoa', 'Vy',
  'Tuấn', 'Nhung', 'Thắm', 'Lợi', 'Cường', 'Diệu', 'Hiền', 'Kiên', 'Nhàn', 'Thịnh', 'Trinh', 'Xuân', 'Yến', 'Đào', 'Phượng', 'Sang', 'Tài', 'Thu', 'Vân', 'Bé'];
/** Tên hiển thị kiểu xóm làng ("Cô Ba Hạnh", "Anh Khoa") — cố định theo số thứ tự. */
export function botDisplayName(i: number): string {
  const h = hash32(`ten:${i}`), call = CALLS[h % CALLS.length], ord = ORDER[(h >>> 8) % ORDER.length], given = GIVEN[(h >>> 16) % GIVEN.length];
  return [call, ord, given].filter(Boolean).join(' ');
}
