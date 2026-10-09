# Hikaya · حكاية

The three PNG files here are the supplied official originals. Do not redraw the
mark, change its colors, stretch it or crop its artwork. The originals have white
backgrounds; these are retained. Padding added during conversion is transparent.

In the interface, multiply blending makes the white canvas match the surrounding
surface, including the original warm cream (`#f5f5f0`) in the header. The keepsake
icon uses the same warm cream backing. This preserves the supplied artwork rather
than replacing it with a generated cutout. The PNG originals remain opaque.

Generated assets are in `../public/`:

| Asset | Dimensions |
|---|---|
| `logo-icon.png` | 1254 × 1254 |
| `logo-horizontal.png` | 1672 × 941 |
| `logo-vertical.png` | 1122 × 1402 |
| `favicon.ico` | 16, 32, 48, 64, 128 and 256 pixel frames |
| `favicon-16x16.png`, `favicon-32x32.png` | 16 × 16, 32 × 32 |
| `apple-touch-icon.png` | 180 × 180 |
| `icon-192.png`, `icon-512.png` | 192 × 192, 512 × 512 |
| `social-card.png` | 1200 × 630 |

To regenerate, install Pillow and run `py scripts/generate-brand-assets.py` from
`frontend/` (or use `python3` on other platforms). Logos fit their existing canvas
dimensions proportionally. The full-size PNGs already provide enough resolution
for the current UI at 2× and 3× device densities.

No original vector artwork or native mobile launcher configuration is present.
PNG artwork is used directly rather than presenting a raster image as an SVG.
