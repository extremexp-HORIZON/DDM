# utils/rewards_badge.py
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os

try:
    from PIL import Image as _PILImage
    LANCZOS = getattr(_PILImage, "Resampling", _PILImage).LANCZOS
except Exception:
    LANCZOS = Image.LANCZOS

def _find_logo_path(logo_path: Optional[Path]) -> Optional[Path]:
    if logo_path and logo_path.exists():
        return logo_path
    env_dir = os.getenv("IPFS_ASSETS_DIR")
    candidate_names = ["logo-carre.png", "extremexp_logo_carre.png"]
    search_roots = []
    if env_dir:
        search_roots.append(Path(env_dir))
    search_roots.append(Path.cwd() / "ipfs_assets")
    for root in search_roots:
        for name in candidate_names:
            p = root / name
            if p.exists():
                return p
    return None

def _text_wh(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont):
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        return right - left, bottom - top
    except Exception:
        try:
            return draw.textsize(text, font=font)
        except Exception:
            return font.getmask(text).size

def render_validation_badge_png(
    *,
    title: str,
    subtitle: str,
    status_text: str,
    out_path: Path,
    size=(800, 420),
    logo_path: Optional[Path] = None,
) -> None:
    W, H = size
    img = Image.new("RGB", size, color=(16, 20, 24))
    draw = ImageDraw.Draw(img)

    # Fonts
    try:
        font_title = ImageFont.truetype("DejaVuSans-Bold.ttf", 46)
        font_sub   = ImageFont.truetype("DejaVuSans.ttf", 26)
        font_stat  = ImageFont.truetype("DejaVuSans-Bold.ttf", 30)
        font_small = ImageFont.truetype("DejaVuSans.ttf", 18)
    except Exception:
        font_title = font_sub = font_stat = font_small = ImageFont.load_default()

    # Accent stripe (different from suite badge to visually distinguish)
    draw.rectangle([(0, 0), (W, 12)], fill=(255, 184, 72))

    # Logo block
    logo_bottom = 24
    logo_file = _find_logo_path(logo_path)
    if logo_file:
        try:
            logo = Image.open(logo_file).convert("RGBA")
            max_h = 88
            scale = max_h / max(1, logo.height)
            new_size = (max(1, int(logo.width * scale)), max(1, int(logo.height * scale)))
            logo = logo.resize(new_size, LANCZOS)

            pad = 6
            bg = Image.new("RGBA", (logo.width + pad*2, logo.height + pad*2), (0,0,0,0))
            shadow = Image.new("RGBA", bg.size, (0,0,0,64))
            bg.paste(shadow, (0, 3), shadow)
            halo = ImageOps.expand(logo, border=2, fill=(255,255,255,220))
            bg.paste(halo, (pad-2, pad-2), halo)

            x = (W - bg.width) // 2
            y = 22
            img.paste(bg, (x, y), bg)
            logo_bottom = y + bg.height
        except Exception:
            pass

    # Title
    t = title or "Dataset Validation"
    tw, th = _text_wh(draw, t, font_title)
    ty = max(logo_bottom + 16, int(H * 0.30 - th / 2))
    draw.text(((W - tw) / 2, ty), t, fill=(240, 244, 248), font=font_title)

    # Subtitle
    s = subtitle or ""
    sw, sh = _text_wh(draw, s, font_sub)
    draw.text(((W - sw) / 2, ty + th + 10), s, fill=(160, 170, 180), font=font_sub)

    # Status line
    st = status_text or ""
    if st:
        stw, sth = _text_wh(draw, st, font_stat)
        draw.text(((W - stw) / 2, ty + th + sh + 26), st, fill=(255, 230, 190), font=font_stat)

    # Footer
    footer = "Extreme Xp - Decentralized Data Management"
    fw, fh = _text_wh(draw, footer, font_small)
    draw.text(((W - fw) / 2, H - fh - 24), footer, fill=(120, 130, 140), font=font_small)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")
