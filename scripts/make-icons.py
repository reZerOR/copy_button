from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'extension' / 'icons'
root.mkdir(parents=True, exist_ok=True)
for size in (16, 48, 128):
    scale = 4
    image = Image.new('RGBA', (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    unit = size * scale / 32
    box = lambda x: tuple(round(v * unit) for v in x)
    draw.rounded_rectangle(box((0, 0, 32, 32)), radius=round(7 * unit), fill='#004225')
    draw.rounded_rectangle(box((11, 7, 26, 19)), radius=round(3 * unit), outline='#94cba8', width=max(1, round(1.5 * unit)))
    draw.rounded_rectangle(box((6, 12, 21, 24)), radius=round(3 * unit), fill='#004225', outline='#f0f7f2', width=max(1, round(1.5 * unit)))
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'{size}.png')
print('Generated extension icons at 16, 48, and 128 px.')
