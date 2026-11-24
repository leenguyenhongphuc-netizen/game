// Đi phượt theo đoàn: trưởng đoàn lập đoàn trên một cung đường, mời bạn bè hoặc đưa mã đoàn cho người cùng tuyến,
// cả đoàn xuất phát cùng lúc, tập trung ở điểm chụp ảnh/quán, về đích cùng nhau được thưởng thêm EXP.

/** Tối đa 8 xe một đoàn (đoàn phượt đông hơn khó giữ đội hình trên đèo). */
export const CONVOY_MAX = 8;
/** Mã đoàn 6 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L). */
export const CONVOY_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CONVOY_CODE_LEN = 6;
/** Đoàn lập quá lâu mà không chạy thì tự giải tán; về đích cách nhau trong khoảng này mới tính là "về cùng nhau". */
export const CONVOY_RULES = { formMinutes: 60, togetherMinutes: 15, bonusXpRatio: 0.5, rallyWaitSec: 90 };
/** Màu nhãn của từng thành viên theo thứ tự vào đoàn (trưởng đoàn luôn màu đầu). */
export const CONVOY_COLORS = ['#e8412f', '#1f6fb8', '#2e9e4f', '#f0a51e', '#8e44ad', '#16a085', '#d35400', '#c2185b'];

export type ConvoyStatus = 'lap' | 'chay' | 'xong' | 'giai_tan';
export interface ConvoyMember {
  userId: number; name: string; color: string; leader: boolean; me: boolean;
  /** Đã chọn xe và sẵn sàng xuất phát. */
  ready: boolean;
  /** Km đã chạy (cập nhật khi đang chạy), đang đứng ở điểm dừng nào. */
  km: number; atStop: string | null; finished: boolean; aborted: boolean; seenAgoSec: number | null;
}
export interface ConvoyView {
  id: number; code: string; routeId: string; status: ConvoyStatus; leaderId: number; startedAt: number | null;
  members: ConvoyMember[];
  /** Lời mời đang chờ (chỉ trưởng đoàn thấy). */
  invited: { userId: number; name: string }[];
  /** Xe chính mình đã chọn khi sẵn sàng ("xe:<id>" hoặc "thue:<loại>"), để máy tự lên đường khi trưởng đoàn cho xuất phát. */
  myPick: string | null;
}
export interface ConvoyInvite { convoyId: number; code: string; routeId: string; leader: string; members: number }

export const normCode = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CONVOY_CODE_LEN);
export function makeCode(rnd: () => number = Math.random): string {
  let s = ''; for (let i = 0; i < CONVOY_CODE_LEN; i++) s += CONVOY_CODE_CHARS[Math.floor(rnd() * CONVOY_CODE_CHARS.length)];
  return s;
}
/** Ai đang ở điểm dừng `stopId` hoặc đã qua km của nó (để biết đã đủ người tập trung chưa). */
export function rallyCount(members: ConvoyMember[], stopId: string, stopKm: number): { here: number; total: number; waiting: string[] } {
  const active = members.filter((m) => !m.aborted);
  const here = active.filter((m) => m.atStop === stopId || m.km >= stopKm - 0.05 || m.finished);
  return { here: here.length, total: active.length, waiting: active.filter((m) => !here.includes(m)).map((m) => m.name) };
}
