from __future__ import annotations

import json
from pathlib import Path


LOCAL_MANIFEST = Path("/home/ubuntu/analysis_newbie_guide_v3/newbie-guide-continuous-local-manifest.json")
URL_MAP = Path("/home/ubuntu/analysis_newbie_guide_v3/newbie-guide-continuous-url-map.txt")
PREVIEW_URL_MAP = Path("/home/ubuntu/analysis_newbie_guide_v3/newbie-guide-preview-url-map.txt")
OUTPUT = Path("/home/ubuntu/webdev-static-assets/newbie-guide-v3-continuous/newbie-guide-continuous-manifest.json")

EXTERNAL_LINKS = {
    "site": [
        {"label": "회원가입 바로가기", "href": "https://abyssmm.com/"},
    ],
}


def main() -> None:
    urls = {
        line.split("|", 1)[0]: line.split("|", 1)[1]
        for line in URL_MAP.read_text(encoding="utf-8").splitlines()
        if "|" in line
    }
    preview_urls = {
        line.split("|", 1)[0]: line.split("|", 1)[1]
        for line in PREVIEW_URL_MAP.read_text(encoding="utf-8").splitlines()
        if "|" in line
    }
    local = json.loads(LOCAL_MANIFEST.read_text(encoding="utf-8"))
    topics = []
    for topic in local["topics"]:
        image_url = urls.get(topic["file"])
        preview_filename = topic["file"].replace("-continuous.webp", "-preview.webp")
        preview_url = preview_urls.get(preview_filename)
        if not image_url:
            raise RuntimeError(f"Missing uploaded URL for {topic['file']}")
        if not preview_url:
            raise RuntimeError(f"Missing uploaded preview URL for {preview_filename}")
        topics.append({
            "id": topic["id"],
            "category": topic["category"],
            "title": topic["title"],
            "image": image_url,
            "preview": preview_url,
            "imageCount": topic["imageCount"],
            "width": topic["width"],
            "height": topic["height"],
            "links": EXTERNAL_LINKS.get(topic["id"], []),
        })
    OUTPUT.write_text(json.dumps({"categories": local["categories"], "topics": topics}, ensure_ascii=False), encoding="utf-8")
    print(OUTPUT)
    print(f"Topics: {len(topics)}")


if __name__ == "__main__":
    main()
