// Sự kiện mở thẻ người chơi từ bất kỳ đâu (cảnh 3D, danh sách…) — ChatLayer lắng nghe. Tách riêng để cảnh 3D không phải nạp React/CSS.
export const PLAYER_CARD_EVENT = 'vv:player-card';
export function openPlayerCard(userId: number) { window.dispatchEvent(new CustomEvent(PLAYER_CARD_EVENT, { detail: userId })); }
