from __future__ import annotations

import json
import re
from pathlib import Path

from openpyxl import load_workbook


SOURCE = Path("/home/ubuntu/upload/게임_가이드_네비게이션(3).xlsx")
OUTPUT = Path("/home/ubuntu/analysis_newbie_guide_v3")
IMAGES = OUTPUT / "images"
WEB_ASSETS = Path("/home/ubuntu/webdev-static-assets/newbie-guide-v3")


def safe_name(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", value).strip("_") or "sheet"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    WEB_ASSETS.mkdir(parents=True, exist_ok=True)
    workbook = load_workbook(SOURCE, data_only=False)
    result: dict[str, object] = {"source": str(SOURCE), "sheets": []}

    for sheet_index, worksheet in enumerate(workbook.worksheets, start=1):
        values: list[dict[str, object]] = []
        hyperlinks: list[dict[str, str]] = []
        for row in worksheet.iter_rows():
            for cell in row:
                if cell.value is not None and str(cell.value).strip():
                    values.append({"cell": cell.coordinate, "value": str(cell.value)})
                if cell.hyperlink:
                    hyperlinks.append({"cell": cell.coordinate, "target": str(cell.hyperlink.target or ""), "location": str(cell.hyperlink.location or "")})

        image_files: list[str] = []
        for image_index, image in enumerate(getattr(worksheet, "_images", []), start=1):
            extension = "png"
            mime = getattr(image, "format", None)
            if isinstance(mime, str) and mime.lower() in {"png", "jpg", "jpeg", "gif", "bmp"}:
                extension = "jpg" if mime.lower() == "jpeg" else mime.lower()
            image_path = IMAGES / f"{sheet_index:02d}_{safe_name(worksheet.title)}_{image_index:02d}.{extension}"
            image_bytes = image._data()
            image_path.write_bytes(image_bytes)
            web_asset_name = f"guide-{sheet_index:02d}-{image_index:02d}.{extension}"
            web_asset_path = WEB_ASSETS / web_asset_name
            web_asset_path.write_bytes(image_bytes)
            image_files.append({
                "extractedPath": str(image_path),
                "webAssetPath": str(web_asset_path),
                "webAssetName": web_asset_name,
            })

        result["sheets"].append({
            "index": sheet_index,
            "title": worksheet.title,
            "dimensions": worksheet.calculate_dimension(),
            "values": values,
            "hyperlinks": hyperlinks,
            "images": image_files,
        })

    report = OUTPUT / "workbook_summary.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(report)
    print(f"Extracted images: {len(list(IMAGES.iterdir()))}")
    for sheet in result["sheets"]:
        print(f"[{sheet['index']:02d}] {sheet['title']}: values={len(sheet['values'])}, links={len(sheet['hyperlinks'])}, images={len(sheet['images'])}")


if __name__ == "__main__":
    main()
