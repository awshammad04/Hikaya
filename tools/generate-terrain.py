"""Draw real relief under the governorate maps.

Each governorate map (except Jerusalem's illustrated one) is framed around its
places by fitBounds() in frontend/src/components/MvpLocationMap.tsx. This
script repeats that framing, samples NASA SRTM 30 m heights over it from the
Open Topo Data API and writes, per governorate:

  frontend/public/terrain/<id>.json   contour lines, elevation labels, sea
  frontend/public/terrain/<id>.png    hill shading for the same box

Run it again after adding or moving places in content/palestine/catalog.json.
Heights are cached in the system temp folder, so reruns are offline.
"""
import json
import math
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

import contourpy
import matplotlib.image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'content/palestine/catalog.json'
OUT = ROOT / 'frontend/public/terrain'
CACHE = Path(tempfile.gettempdir()) / 'hikaya-terrain-cache'
API = 'https://api.opentopodata.org/v1/srtm30m'
SOURCE = 'NASA SRTM 30 m (public domain), via the Open Topo Data API'

# Keep in step with MAP, SAFE and MIN_FRAME_KM in MvpLocationMap.tsx.
MAP = {'left': 65, 'top': 55, 'width': 870, 'height': 650}
SAFE = {'left': 190, 'right': 810, 'top': 235, 'bottom': 650}
MIN_FRAME_KM = 2
KM_PER_LAT = 110.57
COLUMNS = 64
SKIP = {'jerusalem'}  # Jerusalem keeps its hand-drawn Old City map.


def km_per_lng(lat):
    return 111.32 * math.cos(math.radians(lat))


def fit_bounds(points):
    lats = [lat for lat, _ in points]
    lngs = [lng for _, lng in points]
    mid_lat = (min(lats) + max(lats)) / 2
    mid_lng = (min(lngs) + max(lngs)) / 2
    width_km = max((max(lngs) - min(lngs)) * km_per_lng(mid_lat), MIN_FRAME_KM)
    height_km = max((max(lats) - min(lats)) * KM_PER_LAT, MIN_FRAME_KM)
    km_per_unit = max(width_km / (SAFE['right'] - SAFE['left']), height_km / (SAFE['bottom'] - SAFE['top']))
    lng_span = km_per_unit * MAP['width'] / km_per_lng(mid_lat)
    lat_span = km_per_unit * MAP['height'] / KM_PER_LAT
    min_lng = mid_lng - ((SAFE['left'] + SAFE['right']) / 2 - MAP['left']) / MAP['width'] * lng_span
    max_lat = mid_lat + ((SAFE['top'] + SAFE['bottom']) / 2 - MAP['top']) / MAP['height'] * lat_span
    return {'minLat': max_lat - lat_span, 'maxLat': max_lat, 'minLng': min_lng, 'maxLng': min_lng + lng_span}


def visible_box(bounds, pad=0.08):
    """The whole 1000 x 760 view around the bounds, plus a margin for panning."""
    lng_span = bounds['maxLng'] - bounds['minLng']
    lat_span = bounds['maxLat'] - bounds['minLat']
    west = bounds['minLng'] - MAP['left'] / MAP['width'] * lng_span
    east = bounds['minLng'] + (1000 - MAP['left']) / MAP['width'] * lng_span
    north = bounds['maxLat'] + MAP['top'] / MAP['height'] * lat_span
    south = bounds['maxLat'] - (760 - MAP['top']) / MAP['height'] * lat_span
    dx, dy = (east - west) * pad, (north - south) * pad
    return {'minLat': south - dy, 'maxLat': north + dy, 'minLng': west - dx, 'maxLng': east + dx}


