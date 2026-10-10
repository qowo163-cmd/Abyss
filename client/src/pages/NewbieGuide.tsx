import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, ChevronRight, CircleHelp, ExternalLink, Loader2 } from "lucide-react";

const GUIDE_MANIFEST_URL = "/manus-storage/newbie-guide-continuous-manifest_9ec565e5.json";

type GuideLink = {
  label: string;
  href: string;
};

type GuideTopic = {
  id: string;
  category: string;
  title: string;
  description?: string;
  image?: string;
  preview?: string;
  imageCount?: number;
  links?: GuideLink[];
  content?: string[];
};

type GuideManifest = {
  categories: string[];
  topics: GuideTopic[];
};

const CATEGORY_STYLES = [
  "border-cyan-300 bg-cyan-100 text-cyan-950",
  "border-emerald-300 bg-emerald-100 text-emerald-950",
  "border-violet-300 bg-violet-100 text-violet-950",
  "border-amber-300 bg-amber-100 text-amber-950",
  "border-rose-300 bg-rose-100 text-rose-950",
];

// The original workbook images live in external storage. If that manifest is
// temporarily unavailable, keep the guide useful and visible with local text.
const FALLBACK_MANIFEST: GuideManifest = {
  categories: ["시작하기", "성장·사냥", "기본 조작", "믹스·장비", "자동사냥·축용", "인첸트"],
  topics: [
    { id: "site", category: "시작하기", title: "공식 사이트·회원가입", description: "처음 방문했을 때 확인할 항목입니다.", content: ["회원가입과 로그인은 안내된 공식 사이트에서 진행하세요.", "계정 정보는 다른 사람과 공유하지 말고, 비밀번호는 다른 사이트와 다르게 설정하세요.", "사이트 기능 이용에 승인이 필요한 경우 로그인 후 안내 문구를 확인하세요."], links: [{ label: "공식 사이트 열기", href: "https://abyssmm.com/" }] },
    { id: "signup", category: "시작하기", title: "회원가입 방법", description: "가입부터 로그인까지 순서대로 확인하세요.", content: ["회원가입 화면에서 필수 항목을 빠짐없이 입력하세요.", "가입 후 승인이 필요한 계정은 승인 완료 후 다시 로그인하세요.", "로그인이 안 되면 아이디·비밀번호를 확인하고 반복 입력 전 잠시 기다리세요."] },
    { id: "level-zone", category: "성장·사냥", title: "레벨존 가이드", description: "현재 레벨에 맞는 사냥 구간을 선택하는 기본 원칙입니다.", content: ["현재 레벨과 사냥터의 권장 레벨을 먼저 비교하세요.", "명중·생존이 불안정하면 무리해서 높은 레벨 지역으로 이동하지 마세요.", "사냥 효율을 비교할 때는 경험치뿐 아니라 회복 아이템 소모량도 고려하세요."] },
    { id: "hunting-spots", category: "성장·사냥", title: "사냥터 위치", description: "사냥터로 이동하기 전에 확인할 항목입니다.", content: ["목적지 이름과 이동 경로를 확인한 뒤 이동하세요.", "처음 방문한 지역은 입구와 귀환 경로를 먼저 파악하세요.", "혼잡하거나 사냥 효율이 낮으면 비슷한 레벨의 대체 사냥터를 확인하세요."] },
    { id: "npc", category: "성장·사냥", title: "NPC 정리", description: "마을 NPC의 기능을 확인할 때 참고하세요.", content: ["NPC를 이용하기 전에 대화창의 기능과 비용을 확인하세요.", "강화·교환·이동 등 되돌리기 어려운 기능은 실행 전 재료와 결과를 확인하세요.", "찾는 기능이 없다면 대표 마을의 다른 NPC도 확인하세요."] },
    { id: "contents", category: "성장·사냥", title: "서버 이용가능 컨텐츠", description: "서버 콘텐츠 이용 전 알아둘 점입니다.", content: ["콘텐츠 시작 조건과 참여 가능 시간을 먼저 확인하세요.", "보스나 공성전처럼 협력이 필요한 콘텐츠는 파티와 준비물을 미리 맞추세요.", "서버 공지에서 입장 조건이나 보상이 바뀌었는지 확인하세요."] },
    { id: "controls", category: "기본 조작", title: "조작방법", description: "기본 조작에 익숙해지기 위한 항목입니다.", content: ["메뉴와 단축키를 한 번씩 눌러 기능을 확인하세요.", "아이템을 사용하거나 버리기 전에는 선택된 대상과 수량을 확인하세요.", "처음에는 이동·공격·인벤토리처럼 자주 쓰는 조작부터 익히세요."] },
    { id: "skills", category: "기본 조작", title: "스킬", description: "스킬 사용 전 확인해야 하는 기본 사항입니다.", content: ["스킬 설명에서 소모 자원, 재사용 시간, 적용 대상을 확인하세요.", "대상 지정형 스킬은 사용 전에 올바른 대상이 선택되었는지 확인하세요.", "사냥터에 따라 단일 대상과 범위형 스킬을 나누어 사용하세요."] },
    { id: "mix", category: "믹스·장비", title: "믹스 가이드", description: "믹스 전 재료와 결과를 먼저 확인하세요.", content: ["목표 헨치의 믹스법과 각 재료의 레벨 조건을 확인하세요.", "주재료·부재료를 모두 준비했는지, 같은 이름의 다른 레벨 재료는 아닌지 확인하세요.", "실행 전 성공 조건과 필요한 재료 수량을 다시 확인하세요."] },
    { id: "equipment-synergy", category: "믹스·장비", title: "장비·시너지", description: "장비와 시너지를 맞출 때 확인할 항목입니다.", content: ["장착 조건과 적용 속성을 확인한 뒤 장비를 선택하세요.", "시너지 효과는 현재 장착 구성과 함께 확인하세요.", "장비를 교체할 때는 기존 장비의 효과와 거래 가능 여부를 확인하세요."] },
    { id: "tips", category: "믹스·장비", title: "플레이팁·재화 수급", description: "시간과 재화를 효율적으로 사용하기 위한 기본 팁입니다.", content: ["필요한 재료를 먼저 정리하고 목표가 분명한 사냥을 진행하세요.", "소모품 사용 전 가격과 효과를 비교하고, 불필요한 구매를 줄이세요.", "거래 전에는 아이템 이름·수량·금액을 한 번 더 확인하세요."] },
    { id: "synergy-source", category: "믹스·장비", title: "시너지 얻는 곳", description: "시너지 획득 경로를 확인할 때 참고하세요.", content: ["획득처별 요구 레벨과 입장 조건을 확인하세요.", "시너지 이름이 비슷한 경우 등급과 적용 조건을 구분하세요.", "획득 방법은 변경될 수 있으므로 최신 서버 공지를 함께 확인하세요."] },
    { id: "blessed-synergy", category: "믹스·장비", title: "축시 얻는 방법", description: "축시 관련 아이템이나 효과를 얻기 전 확인하세요.", content: ["필요한 재료와 교환 조건을 먼저 확인하세요.", "요구 수량과 보상 아이템 이름을 교환 직전에 다시 확인하세요.", "조건이 불확실하면 재료를 소모하기 전에 안내를 확인하세요."] },
    { id: "auto-hunt", category: "자동사냥·축용", title: "자동사냥 가이드", description: "자동사냥을 시작하기 전에 확인할 사항입니다.", content: ["자동사냥 시작 전 회복 아이템과 장비 내구도 등을 확인하세요.", "사냥터의 난이도와 캐릭터 생존력을 고려해 장소를 선택하세요.", "자동사냥을 오래 실행할 때는 소모품·인벤토리 상태를 주기적으로 확인하세요."] },
    { id: "blessed-dragon", category: "자동사냥·축용", title: "축용·축티 가이드", description: "축용·축티 사용 전 조건을 확인하세요.", content: ["아이템의 사용 조건과 적용 대상을 확인하세요.", "이름이 비슷한 아이템이 있으면 아이콘과 설명을 함께 확인하세요.", "소모형 아이템은 수량과 사용 결과를 확인한 뒤 사용하세요."] },
    { id: "enchant-1", category: "인첸트", title: "인첸트 1단계", description: "첫 단계 인첸트 안내입니다.", content: ["강화할 장비와 필요한 재료를 먼저 확인하세요.", "재료의 속성 계열과 단계가 맞는지 확인하세요.", "시도 전 실패 시 처리 방식과 비용을 확인하세요."] },
    { id: "enchant-2", category: "인첸트", title: "인첸트 2단계", description: "두 번째 단계 인첸트 안내입니다.", content: ["1단계와 2단계 재료를 혼동하지 않도록 단계 표기를 확인하세요.", "필요 재료 수량을 모두 준비했는지 확인하세요.", "강화 결과와 적용 장비가 맞는지 실행 전에 다시 확인하세요."] },
    { id: "enchant-3", category: "인첸트", title: "인첸트 3단계", description: "8개 속성 계열의 3단계 인첸트 관련 안내입니다.", content: ["드래곤·악마·짐승·새·곤충·식물·미스터리·메탈 계열을 구분하세요.", "재료 이름과 단계가 일치하는지 확인하세요.", "교환이나 강화 직전에 속성과 수량을 다시 확인하세요."] },
    { id: "enchant-4", category: "인첸트", title: "인첸트 4단계", description: "4단계 인첸트 관련 안내입니다.", content: ["4단계 재료인지, 3단계 또는 5단계 재료인지 이름을 확인하세요.", "속성 계열별 요구 조건을 구분하세요.", "실행 전에 필요한 재료와 비용을 다시 확인하세요."] },
    { id: "enchant-5", category: "인첸트", title: "인첸트 5단계", description: "5단계 인첸트 관련 안내입니다.", content: ["5단계 장비와 재료 조건을 확인하세요.", "같은 속성 계열의 재료를 준비했는지 확인하세요.", "강화 전 결과와 실패 조건을 확인하세요."] },
    { id: "enchant-6", category: "인첸트", title: "인첸트 6단계", description: "6단계 인첸트 관련 안내입니다.", content: ["6단계에 필요한 전용 재료와 속성 조건을 확인하세요.", "재료 수량과 비용을 미리 준비하세요.", "잘못된 재료를 소모하지 않도록 실행 직전에 한 번 더 확인하세요."] },
    { id: "enchant-7", category: "인첸트", title: "인첸트 7단계", description: "7단계 인첸트 관련 안내입니다.", content: ["최종 단계에 필요한 재료와 장비 조건을 모두 확인하세요.", "고가 재료를 사용하기 전 안내와 성공·실패 조건을 확인하세요.", "완료 후 장비 효과와 적용 상태를 확인하세요."] },
    { id: "enchant-exchange", category: "인첸트", title: "인첸트 교환 가이드", description: "인첸트 관련 교환을 진행할 때 참고하세요.", content: ["교환 전 아이템 이름·단계·속성을 정확히 비교하세요.", "교환할 재료와 받을 결과를 확인한 뒤 확정하세요.", "교환 완료 후 인벤토리에 결과가 정상적으로 들어왔는지 확인하세요."] },
  ],
};

