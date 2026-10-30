"""Draws the site's portrait art from the headshot: the halftone-dot icons and the ASCII
portrait in `whoami`. Run by hand after changing the headshot (needs Python 3 and Pillow):

    python3 scripts/portrait.py

It overwrites public/favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192.png,
icon-512.png and src/data/portrait-{light,dark}.txt. Afterwards bump the `?v=` number on the
icon links in src/layouts/BaseLayout.astro. The PNGs are written fresh, with no metadata.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC, DATA = ROOT / 'public', ROOT / 'src' / 'data'
photo = Image.open(PUBLIC / 'images' / 'nate-nelson.jpg').convert('L')

CREAM, INK = (248, 247, 243), (27, 28, 30)  # --bg (light theme) and a near-black ink

# Outline of head and shoulders in the 448px photo, drawn by hand: everything outside it
# (the brick wall) is left blank. Redraw it if the headshot changes.
OUTLINE = [
    (150, 60), (175, 32), (215, 24), (255, 28), (290, 45), (310, 75), (318, 110), (320, 160),
    (318, 215), (305, 245), (296, 290), (300, 305), (340, 330), (390, 350), (448, 370),
    (448, 448), (0, 448), (0, 385), (40, 370), (100, 345), (160, 320), (168, 300), (160, 260),
    (145, 235), (135, 210), (130, 170), (128, 120), (135, 85),
]


def tones(box, cols, rows):
    """The photo inside `box`, sharpened, levelled over the figure only and sampled to a
    cols x rows grid. Returns (darkness, inside) grids, both 0..1."""
    mask = Image.new('L', photo.size, 0)
    ImageDraw.Draw(mask).polygon(OUTLINE, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    im = photo.filter(ImageFilter.UnsharpMask(radius=4, percent=150, threshold=2))
    im = ImageOps.equalize(im, mask=mask)
    im = im.crop(box).resize((cols, rows), Image.LANCZOS)
    mask = mask.crop(box).resize((cols, rows), Image.LANCZOS)
    dark = [[1 - im.getpixel((x, y)) / 255 for x in range(cols)] for y in range(rows)]
    inside = [[mask.getpixel((x, y)) / 255 for x in range(cols)] for y in range(rows)]
    return dark, inside


# ---- Icons: halftone dots, ink on cream, cropped to the face ----

N = 26  # dots across
dark, inside = tones((90, 15, 360, 285), N, N)
DOTS = [
    (x + 0.5, y + 0.5, r)
    for y in range(N)
    for x in range(N)
    if (r := 0.56 * dark[y][x] ** 0.9 * inside[y][x]) > 0.08
]


def svg():
    circles = ''.join(f'<circle cx="{x:g}" cy="{y:g}" r="{r:.2f}"/>' for x, y, r in DOTS)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}">'
        f'<rect width="{N}" height="{N}" rx="{N * 0.18:.2f}" fill="#f8f7f3"/>'
        f'<g fill="#1b1c1e">{circles}</g></svg>\n'
    )


def png(size, rounded):
    k = 8  # drawn 8x larger, then scaled down, for smooth dots
    big, cell = size * k, size * k / N
    im = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.18, fill=CREAM)
    else:
        d.rectangle([0, 0, big, big], fill=CREAM)
    for x, y, r in DOTS:
        d.ellipse([(x - r) * cell, (y - r) * cell, (x + r) * cell, (y + r) * cell], fill=INK)
    im = im.resize((size, size), Image.LANCZOS)
    # Two colours plus their blends: a 32-colour palette keeps it smooth at a fraction of the size.
    return im.quantize(colors=32, method=Image.Quantize.FASTOCTREE)


(PUBLIC / 'favicon.svg').write_text(svg())
png(32, True).save(PUBLIC / 'favicon-32.png')
png(180, False).save(PUBLIC / 'apple-touch-icon.png')  # iOS rounds it itself
png(192, True).save(PUBLIC / 'icon-192.png')
png(512, True).save(PUBLIC / 'icon-512.png')

# ---- ASCII portrait for whoami: head and shoulders, one version per colour scheme ----

# A character is 0.6em wide and the <pre> uses line-height 1, so each cell is 0.6 x 1.
BOX, COLS = (24, 12, 424, 448), 64
ROWS = round(COLS * (BOX[3] - BOX[1]) / (BOX[2] - BOX[0]) * 0.6)
dark, inside = tones(BOX, COLS, ROWS)
RAMP = ' .:-=+*#%@'  # sparse to dense; no digits, so the verifier's phone check stays quiet


def ascii_art(dense_is_dark):
    lines = []
    for y in range(ROWS):
        row = ''
        for x in range(COLS):
            t = dark[y][x] if dense_is_dark else 1 - dark[y][x]
            # Light theme: lift the mid-tones so the face's features show against the hair.
            # Dark theme: a gentle S-curve keeps the lit face crisp.
            t = t**0.75 if dense_is_dark else t * t * (3 - 2 * t)
            t *= inside[y][x]
            row += RAMP[min(len(RAMP) - 1, int(t * len(RAMP)))]
        lines.append(row.rstrip())
    return '\n'.join(lines) + '\n'


(DATA / 'portrait-light.txt').write_text(ascii_art(True))  # dark text on cream
(DATA / 'portrait-dark.txt').write_text(ascii_art(False))  # light text on near-black
print(f'{len(DOTS)} dots; ASCII {COLS}x{ROWS}')