def fetch_batch(batch):
    """Heights for up to 100 points; the public API allows one call a second."""
    key = '_'.join(f'{lat:.5f},{lng:.5f}' for lat, lng in (batch[0], batch[-1])) + f'_{len(batch)}'
    cached = CACHE / f'{key}.json'
    if cached.exists():
        return json.loads(cached.read_text())
    query = urllib.parse.urlencode({'locations': '|'.join(f'{lat:.5f},{lng:.5f}' for lat, lng in batch)})
    for attempt in range(5):
        time.sleep(1.1)
        try:
            with urllib.request.urlopen(f'{API}?{query}', timeout=60) as response:
                results = json.load(response)['results']
            break
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            time.sleep(10 * (attempt + 1))
    values = [item.get('elevation') for item in results]
    if len(values) != len(batch) or not all(value is None or isinstance(value, (int, float)) for value in values):
        raise SystemExit(f'Unexpected elevation response near {batch[0]}.')
    # SRTM has no height over open water; count a missing value as sea level.
    values = [float(value) if value is not None else 0.0 for value in values]
    CACHE.mkdir(exist_ok=True)
    cached.write_text(json.dumps(values))
    return values


def fetch_heights(lats, lngs):
    points = [(lat, lng) for lat in lats for lng in lngs]
    heights = []
    for start in range(0, len(points), 100):
        heights.extend(fetch_batch(points[start:start + 100]))
    return np.array(heights).reshape(len(lats), len(lngs))


def smooth(grid, passes=1):
    """A light 3 x 3 blur so 90 m cells do not draw as stairs."""
    kernel = np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]], dtype=float) / 16
    out = grid.astype(float)
    for _ in range(passes):
        padded = np.pad(out, 1, mode='edge')
        out = sum(kernel[i, j] * padded[i:i + out.shape[0], j:j + out.shape[1]] for i in range(3) for j in range(3))
    return out


def simplify(line, tolerance):
    """Ramer-Douglas-Peucker on (lng, lat) rows, with tolerance in degrees."""
    if len(line) < 3:
        return line
    start, end = line[0], line[-1]
    segment = end - start
    length = np.hypot(*segment)
    if length == 0:
        distances = np.hypot(*(line - start).T)
    else:
        offset = line - start
        distances = np.abs(segment[0] * offset[:, 1] - segment[1] * offset[:, 0]) / length
    index = int(np.argmax(distances))
    if distances[index] <= tolerance:
        return np.array([start, end])
    return np.vstack([simplify(line[:index + 1], tolerance)[:-1], simplify(line[index:], tolerance)])


def rounded(line):
    return [[round(float(lat), 5), round(float(lng), 5)] for lng, lat in line]


def interval_for(low, high):
    for step in (5, 10, 20, 25, 50, 100, 200):
        if (high - low) / step <= 14:
            return step
    return 250


def hill_shade(grid, cell_x_m, cell_y_m, water):
    """Shadows only, as brown with alpha, lit from the north-west."""
    dz_dy, dz_dx = np.gradient(grid, cell_y_m, cell_x_m)
    slope = np.arctan(np.hypot(dz_dx, dz_dy) * 1.6)
    aspect = np.arctan2(-dz_dx, dz_dy)
    azimuth, altitude = math.radians(315), math.radians(45)
    shade = np.sin(altitude) * np.cos(slope) + np.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    darkness = np.clip((math.sin(altitude) - shade) / math.sin(altitude), 0, 1) ** 0.8
    darkness[water] = 0
    image = np.zeros(grid.shape + (4,))
    image[..., 0], image[..., 1], image[..., 2] = 0.35, 0.29, 0.2
    image[..., 3] = darkness * 0.85
    return image[::-1]  # rows run south to north; the image runs top down


