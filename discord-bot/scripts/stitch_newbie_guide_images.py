from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageFilter


SOURCE_DIR = Path("/home/ubuntu/webdev-static-assets/newbie-guide-v3")
OUTPUT_DIR = Path("/home/ubuntu/webdev-static-assets/newbie-guide-v3-continuous")
MANIFEST_PATH = Path("/home/ubuntu/analysis_newbie_guide_v3/newbie-guide-continuous-local-manifest.json")

TOPICS = [
    ("site", "시작하기", "공식 사이트·회원가입", 3),
    ("level-zone", "성장·사냥", "레벨존 가이드", 4),
    ("hunting-spots", "성장·사냥", "사냥터 위치", 5),
    ("npc", "성장·사냥", "NPC 정리", 6),
    ("contents", "성장·사냥", "서버 이용가능 컨텐츠", 7),
    ("controls", "기본 조작", "조작방법", 8),
    ("skills", "기본 조작", "스킬", 9),
    ("mix", "믹스·장비", "믹스 가이드", 10),
    ("equipment-synergy", "믹스·장비", "장비·시너지", 11),
    ("tips", "믹스·장비", "플레이팁·재화 수급", 12),
    ("synergy-source", "믹스·장비", "시너지 얻는 곳", 13),
    ("blessed-synergy", "믹스·장비", "축시 얻는 방법", 14),
    ("auto-hunt", "자동사냥·축용", "자동사냥 가이드", 15),
    ("signup", "자동사냥·축용", "회원가입 방법", 16),
    ("blessed-dragon", "자동사냥·축용", "축용·축티 가이드", 17),
    ("enchant-1", "인첸트", "인첸트 1단계", 18),
    ("enchant-2", "인첸트", "인첸트 2단계", 19),
    ("enchant-3", "인첸트", "인첸트 3단계", 20),
    ("enchant-4", "인첸트", "인첸트 4단계", 21),
    ("enchant-5", "인첸트", "인첸트 5단계", 22),
    ("enchant-6", "인첸트", "인첸트 6단계", 23),
    ("enchant-7", "인첸트", "인첸트 7단계", 24),
    ("enchant-exchange", "인첸트", "인첸트 교환 가이드", 25),
]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_topics = []
    for topic_id, category, title, sheet_index in TOPICS:
        files = sorted(SOURCE_DIR.glob(f"guide-{sheet_index:02d}-*"))
        if not files:
            raise RuntimeError(f"Missing images for sheet {sheet_index}")
        source_images = [Image.open(path).convert("RGB") for path in files]
        base_height = sum(image.height for image in source_images)
        scale = min(2048 / max(image.width for image in source_images), 15000 / base_height)
        resized = [
            image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
            for image in source_images
        ]
        max_width = max(image.width for image in resized)
        total_height = sum(image.height for image in resized)
        canvas = Image.new("RGB", (max_width, total_height), (7, 17, 28))
        offset = 0
        for image in resized:
            x = (max_width - image.width) // 2
            canvas.paste(image, (x, offset))
            offset += image.height
        sharpened = canvas.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=3))
        filename = f"{topic_id}-continuous.webp"
        output = OUTPUT_DIR / filename
        sharpened.save(output, "WEBP", lossless=True, method=6)
        manifest_topics.append({
            "id": topic_id,
            "category": category,
            "title": title,
            "file": filename,
            "imageCount": len(files),
            "width": max_width,
            "height": total_height,
        })
        print(f"{title}: {max_width}x{total_height} ({len(files)} images) → {filename}")

    MANIFEST_PATH.write_text(
        json.dumps({"categories": list(dict.fromkeys(category for _, category, _, _ in TOPICS)), "topics": manifest_topics}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(MANIFEST_PATH)


if __name__ == "__main__":
    main()
