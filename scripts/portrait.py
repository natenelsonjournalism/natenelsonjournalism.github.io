"""Draws the ASCII portrait in `whoami` from the headshot. Run by hand after changing the
headshot (needs Python 3 and Pillow):

    python3 scripts/portrait.py

It overwrites src/data/portrait-light.txt and portrait-dark.txt.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'src' / 'data'
photo = Image.open(ROOT / 'public' / 'images' / 'nate-nelson.jpg').convert('L')

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
print(f'ASCII {COLS}x{ROWS}')
