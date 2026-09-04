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
  image: string;
  preview?: string;
  imageCount: number;
  links?: GuideLink[];
};

type GuideManifest = {
  categories: string[];
  topics: GuideTopic[];
};

const CATEGORY_STYLES = [
  "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  "border-violet-300/30 bg-violet-300/10 text-violet-100",
  "border-amber-300/30 bg-amber-300/10 text-amber-100",
  "border-rose-300/30 bg-rose-300/10 text-rose-100",
];

function categoryStyle(category: string, categories: string[]) {
  const index = Math.max(0, categories.indexOf(category));
  return CATEGORY_STYLES[index % CATEGORY_STYLES.length];
}

export default function NewbieGuide() {
  const [manifest, setManifest] = useState<GuideManifest | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(GUIDE_MANIFEST_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("guide manifest unavailable");
        return response.json() as Promise<GuideManifest>;
      })
      .then((data) => {
        if (!Array.isArray(data.topics) || !Array.isArray(data.categories)) throw new Error("invalid guide manifest");
        setManifest(data);
        setSelectedCategory((current) => data.categories.includes(current) ? current : data.categories[0] || "");
        setSelectedTopicId((current) => current && data.topics.some((topic) => topic.id === current) ? current : data.topics[0]?.id || null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
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
      {loadError && <div className="flex min-h-[48vh] flex-col items-center justify-center text-center"><CircleHelp className="h-9 w-9 text-amber-200" /><p className="mt-3 text-base font-bold text-amber-100">가이드 자료를 불러오지 못했습니다.</p></div>}

      {manifest && <section className="pt-5 sm:pt-6">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="가이드 분류">{categories.map((category) => <button key={category} type="button" onClick={() => selectCategory(category)} className={`min-h-9 shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-extrabold transition sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm md:min-h-14 md:px-5 md:py-3.5 md:text-base ${selectedCategory === category ? "border-cyan-100 bg-cyan-100 text-slate-950" : "border-white/15 bg-slate-900 text-slate-100 hover:border-cyan-200/60"}`}>{category}</button>)}</div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-6">
          <nav aria-label="뉴비가이드 주제" className="flex gap-2 overflow-x-auto pb-1 xl:max-h-[calc(100vh-12rem)] xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden xl:rounded-xl xl:border xl:border-white/10 xl:bg-slate-950/40 xl:p-2">
            {visibleTopics.map((topic) => <button key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)} className={`flex min-w-max items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-bold transition sm:text-base xl:min-w-0 ${selectedTopic?.id === topic.id ? "border-cyan-200/70 bg-cyan-300/15 text-white" : "border-white/10 bg-slate-900/70 text-slate-200 hover:border-cyan-200/40"}`}><span className="break-keep whitespace-nowrap">{topic.title}</span><ChevronRight className="h-4 w-4 shrink-0" /></button>)}
          </nav>

          {selectedTopic && <article aria-labelledby="selected-guide-title" className="min-w-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/25">
            <header className="flex items-center justify-between gap-3 border-b border-white/15 bg-slate-900 px-4 py-3 sm:px-5 sm:py-4"><div className="min-w-0"><span className={`inline-flex max-w-full whitespace-nowrap rounded-md border px-2 py-1 text-xs font-extrabold ${categoryStyle(selectedTopic.category, manifest.categories)}`}>{selectedTopic.category}</span><h2 id="selected-guide-title" className="mt-2 break-keep text-base font-black leading-6 text-white sm:text-2xl sm:leading-normal">{selectedTopic.title}</h2></div></header>
            {selectedTopic.links?.length ? <div className="flex flex-wrap gap-2 border-b border-white/15 bg-slate-950 px-4 py-3 sm:px-5">{selectedTopic.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-200/45 bg-cyan-200/10 px-3 py-2 text-sm font-extrabold text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-200/20">{link.label}<ExternalLink className="h-4 w-4" /></a>)}</div> : null}
            <div className="bg-[#07111c] p-1 sm:p-2"><picture>{selectedTopic.preview && <source media="(max-width: 1536px)" srcSet={selectedTopic.preview} />}<img src={selectedTopic.image} alt={`${selectedTopic.title} 엑셀 원본 가이드`} loading="eager" decoding="async" className="block h-auto w-full select-none" /></picture></div>
          </article>}
        </div>
      </section>}
    </div>
  </main>;
}
