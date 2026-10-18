from __future__ import annotations

from pathlib import Path
import json


MAP_FILE = Path("/home/ubuntu/analysis_newbie_guide/newbie-guide-asset-map.txt")
OUTPUT = Path("/home/ubuntu/analysis_newbie_guide/newbieGuideWorkbookContent.ts")
WEB_MANIFEST = Path("/home/ubuntu/webdev-static-assets/newbie-guide/newbie-guide-manifest.json")

TOPICS = [
    ("site", "시작하기", "공식 사이트·회원가입", "회원가입 사이트와 믹스사이트 진입 안내입니다.", 3),
    ("level-zone", "성장·사냥", "레벨존 가이드", "레벨 구간에 맞는 사냥 지역을 이미지 순서대로 확인하세요.", 4),
    ("hunting-spots", "성장·사냥", "사냥터 위치", "사냥터와 주요 지역 위치를 확인하는 지도 안내입니다.", 5),
    ("npc", "성장·사냥", "NPC 정리", "대표 마을을 포함한 NPC 위치·기능 안내입니다.", 6),
    ("contents", "성장·사냥", "서버 이용가능 컨텐츠", "보스 콘텐츠와 공성전을 포함한 서버 콘텐츠 안내입니다.", 7),
    ("controls", "기본 조작", "조작방법", "기본 조작 화면을 단계별로 확인하세요.", 8),
    ("skills", "기본 조작", "스킬", "스킬 관련 기본 안내입니다.", 9),
    ("mix", "믹스·장비", "믹스 가이드", "믹스 진행 시 참고할 핵심 화면과 중요 안내입니다.", 10),
    ("equipment-synergy", "믹스·장비", "장비·시너지", "장비와 시너지의 기본 구조를 확인하세요.", 11),
    ("tips", "믹스·장비", "플레이팁·재화 수급", "플레이 팁과 재화 수급 관련 안내입니다.", 12),
    ("synergy-source", "믹스·장비", "시너지 얻는 곳", "시너지 획득 위치와 관련 안내입니다.", 13),
    ("blessed-synergy", "믹스·장비", "축시 얻는 방법", "축시 획득 방법을 순서대로 확인하세요.", 14),
    ("auto-hunt", "자동사냥·축용", "자동사냥 가이드", "자동사냥 사용 전 반드시 확인할 안내입니다.", 15),
    ("signup", "자동사냥·축용", "회원가입 방법", "회원가입 절차를 화면 순서대로 안내합니다.", 16),
    ("blessed-dragon", "자동사냥·축용", "축용·축티 가이드", "축용과 축티 사용 관련 안내입니다.", 17),
    ("enchant-1", "인첸트", "인첸트 1단계", "1단계 인첸트 재료와 관련 화면입니다.", 18),
    ("enchant-2", "인첸트", "인첸트 2단계", "2단계 인첸트 재료와 관련 화면입니다.", 19),
    ("enchant-3", "인첸트", "인첸트 3단계", "8개 속성 계열의 3단계 인첸트 아이템 안내입니다.", 20),
    ("enchant-4", "인첸트", "인첸트 4단계", "8개 속성 계열의 4단계 인첸트 아이템 안내입니다.", 21),
    ("enchant-5", "인첸트", "인첸트 5단계", "8개 속성 계열의 5단계 인첸트 아이템 안내입니다.", 22),
    ("enchant-6", "인첸트", "인첸트 6단계", "8개 속성 계열의 6단계 인첸트 아이템 안내입니다.", 23),
    ("enchant-7", "인첸트", "인첸트 7단계", "8개 속성 계열의 7단계 인첸트 아이템 안내입니다.", 24),
    ("enchant-exchange", "인첸트", "인첸트 교환 가이드", "인첸트 교환 관련 안내입니다.", 25),
]


def main() -> None:
    assets: dict[str, str] = {}
    for line in MAP_FILE.read_text(encoding="utf-8").splitlines():
        filename, url = line.split("|", 1)
        assets[filename] = url

    lines = [
        'export type NewbieGuideTopic = {',
        '  id: string;',
        '  category: string;',
        '  title: string;',
        '  description: string;',
        '  images: string[];',
        '};',
        '',
        'export const NEWBIE_GUIDE_TOPICS: NewbieGuideTopic[] = [',
    ]
    for topic_id, category, title, description, sheet_index in TOPICS:
        prefix = f"guide-{sheet_index:02d}-"
        image_urls = [url for filename, url in assets.items() if filename.startswith(prefix)]
        lines.extend([
            '  {',
            f'    id: "{topic_id}",',
            f'    category: "{category}",',
            f'    title: "{title}",',
            f'    description: "{description}",',
            '    images: [',
            *[f'      "{url}",' for url in image_urls],
            '    ],',
            '  },',
        ])
    lines.extend(['];', '', 'export const NEWBIE_GUIDE_CATEGORIES = [...new Set(NEWBIE_GUIDE_TOPICS.map((topic) => topic.category))];', ''])
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    manifest = {
        "source": "게임_가이드_네비게이션(2).xlsx",
        "categories": list(dict.fromkeys(category for _, category, _, _, _ in TOPICS)),
        "topics": [
            {
                "id": topic_id,
                "category": category,
                "title": title,
                "description": description,
                "images": [url for filename, url in assets.items() if filename.startswith(f"guide-{sheet_index:02d}-")],
            }
            for topic_id, category, title, description, sheet_index in TOPICS
        ],
    }
    WEB_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    print(OUTPUT)
    print(WEB_MANIFEST)
    print(f"Topics: {len(TOPICS)}")


if __name__ == "__main__":
    main()
