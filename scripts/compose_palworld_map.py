from __future__ import annotations

import argparse
import io
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image


TILE_SIZE = 256
ZOOM = 6
TILES_PER_AXIS = 2**ZOOM
URL = "https://palworld.gg/images/tiles/{z}/{x}/{y}.png"


def download_tile(x: int, y: int) -> tuple[int, bytes]:
    request = urllib.request.Request(
        URL.format(z=ZOOM, x=x, y=y),
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return x, response.read()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    size = TILE_SIZE * TILES_PER_AXIS
    mosaic = Image.new("RGB", (size, size))

    with ThreadPoolExecutor(max_workers=16) as pool:
        for y in range(TILES_PER_AXIS):
            tiles = pool.map(lambda x: download_tile(x, y), range(TILES_PER_AXIS))
            for x, content in tiles:
                with Image.open(io.BytesIO(content)) as tile:
                    if tile.size != (TILE_SIZE, TILE_SIZE):
                        raise ValueError(f"Unexpected tile size at {x}/{y}: {tile.size}")
                    mosaic.paste(tile.convert("RGB"), (x * TILE_SIZE, y * TILE_SIZE))
            print(f"row {y + 1}/{TILES_PER_AXIS}", flush=True)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    mosaic.save(args.output, format="PNG", compress_level=6)
    print(f"saved {args.output} ({size}x{size})", flush=True)


if __name__ == "__main__":
    main()