function categoryStyle(category: string, categories: string[]) {
  const index = Math.max(0, categories.indexOf(category));
  return CATEGORY_STYLES[index % CATEGORY_STYLES.length];
}

export default function NewbieGuide() {
  const [manifest, setManifest] = useState<GuideManifest | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [failedImageTopicIds, setFailedImageTopicIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    void fetch(GUIDE_MANIFEST_URL, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("guide manifest unavailable");
        return response.json() as Promise<GuideManifest>;
      })
      .then((data) => {
        if (!Array.isArray(data.topics) || data.topics.length === 0 || !Array.isArray(data.categories)) throw new Error("invalid guide manifest");
        setManifest(data);
        setLoadError(false);
        setSelectedCategory((current) => data.categories.includes(current) ? current : data.categories[0] || "");
        setSelectedTopicId((current) => current && data.topics.some((topic) => topic.id === current) ? current : data.topics[0]?.id || null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setManifest(FALLBACK_MANIFEST);
        setLoadError(true);
        setSelectedCategory(FALLBACK_MANIFEST.categories[0]);
        setSelectedTopicId(FALLBACK_MANIFEST.topics[0]?.id || null);
      });
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => manifest?.categories || [], [manifest]);
  const visibleTopics = useMemo(() => manifest?.topics.filter((topic) => !selectedCategory || topic.category === selectedCategory) || [], [manifest, selectedCategory]);
  const selectedTopic = manifest?.topics.find((topic) => topic.id === selectedTopicId) || visibleTopics[0] || null;

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    const firstTopic = manifest?.topics.find((topic) => topic.category === category);
    if (firstTopic) setSelectedTopicId(firstTopic.id);
  };

  return <main className="min-h-screen bg-[#07111c] px-3 py-5 text-slate-100 sm:px-5 sm:py-7 md:px-8 md:py-9">
    <div className="mx-auto max-w-[1600px]">
      <header className="border-b border-cyan-100/20 pb-5 sm:pb-6">
        <div className="flex min-w-0 items-center gap-2 text-cyan-100"><BookOpenCheck className="h-5 w-5 shrink-0" /><h1 className="break-keep text-xl font-black tracking-tight sm:text-3xl">뉴비가이드</h1></div>
      </header>

      {!manifest && !loadError && <div className="flex min-h-[48vh] items-center justify-center gap-2 text-base font-semibold text-cyan-100"><Loader2 className="h-5 w-5 animate-spin" />가이드를 불러오는 중입니다.</div>}
      {loadError && manifest && <div role="status" className="mt-4 rounded-lg border border-amber-300/50 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950">이미지 원본에 연결할 수 없어 기본 텍스트 안내를 표시하고 있습니다.</div>}

      {manifest && <section className="pt-5 sm:pt-6">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="가이드 분류">{categories.map((category) => <button key={category} type="button" onClick={() => selectCategory(category)} className={`min-h-9 shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-extrabold transition sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm md:min-h-14 md:px-5 md:py-3.5 md:text-base ${selectedCategory === category ? "border-cyan-100 bg-cyan-100 text-slate-950" : "border-white/15 bg-slate-900 text-slate-100 hover:border-cyan-200/60"}`}>{category}</button>)}</div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-6">
          <nav aria-label="뉴비가이드 주제" className="flex gap-2 overflow-x-auto pb-1 xl:max-h-[calc(100vh-12rem)] xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden xl:rounded-xl xl:border xl:border-white/10 xl:bg-slate-950/40 xl:p-2">
            {visibleTopics.map((topic) => <button key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)} className={`flex min-w-max items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-bold transition sm:text-base xl:min-w-0 ${selectedTopic?.id === topic.id ? "border-cyan-200/70 bg-cyan-300/15 text-white" : "border-white/10 bg-slate-900/70 text-slate-200 hover:border-cyan-200/40"}`}><span className="break-keep whitespace-nowrap">{topic.title}</span><ChevronRight className="h-4 w-4 shrink-0" /></button>)}
          </nav>

          {selectedTopic && <article aria-labelledby="selected-guide-title" className="min-w-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/25">
            <header className="flex items-start justify-between gap-3 border-b border-slate-300 bg-white px-4 py-4 sm:px-5 sm:py-5"><div className="min-w-0"><span className={`inline-flex max-w-full whitespace-nowrap rounded-md border px-2 py-1 text-xs font-extrabold ${categoryStyle(selectedTopic.category, manifest.categories)}`}>{selectedTopic.category}</span><h2 id="selected-guide-title" className="mt-2 break-keep text-lg font-black leading-7 text-slate-950 sm:text-2xl sm:leading-8">{selectedTopic.title}</h2>{selectedTopic.description ? <p className="mt-2 break-keep text-sm font-semibold leading-6 text-slate-700 sm:text-base sm:leading-7">{selectedTopic.description}</p> : null}</div></header>
            {selectedTopic.links?.length ? <div className="flex flex-wrap gap-2 border-b border-white/15 bg-slate-950 px-4 py-3 sm:px-5">{selectedTopic.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-200/60 bg-cyan-100 px-3 py-2 text-sm font-extrabold text-cyan-950 transition hover:border-cyan-200 hover:bg-white">{link.label}<ExternalLink className="h-4 w-4" /></a>)}</div> : null}
            {selectedTopic.image && !failedImageTopicIds.has(selectedTopic.id) ? <div className="bg-slate-100 p-1 sm:p-2"><picture>{selectedTopic.preview && <source media="(max-width: 1536px)" srcSet={selectedTopic.preview} />}<img src={selectedTopic.image} alt={`${selectedTopic.title} 엑셀 원본 가이드`} loading="eager" decoding="async" className="block h-auto w-full select-none" onError={() => setFailedImageTopicIds((current) => new Set(current).add(selectedTopic.id))} /></picture></div> : <div className="bg-slate-950 p-4 sm:p-6"><div className="mb-4 flex items-center gap-2 text-cyan-200"><CircleHelp className="h-5 w-5" /><h3 className="text-base font-black sm:text-lg">핵심 안내</h3></div><ul className="space-y-3">{(selectedTopic.content || FALLBACK_MANIFEST.topics.find((topic) => topic.id === selectedTopic.id)?.content || ["세부 안내 자료를 불러올 수 없습니다. 필요한 조건을 확인하고 실행 전 내용을 다시 살펴보세요."]).map((line, index) => <li key={index} className="flex gap-3 rounded-lg border border-white/10 bg-slate-900 px-3 py-3 text-sm font-medium leading-6 text-slate-100 sm:text-base"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-black text-cyan-950">{index + 1}</span><span>{line}</span></li>)}</ul></div>}
          </article>}
        </div>
      </section>}
    </div>
  </main>;
}
