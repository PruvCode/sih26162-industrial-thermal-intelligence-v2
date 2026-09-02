"""Downscale the Earthpack equirectangular textures from 8K to 4K.

The 8K set is ~19 MB of network and ~400 MB of VRAM once decoded. At the camera
distances this scene actually uses (the globe is at most ~1.5 units against a
~45 degree FOV) the extra resolution is never resolved, but it is enough to
hard-fail on integrated GPUs — the most likely demo hardware.

Writes 4k_*.jpg next to the originals. The 8k originals are left in place so the
change is easy to revert.
"""

import pathlib
import sys

from PIL import Image

# The Next.js app lives in the nested checkout, not in the outer workspace apps/.
PUBLIC = (
    pathlib.Path(__file__).parent.parent
    / "sih26162-industrial-thermal-intelligence"
    / "apps"
    / "web"
    / "public"
)
TARGET_WIDTH = 4096

MAPS = [
    ("8k_earth_daymap.jpg", "4k_earth_daymap.jpg"),
    ("8k_earth_nightmap.jpg", "4k_earth_nightmap.jpg"),
    ("8k_earth_clouds.jpg", "4k_earth_clouds.jpg"),
]


def human(n: float) -> str:
    return f"{n / 1_048_576:.1f} MB"


def main() -> int:
    total_before = 0
    total_after = 0

    for src_name, dst_name in MAPS:
        src = PUBLIC / src_name
        dst = PUBLIC / dst_name
        if not src.exists():
            print(f"MISSING {src}")
            return 1

        with Image.open(src) as im:
            im = im.convert("RGB")
            w, h = im.size
            if w <= TARGET_WIDTH:
                print(f"SKIP  {src_name} already {w}x{h}")
                continue
            new_h = round(h * TARGET_WIDTH / w)
            # Keep the height even so the equirectangular seam stays aligned.
            new_h -= new_h % 2
            resized = im.resize((TARGET_WIDTH, new_h), Image.LANCZOS)

        resized.save(dst, "JPEG", quality=88, optimize=True, progressive=True)

        before = src.stat().st_size
        after = dst.stat().st_size
        total_before += before
        total_after += after
        print(
            f"{src_name} {w}x{h} {human(before)}  ->  "
            f"{dst_name} {resized.size[0]}x{resized.size[1]} {human(after)}"
        )

    if total_before:
        saved = 100 * (1 - total_after / total_before)
        print(f"\ntotal {human(total_before)} -> {human(total_after)} ({saved:.0f}% smaller)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
