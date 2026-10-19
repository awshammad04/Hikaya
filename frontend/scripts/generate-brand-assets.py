"""Generate web assets from the official artwork: py scripts/generate-brand-assets.py.

Requires Pillow. Keep the supplied backgrounds and artwork; never stretch or crop.
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
SOURCE = ROOT / 'branding'


def fit(source: Image.Image, size: tuple[int, int], background=(255, 255, 255, 0)) -> Image.Image:
    artwork = ImageOps.contain(source.convert('RGBA'), size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', size, background)
    canvas.alpha_composite(artwork, ((size[0] - artwork.width) // 2, (size[1] - artwork.height) // 2))
    return canvas


for name, size in [('icon', (1254, 1254)), ('horizontal', (1672, 941)), ('vertical', (1122, 1402))]:
    with Image.open(SOURCE / f'logo-{name}.png') as artwork:
        fit(artwork, size).save(PUBLIC / f'logo-{name}.png', optimize=True)

with Image.open(SOURCE / 'logo-icon.png') as icon:
    for name, size in [('favicon-16x16.png', 16), ('favicon-32x32.png', 32),
                       ('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
        fit(icon, (size, size)).save(PUBLIC / name, optimize=True)
    fit(icon, (256, 256)).save(PUBLIC / 'favicon.ico', sizes=[(n, n) for n in [16, 32, 48, 64, 128, 256]])

with Image.open(SOURCE / 'logo-horizontal.png') as artwork:
    fit(artwork, (1200, 630), (255, 255, 255, 255)).convert('RGB').save(PUBLIC / 'social-card.png', optimize=True)
