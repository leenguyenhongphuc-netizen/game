"""Ghép ảnh ride-views.mjs của một trò thành bảng: hàng trên là trọn lượt (giữa mỗi giai đoạn), hàng dưới là bốn góc nhìn.
   python3 tools/ui-test/ride-sheet.py <thư mục ảnh> <ảnh ra> <ride>"""
import json
import os
import sys
from PIL import Image, ImageDraw

src, out, ride = sys.argv[1], sys.argv[2], sys.argv[3]
info = json.load(open(f'{src}/ket-qua.json'))[ride]
phases = [f'pha{i}' for i in range(len(info['phases']))]
views = ['trong', 'theo', 'toan', 'dien_anh']
W, H = 196, 425
cols = max(len(phases), len(views))
sheet = Image.new('RGB', (W * cols, H * 2 + 24), 'white')
d = ImageDraw.Draw(sheet)
d.text((6, 6), f"{ride} - {info['total']} giay", fill='black')
for row, names in enumerate([phases, views]):
    for c, n in enumerate(names):
        f = f'{src}/{ride}-{n}.png'
        if not os.path.exists(f):
            continue
        sheet.paste(Image.open(f).convert('RGB').resize((W, H)), (c * W, 24 + row * H))
        cap = info['phases'][c] if row == 0 else n
        d.rectangle([c * W, 24 + row * H, c * W + W, 24 + row * H + 14], fill='black')
        d.text((c * W + 3, 24 + row * H + 2), cap[:34], fill='white')
sheet.save(out)
