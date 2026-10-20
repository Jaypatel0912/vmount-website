"""Remove white studio backgrounds from bike photos, including white trapped
between spokes, around hubs and inside the frame, while keeping white frame
lettering. Saves trimmed, transparent WebP files.

Usage:
  python scripts/remove-bg.py "Cycle Image" public/images/bikes
  python scripts/remove-bg.py "Cycle Image" public/images/bikes debug-out only=WA0013
Needs: pip install pillow numpy scipy
"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
dbg = sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith("only=") else None
only = next((a[5:].split(",") for a in sys.argv[3:] if a.startswith("only=")), None)
SKIP = {"IMG-20230714-WA0014", "IMG-20230714-WA0015"}  # poster and logo
os.makedirs(out, exist_ok=True)
if dbg: os.makedirs(dbg, exist_ok=True)

HUBS = []
def process(path):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    mn, mx = rgb.min(2), rgb.max(2)
    white = (mn > 212) & (mx - mn < 32)
    # Outside background: grow from the image border through white, but cut hair-thin
    # white links first so frame letters touching a shine line aren't swallowed.
    opened = ndimage.binary_opening(white, iterations=2)
    olab, _ = ndimage.label(opened)
    oborder = set(np.unique(np.concatenate([olab[0], olab[-1], olab[:, 0], olab[:, -1]]))) - {0}
    outside = ndimage.binary_dilation(np.isin(olab, list(oborder)), iterations=3) & white
    lab, n = ndimage.label(white & ~outside)
    lab[outside] = n + 1
    border = {n + 1}
    dt = ndimage.distance_transform_edt(white)
    slices = ndimage.find_objects(lab)
    h, w = lab.shape

    bg_ids, keep_ids = set(border), []
    reason = {}
    scale = w / 1024.0            # letter strokes are thicker on larger photos
    stroke = 4.5 * scale
    # Pass 1: definite background = touches the border, or wider than a letter stroke
    for k, sl in enumerate(slices, start=1):
        if sl is None or k in border:
            continue
        comp = lab[sl] == k
        thick = dt[sl][comp].max()
        longest = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start)
        if thick >= stroke or (longest > 160 * scale and thick >= 2.5):
            bg_ids.add(k); reason[k] = "thick"
    definite = np.isin(lab, list(bg_ids))
    ring_bg = {}
    # Pass 2: a thin region ringed by definite background is a gap between spokes;
    # neighbouring letters don't count, so a word's letters don't remove each other.
    for k, sl in enumerate(slices, start=1):
        if sl is None or k in bg_ids:
            continue
        y0, y1 = max(sl[0].start - 9, 0), min(sl[0].stop + 9, h)
        x0, x1 = max(sl[1].start - 9, 0), min(sl[1].stop + 9, w)
        c = lab[y0:y1, x0:x1] == k
        ring = ndimage.binary_dilation(c, iterations=8) & ~ndimage.binary_dilation(c, iterations=2)
        ring_bg[k] = definite[y0:y1, x0:x1][ring].mean() if ring.any() else 0.0
        if ring_bg[k] > 0.40:
            bg_ids.add(k); reason[k] = "ring"; continue
        keep_ids.append(k)

    def find_hubs(ids_pool, grow, min_cells, ring_check=False):
        cells = np.isin(lab, ids_pool)
        clusters, nc = ndimage.label(ndimage.binary_dilation(cells, iterations=grow))
        found = []
        for c in range(1, nc + 1):
            ids = np.unique(lab[cells & (clusters == c)]); ids = ids[ids > 0]
            if len(ids) < min_cells:
                continue
            cen = np.array([((slices[k-1][0].start + slices[k-1][0].stop) / 2, (slices[k-1][1].start + slices[k-1][1].stop) / 2) for k in ids])
            hub = np.median(cen, axis=0)
            dist = np.hypot(*(cen - hub).T)
            if ring_check:
                # Real mag wheel: openings evenly around the hub at a similar distance
                ang = np.sort(np.degrees(np.arctan2(*(cen - hub).T)) % 360)
                biggest_gap = np.max(np.diff(np.concatenate([ang, ang[:1] + 360])))
                if dist.std() / max(dist.mean(), 1) > 0.3 or biggest_gap > 120:
                    continue
            radius = np.percentile(dist, 90)
            found.append((len(ids), hub, radius))
        found.sort(key=lambda f: -f[0])
        return [(hub, r) for _, hub, r in found]
    area = {k: int((lab[slices[k-1]] == k).sum()) for k in bg_ids - border}
    s2 = scale * scale
    spoke_cells = [k for k, a in area.items() if 150 * s2 <= a < 8000 * s2]   # gaps between spokes (chain-link holes are smaller)
    mag_cells = [k for k, a in area.items() if 8000 * s2 <= a < 60000 * s2]  # openings in mag wheels
    hubs = (find_hubs(spoke_cells, int(12 * scale), 10) + find_hubs(mag_cells, int(22 * scale), 4, ring_check=True))[:2]  # a bike has two wheels
    HUBS.append([(int(hx), int(hy), int(r)) for (hy, hx), r in hubs])
    # Studio-white level of this photo; enclosed white just as pure is background seen
    # through a small gap (under the saddle, chainring/brake-disc holes). Lettering is duller.
    bg_level = float(np.median(mn[np.isin(lab, list(border))])) if border else 255.0
    pure_level = min(250.0, bg_level - 5)
    still = []
    for k in keep_ids:
        comp = lab[slices[k-1]] == k
        vals = mn[slices[k-1]][comp]
        if (vals >= pure_level).mean() >= 0.5 and vals.mean() >= pure_level - 7:
            bg_ids.add(k); reason[k] = "pure"
            continue
        sl = slices[k-1]
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        d = min((np.hypot(cy - hy, cx - hx) / r for (hy, hx), r in hubs), default=9)
        if d < 0.47 or (d < 0.85 and ring_bg.get(k, 0) > 0.15):
            bg_ids.add(k); reason[k] = "wheel"
        else:
            still.append(k)
    bg = np.isin(lab, list(bg_ids))
    # Light-grey shadow/antialias halo touching the background
    halo = (mn > 185) & (mx - mn < 30) & ndimage.binary_dilation(bg, iterations=2) & ~np.isin(lab, still)
    bg |= halo

    # Floor shadow under the tyres: light grey pixels in the bottom band touching background
    rows_with_bike = np.nonzero((~bg).any(1))[0]
    if len(rows_with_bike):
        y_bot, y_top = rows_with_bike.max(), rows_with_bike.min()
        band_top = int(y_bot - 0.07 * (y_bot - y_top))
        light = (mn > 105) & (mx - mn < 28)
        light[:band_top] = False
        sl_lab, _ = ndimage.label(light | bg)
        bg |= np.isin(sl_lab, np.unique(sl_lab[bg])) & light

    alpha = np.where(bg, 0.0, 1.0)
    # Edge clean-up: pixels next to background get alpha from how dark they are,
    # and their colour is un-mixed from white, removing the white outline.
    band = ndimage.binary_dilation(bg, iterations=2) & ~bg & ~np.isin(lab, still)
    a = np.clip((245.0 - mn) / 140.0, 0.0, 1.0)
    alpha[band] = a[band]
    out_rgb = rgb.copy()
    safe = np.maximum(alpha, 1e-3)[..., None]
    un = (rgb - (1 - alpha[..., None]) * 255.0) / safe
    out_rgb[band] = np.clip(un[band], 0, 255)

    rgba = np.dstack([out_rgb, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    box = Image.fromarray((alpha > 0.05).astype(np.uint8) * 255).getbbox()
    im = im.crop(box)
    kept = np.isin(lab, still)
    return im, box, kept, rgb, lab, reason

files = sorted(glob.glob(os.path.join(src, "*.jpg")))
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    if name in SKIP or (only and name[-6:] not in only and name not in only):
        continue
    im, box, kept, rgb, lab, reason = process(f)
    im.thumbnail((1000, 1000), Image.LANCZOS)
    p = os.path.join(out, name.replace("IMG-", "bike-") + ".webp")
    im.save(p, "WEBP", quality=90, method=6)
    if dbg:
        o = rgb.astype(np.uint8).copy(); o[kept] = (255, 0, 255)
        colors = {"thick": (0, 200, 255), "ring": (255, 220, 0), "wheel": (0, 220, 90), "pure": (255, 120, 0)}
        for k, r in reason.items():
            o[lab == k] = colors[r]
        Image.fromarray(o).crop(box).save(os.path.join(dbg, name[-6:] + "_kept.png"))
    print(os.path.basename(p), im.size)
