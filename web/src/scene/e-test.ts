// Trang thử: chụp ảnh 3D mọi món mua sắm và xe để soát hình. /e-test.html?xem=ao|non|phu_kien|nha|do|xe|xe_tai&size=320&c=4
import { GOODS } from '../../../shared/shop.ts';
import { VEHICLE_KINDS } from '../../../shared/vehicles.ts';
import { renderThumbs, thumbOf } from './thumbs.ts';
import type { ThumbAsk, ThumbKind } from './thumbs.ts';

const q = new URLSearchParams(location.search), xem = q.get('xem') ?? 'ao', size = Number(q.get('size') ?? 320);
const asks: (ThumbAsk & { name: string })[] = xem === 'xe_tai' ? VEHICLE_KINDS.map((k) => ({ id: k, kind: 'xe_tai' as ThumbKind, name: k }))
  : GOODS.filter((g) => (xem === 'do' ? g.category === 'noi_that' || g.category === 'san_vuon' : g.category === xem)).map((g) => ({ id: g.id, kind: g.category as ThumbKind, name: g.name }));
renderThumbs(asks, size);
const grid = document.getElementById('g')!; grid.style.setProperty('--c', q.get('c') ?? '4');
for (const a of asks) { const f = document.createElement('figure'), im = document.createElement('img'), c = document.createElement('figcaption'); im.src = thumbOf(a) ?? ''; c.textContent = a.name; f.append(im, c); grid.append(f); }
document.title = 'XONG';
