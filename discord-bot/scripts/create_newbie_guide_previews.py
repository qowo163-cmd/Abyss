from __future__ import annotations

from pathlib import Path

from PIL import Image


SOURCE_DIR = Path("/home/ubuntu/webdev-static-assets/newbie-guide-v3-continuous")
OUTPUT_DIR = Path("/home/ubuntu/webdev-static-assets/newbie-guide-v3-preview")
MAX_WIDTH = 1280


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for source in sorted(SOURCE_DIR.glob("*-continuous.webp")):
        image = Image.open(source).convert("RGB")
        if image.width <= MAX_WIDTH:
            preview = image
        else:
            height = round(image.height * MAX_WIDTH / image.width)
            preview = image.resize((MAX_WIDTH, height), Image.Resampling.LANCZOS)
        output = OUTPUT_DIR / source.name.replace("-continuous.webp", "-preview.webp")
        preview.save(output, "WEBP", quality=82, method=6)
        print(f"{source.name}: {image.width}x{image.height} → {preview.width}x{preview.height}")


if __name__ == "__main__":
    main()