def build(governorate, places):
    bounds = fit_bounds(places)
    box = visible_box(bounds)
    lng_margin = (bounds['maxLng'] - bounds['minLng']) * 0.12
    lat_margin = (bounds['maxLat'] - bounds['minLat']) * 0.12
    inner = {'minLng': bounds['minLng'] + lng_margin, 'maxLng': bounds['maxLng'] - lng_margin,
             'minLat': bounds['minLat'] + lat_margin, 'maxLat': bounds['maxLat'] - lat_margin}
    # Place names are wide pills centred on their pin.
    clear_lng = (bounds['maxLng'] - bounds['minLng']) * 0.22
    clear_lat = (bounds['maxLat'] - bounds['minLat']) * 0.12
    mid_lat = (box['minLat'] + box['maxLat']) / 2
    width_km = (box['maxLng'] - box['minLng']) * km_per_lng(mid_lat)
    height_km = (box['maxLat'] - box['minLat']) * KM_PER_LAT
    rows = max(8, round(COLUMNS * height_km / width_km))
    lngs = np.linspace(box['minLng'], box['maxLng'], COLUMNS)
    lats = np.linspace(box['minLat'], box['maxLat'], rows)
    raw = fetch_heights(lats.tolist(), lngs.tolist())

    # SRTM sets the open sea to exactly 0 m; nothing inland here is exactly 0.
    water_mask = raw == 0
    heights = smooth(raw)
    land = heights[~water_mask] if (~water_mask).any() else heights
    step = interval_for(float(land.min()), float(land.max()))
    cell = (lngs[1] - lngs[0])
    generator = contourpy.contour_generator(lngs, lats, heights)
    lines, labels = [], []
    first = math.ceil(float(land.min()) / step) * step
    for level in np.arange(first, float(land.max()), step):
        level = int(round(level))
        if level == 0 and water_mask.any():
            continue
        index = level % (step * 5) == 0
        longest = None
        for line in generator.lines(level):
            if len(line) < 4:
                continue
            line = simplify(line, cell * 0.35)
            if len(line) < 3:
                continue
            lines.append({'m': level, 'i': int(index), 'p': rounded(line)})
            if index and (longest is None or len(line) > len(longest)):
                longest = line
        # Label the level where its line runs well inside the frame, not at an
        # edge, and away from the markers and their names.
        inside = [k for k, (lng, lat) in enumerate(longest if longest is not None else [])
                  if inner['minLng'] < lng < inner['maxLng'] and inner['minLat'] < lat < inner['maxLat']
                  and all(abs(lng - p_lng) > clear_lng or abs(lat - p_lat) > clear_lat for p_lat, p_lng in places)]
        if inside:
            lng, lat = longest[min(inside, key=lambda k: abs(k - len(longest) // 2))]
            labels.append({'m': level, 'p': [round(float(lat), 5), round(float(lng), 5)]})

    water = []
    if water_mask.mean() > 0.01:
        filled = contourpy.contour_generator(lngs, lats, smooth(water_mask.astype(float), 2), fill_type='OuterOffset')
        rings_list, offsets_list = filled.filled(0.5, 2.0)
        for rings, offsets in zip(rings_list, offsets_list):
            for start, end in zip(offsets[:-1], offsets[1:]):
                ring = simplify(rings[start:end], cell * 0.3)
                if len(ring) >= 4:
                    water.append(rounded(ring))

    cell_x_m = cell * km_per_lng(mid_lat) * 1000
    cell_y_m = (lats[1] - lats[0]) * KM_PER_LAT * 1000
    matplotlib.image.imsave(OUT / f"{governorate['id']}.png", hill_shade(heights, cell_x_m, cell_y_m, water_mask))
    data = {
        'source': SOURCE,
        'box': {key: round(value, 5) for key, value in box.items()},
        'interval': step,
        'lines': lines,
        'labels': labels,
        'water': water,
    }
    (OUT / f"{governorate['id']}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    return f"{governorate['id']}: {len(lines)} contours every {step} m, " \
           f"{land.min():.0f}-{land.max():.0f} m, {len(water)} water rings, {rows}x{COLUMNS} samples"


def main():
    catalog = json.loads(CATALOG.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for governorate in catalog['governorates']:
        if governorate['id'] in SKIP:
            continue
        places = [(item['latitude'], item['longitude']) for item in catalog['locations']
                  if item.get('governorateId') == governorate['id']
                  and item.get('latitude') is not None and item.get('longitude') is not None]
        if not places:
            print(f"{governorate['id']}: no places with coordinates, skipped")
            continue
        print(build(governorate, places))


if __name__ == '__main__':
    main()
