// Bộ biểu tượng vẽ riêng cho Vườn Việt: nét nâu gỗ dày, hai sắc độ, bo tròn — thay cho emoji ở những chỗ luôn hiện trên màn.
import type { JSX } from 'react';

const O = '#56310f'; // nét viền
const S = { stroke: O, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

const ICONS = {
  /** Sọt tre đầy trái — Kho */
  kho: (
    <>
      <path d="M5 14h22l-2.4 12.2a2 2 0 0 1-2 1.6H9.4a2 2 0 0 1-2-1.6z" fill="#e0a55a" {...S} />
      <path d="M8 19h16M9 23.5h14M12 14.5v13M16 14.5v13M20 14.5v13" stroke="#a86a2a" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="4" fill="#ff8a3d" {...S} /><circle cx="18" cy="9.5" r="4.4" fill="#ffd23f" {...S} /><circle cx="23" cy="12" r="3.4" fill="#7ccf4f" {...S} />
      <path d="M17.5 5.4q1.6-2 3.6-1.6" fill="none" {...S} />
    </>),
  /** Sạp chợ mái bạt sọc — Chợ */
  cho: (
    <>
      <path d="M4 12l2.5-6h19L28 12z" fill="#f4efe2" {...S} />
      <path d="M9.6 6l-1.4 6M14 6l-.6 6M18 6l.6 6M22.4 6l1.4 6" stroke="#e2573c" strokeWidth="3.2" />
      <path d="M4 12q2 3.2 4 0q2 3.2 4 0q2 3.2 4 0q2 3.2 4 0q2 3.2 4 0q2 3.2 4 0" fill="#e2573c" {...S} />
      <path d="M6.5 15v12M25.5 15v12" {...S} />
      <path d="M6.5 20h19v7h-19z" fill="#d9a35b" {...S} />
      <circle cx="12" cy="18.6" r="2.3" fill="#ffd23f" {...S} /><circle cx="17" cy="18.2" r="2.6" fill="#ff8a3d" {...S} /><circle cx="21.6" cy="18.8" r="2" fill="#7ccf4f" {...S} />
    </>),
  /** Hai mái nhà cạnh nhau — Xóm */
  xom: (
    <>
      <path d="M3 17l7-7 7 7v10H3z" fill="#fff1c9" {...S} /><path d="M1.5 17.5L10 9l8.5 8.5" fill="none" stroke="#d2553a" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M17 19l6-6 6 6v8H17z" fill="#ffe4a8" {...S} /><path d="M15.8 19.4L23 12.2l7.2 7.2" fill="none" stroke="#2f7d26" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M8 27v-6h4v6" fill="#a86a2a" {...S} /><rect x="21" y="21" width="4" height="3.6" rx=".6" fill="#8fd3f0" {...S} />
    </>),
  /** Ghim bản đồ trên tờ bản đồ gấp — Du lịch */
  dulich: (
    <>
      <path d="M3 10l8-3 10 3 8-3v17l-8 3-10-3-8 3z" fill="#bfe6a8" {...S} />
      <path d="M11 7v17M21 10v17" stroke="#6fae54" strokeWidth="1.6" />
      <path d="M5.5 20q4-5 7.5-2t6-3 6.5-.5" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="2.4 2.4" strokeLinecap="round" />
      <path d="M22 3.5a5 5 0 0 1 5 5c0 3.6-5 8.5-5 8.5s-5-4.9-5-8.5a5 5 0 0 1 5-5z" fill="#e2573c" {...S} /><circle cx="22" cy="8.4" r="1.9" fill="#fff" />
    </>),
  /** Chổi sơn và bảng màu — Trang trí */
  trangtri: (
    <>
      <path d="M15 4c7.2 0 13 4.6 13 10.6 0 3.8-2.6 5.6-5.4 5.6h-2.4c-1.6 0-2.4 1.2-1.8 2.6.9 2-.3 4.6-3.4 4.6C8.4 27.4 3 22 3 15.6 3 9.2 8.4 4 15 4z" fill="#f6e3b4" {...S} />
      <circle cx="10" cy="12" r="2.3" fill="#e2573c" {...S} /><circle cx="16.5" cy="9" r="2.3" fill="#ffd23f" {...S} /><circle cx="22.5" cy="12.4" r="2.3" fill="#4aa3d8" {...S} /><circle cx="9.4" cy="19" r="2.3" fill="#7ccf4f" {...S} />
    </>),
  /** Đồng xu có bông lúa */
  xu: (
    <>
      <ellipse cx="16" cy="18" rx="12" ry="11" fill="#c98a00" {...S} /><ellipse cx="16" cy="15" rx="12" ry="11" fill="#ffcf3a" {...S} />
      <ellipse cx="16" cy="15" rx="8.2" ry="7.4" fill="#ffe27a" stroke="#c98a00" strokeWidth="1.4" />
      <path d="M16 20v-9M16 13q-3-.4-3.4-3M16 13q3-.4 3.4-3M16 16.5q-3-.4-3.4-3M16 16.5q3-.4 3.4-3" fill="none" stroke="#a86a00" strokeWidth="1.6" strokeLinecap="round" />
    </>),
  /** Nhà — về nhà */
  nha: (
    <>
      <path d="M6 15l10-9 10 9v12H6z" fill="#fff1c9" {...S} /><path d="M3.5 16L16 4.8 28.5 16" fill="none" stroke="#d2553a" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13 27v-7h6v7" fill="#a86a2a" {...S} />
    </>),
  /** Mầm cây — vườn */
  mam: (
    <>
      <path d="M16 28V14" {...S} strokeWidth={2.6} />
      <path d="M16 16C9 16 6 12 6 7c6 0 10 3 10 9z" fill="#7ccf4f" {...S} /><path d="M16 13c0-5 3-8 9-8 0 5.6-3 8-9 8z" fill="#4caf3f" {...S} />
      <path d="M8 28h16" {...S} strokeWidth={3} stroke="#a86a2a" />
    </>),
  /** Xe tải chở trái cây */
  xetai: (
    <>
      <path d="M2 10h17v12H2z" fill="#d9a35b" {...S} /><path d="M19 13h6l4 5v4H19z" fill="#f08a6c" {...S} /><path d="M22 15h2.6l2.2 3H22z" fill="#bfe9ff" stroke={O} strokeWidth="1.2" />
      <circle cx="6.5" cy="8.6" r="3" fill="#ff8a3d" {...S} /><circle cx="11.5" cy="8" r="3.2" fill="#ffd23f" {...S} /><circle cx="16" cy="8.8" r="2.6" fill="#7ccf4f" {...S} />
      <circle cx="8" cy="23.5" r="3.4" fill="#3b2a17" {...S} /><circle cx="23" cy="23.5" r="3.4" fill="#3b2a17" {...S} /><circle cx="8" cy="23.5" r="1.2" fill="#d8d2c4" /><circle cx="23" cy="23.5" r="1.2" fill="#d8d2c4" />
    </>),
  /** Ngôi sao nhiệm vụ */
  sao: <path d="M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9L10 18.2l-6-5.9 8.3-1.2z" fill="#ffcf3a" {...S} />,
  /** Đồng hồ chờ */
  dongho: (
    <>
      <circle cx="16" cy="17" r="11" fill="#fff" {...S} /><path d="M16 10.5V17l4.4 2.8" fill="none" {...S} strokeWidth={2.4} /><path d="M12.5 3.5h7M16 3.5V6" {...S} strokeWidth={2.4} />
    </>),
  /** Vali — đang tham quan */
  vali: (
    <>
      <rect x="4" y="10" width="24" height="17" rx="3" fill="#4aa3d8" {...S} /><path d="M12 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" fill="none" {...S} />
      <path d="M4 17h24" stroke={O} strokeWidth="1.6" /><rect x="13.5" y="15" width="5" height="4" rx="1" fill="#ffcf3a" {...S} />
    </>),
  /** Bàn tay vẫy — đang thăm vườn bạn */
  vay: (
    <>
      <path d="M10 28c-4-3-5.6-7-4-11l2.4 2.6V9.4a2 2 0 0 1 4 0V8a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1.6a2 2 0 0 1 4 0V20c0 4-2.4 6.6-6 8z" fill="#ffd9a8" {...S} />
      <path d="M12.4 9.4V16M16.4 9V16M20.4 10.6V16" stroke={O} strokeWidth="1.4" strokeLinecap="round" />
    </>),
  /** Container xuất khẩu */
  xuatkhau: (
    <>
      <rect x="3" y="11" width="26" height="13" rx="1.6" fill="#e2573c" {...S} />
      <path d="M8 13.5v8M12 13.5v8M16 13.5v8M20 13.5v8M24 13.5v8" stroke="#a83a24" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 3v6M12.8 6.2L16 3l3.2 3.2" fill="none" {...S} strokeWidth={2.4} /><path d="M6 27.5h20" {...S} strokeWidth={2.6} />
    </>),
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 28, className }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className ? `ico ${className}` : 'ico'} viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">{ICONS[name]}</svg>;
}
