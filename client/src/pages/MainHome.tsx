import { useMemo } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight,
  BookOpenCheck,
  Calculator,
  ChevronRight,
  Compass,
  Download,
  GitBranch,
  Heart,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
  Timer,
  Users,
  Wand2,
} from 'lucide-react';
import updates from '@/data/updates.json';
import { attributeImages } from '@/data/attributeImages';
import { splitHabitats } from '@/lib/habitats';
import { useMonsterData } from '@/hooks/useMonsterData';
import type { AttributeType } from '@/types/monster';

const ATTRIBUTES: AttributeType[] = ['드래곤', '악마', '짐승', '새', '곤충', '식물', '미스터리', '메탈'];

const PRIMARY_TOOLS = [
  {
    title: '헨치 탐색',
    subtitle: 'SEARCH DATABASE',
    description: '이름, 속성, 레벨, 득코 여부와 서식지까지 한 번에 찾으세요.',
    href: '/hench',
    icon: Search,
    accent: 'cyan',
    shortcut: '01',
  },
  {
    title: '믹스법',
    subtitle: 'MIX ROUTE',
    description: '목표 헨치의 재료와 단계별 조합 흐름을 빠르게 확인하세요.',
    href: '/tree',
    icon: GitBranch,
    accent: 'violet',
    shortcut: '02',
  },
  {
    title: '어비스거래소',
    subtitle: 'ABYSS MARKET',
    description: '헨치와 아이템을 자사 또는 GP 조건으로 안전하게 등록하세요.',
    href: '/marketplace',
    icon: Store,
    accent: 'amber',
    shortcut: '03',
  },
  {
    title: '뉴비가이드',
    subtitle: 'START HERE',
    description: '탐색부터 성장과 거래까지 필요한 순서를 한 번에 안내합니다.',
    href: '/guide',
    icon: BookOpenCheck,
    accent: 'emerald',
    shortcut: '04',
  },
] as const;

const QUICK_LINKS = [
  { label: '레벨 계산', href: '/calculator', icon: Calculator },
  { label: '역산믹스법', href: '/reverse', icon: Layers3 },
  { label: '즐겨찾기', href: '/favorites', icon: Heart },
  { label: '건의사항', href: '/feedback', icon: Sparkles },
] as const;

const WINDOWS_PORTABLE_UPDATE_URL = '/manus-storage/ABYSS-MixSite-Portable-v1.0.5-Update_4ee54cb6.zip';

const ACCENT_STYLES = {
  cyan: {
    card: 'border-cyan-300/20 hover:border-cyan-300/70 hover:shadow-cyan-500/15',
    icon: 'bg-cyan-400/10 text-cyan-200 ring-cyan-300/25',
    number: 'text-cyan-300/45',
    line: 'from-cyan-300 via-cyan-400/40 to-transparent',
  },
  violet: {
    card: 'border-violet-300/20 hover:border-violet-300/70 hover:shadow-violet-500/15',
    icon: 'bg-violet-400/10 text-violet-200 ring-violet-300/25',
    number: 'text-violet-300/45',
    line: 'from-violet-300 via-violet-400/40 to-transparent',
  },
  amber: {
    card: 'border-amber-300/20 hover:border-amber-300/70 hover:shadow-amber-500/15',
    icon: 'bg-amber-400/10 text-amber-100 ring-amber-300/25',
    number: 'text-amber-200/45',
    line: 'from-amber-200 via-amber-400/40 to-transparent',
  },
  emerald: {
    card: 'border-emerald-300/20 hover:border-emerald-300/70 hover:shadow-emerald-500/15',
    icon: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/25',
    number: 'text-emerald-200/45',
    line: 'from-emerald-200 via-emerald-400/40 to-transparent',
  },
} as const;

function formatUpdateDate(date: string) {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${month}.${day}` : date;
}

export default function MainHome() {
  const monsters = useMonsterData();

  const overview = useMemo(() => {
    const attributeCounts: Record<AttributeType, number> = Object.fromEntries(
      ATTRIBUTES.map((attribute) => [attribute, 0]),
    ) as Record<AttributeType, number>;
    const habitats = new Set<string>();
    let acquired = 0;
    let mixReady = 0;

    for (const monster of monsters) {
      if (ATTRIBUTES.includes(monster.attribute as AttributeType)) {
        attributeCounts[monster.attribute as AttributeType] += 1;
      }
      if (monster.acquired === '0') acquired += 1;
      if (monster.main && monster.sub) mixReady += 1;
      splitHabitats(monster.habitat).forEach((habitat) => habitats.add(habitat));
    }

    return { attributeCounts, habitats: habitats.size, acquired, mixReady };
  }, [monsters]);

  const latestUpdates = updates.slice(0, 3);

  return (
    <div className="abyss-fantasy-page min-h-screen overflow-hidden bg-transparent pb-24 text-slate-100 md:pb-10">
      <section className="abyss-hero relative isolate overflow-hidden border-b border-cyan-100/10">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_8%_8%,rgba(191,233,255,0.28),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(126,173,255,0.2),transparent_35%),linear-gradient(135deg,rgba(6,37,70,0.93)_0%,rgba(11,63,105,0.82)_52%,rgba(22,55,111,0.86)_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(168,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(168,255,255,0.08)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -right-20 top-12 -z-10 h-72 w-72 rounded-full border border-cyan-200/15 shadow-[0_0_100px_rgba(34,211,238,0.18)]" />
        <div className="absolute -right-4 top-28 -z-10 h-48 w-48 rounded-full border border-violet-300/15" />

        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-18 xl:px-12">
          <section data-testid="abyss-home-hero-card" className="relative overflow-hidden rounded-[2rem] border border-cyan-100/20 bg-slate-950/42 px-6 py-8 shadow-2xl shadow-slate-950/40 backdrop-blur-md sm:px-8 sm:py-10">
            <img data-testid="abyss-home-mascot-background" src="/manus-storage/abyss-home-mascot_a3e91255.png" alt="출발점 마스코트 배경 장식" className="pointer-events-none absolute -right-12 bottom-0 h-52 w-60 select-none rounded-[3rem] object-cover opacity-[0.16] mix-blend-screen [mask-image:linear-gradient(to_top,black_30%,transparent_92%)] sm:right-4 sm:h-72 sm:w-80" decoding="async" />
            <div className="relative z-10 mb-6 flex justify-end sm:absolute sm:right-7 sm:top-7 sm:mb-0">
              <a
                data-testid="abyss-windows-portable-download"
                href={WINDOWS_PORTABLE_UPDATE_URL}
                download="ABYSS-MixSite-Portable-Alert-Update.zip"
                className="group inline-flex items-center gap-2 rounded-xl border border-violet-100/30 bg-slate-950/55 px-3.5 py-2.5 text-xs font-extrabold text-violet-50 shadow-lg shadow-slate-950/30 transition duration-200 hover:border-violet-100/70 hover:bg-violet-300/15 active:scale-[0.97]"
              >
                <Download className="h-4 w-4 text-violet-200 transition-transform duration-200 group-hover:-translate-y-0.5" />
                Windows PC 프로그램
              </a>
            </div>
            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)] xl:items-end xl:gap-12">
              <div className="abyss-hero-copy max-w-3xl">
            <div className="abyss-guide-status-badge mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/[0.07] px-3 py-1.5 text-[11px] font-bold tracking-[0.18em] text-cyan-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,1)]" />
              ABYSS DATABASE / LIVE GUIDE
            </div>
            <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-cyan-200/75">MIXMASTER · ABYSS SERVER</p>
            <h1 className="min-w-0 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.055em] sm:text-5xl lg:text-6xl"><span className="abyss-hero-title-primary">다음 믹스를 위한</span><span className="abyss-hero-title-highlight block">가장 빠른 출발점.</span></h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              헨치 탐색부터 믹스 조합, 안전한 거래와 초보자 가이드까지. 지금 필요한 정보를 한 화면에서 바로 시작하세요.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/hench"
                className="group inline-flex items-center gap-2 rounded-xl bg-cyan-200 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.18)] transition duration-200 hover:bg-white active:scale-[0.97]"
              >
                헨치 바로 찾기
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-100 transition duration-200 hover:border-cyan-100/40 hover:bg-white/[0.08] active:scale-[0.97]"
              >
                <Store className="h-4 w-4 text-amber-200" />
                어비스거래소
              </Link>
            </div>
              </div>
              <div className="relative rounded-2xl border border-sky-100/15 bg-slate-950/30 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400">DATABASE PULSE</p>
                <h2 className="mt-1 text-lg font-extrabold text-white">오늘의 탐색 현황</h2>
              </div>
              <div className="rounded-xl border border-cyan-200/15 bg-cyan-300/10 p-2.5 text-cyan-100">
                <Compass className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
                <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">헨치 데이터</p>
                <p className="mt-1 text-2xl font-black text-white">{monsters.length.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-cyan-100/70">실시간 동기화</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
                <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">서식지</p>
                <p className="mt-1 text-2xl font-black text-white">{overview.habitats}</p>
                <p className="mt-1 text-[11px] text-violet-100/70">개별 지역 탐색</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200/10 bg-amber-200/[0.045] px-3.5 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-amber-200" />
              <p className="text-xs leading-5 text-amber-50/90">회원 승인 기반으로 데이터와 거래소를 안전하게 이용할 수 있습니다.</p>
            </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-14 px-5 py-10 sm:px-8 md:space-y-18 md:py-14 xl:px-12">
        <section aria-labelledby="home-tools-title">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-cyan-200/70">CORE TOOLS</p>
              <h2 id="home-tools-title" className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">무엇을 도와드릴까요?</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-400">게임 흐름에 맞춰 가장 자주 쓰는 기능을 빠르게 시작하세요.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PRIMARY_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const accent = ACCENT_STYLES[tool.accent];
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`abyss-casual-card group relative min-h-56 overflow-hidden border bg-gradient-to-b from-sky-100/[0.13] to-indigo-100/[0.035] p-5 transition duration-200 hover:-translate-y-1 hover:shadow-2xl ${accent.card}`}
                >
                  <div className={`absolute left-0 top-0 h-px w-full bg-gradient-to-r ${accent.line}`} />
                  <span className={`absolute right-4 top-3 text-5xl font-black tracking-tighter ${accent.number}`}>{tool.shortcut}</span>
                  <div className={`relative inline-flex rounded-xl p-3 ring-1 ${accent.icon}`}><Icon className="h-6 w-6" /></div>
                  <div className="relative mt-8">
                    <p className="text-[10px] font-bold tracking-[0.17em] text-slate-400">{tool.subtitle}</p>
                    <h3 className="mt-2 text-xl font-extrabold text-white">{tool.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{tool.description}</p>
                  </div>
                  <span className="absolute bottom-5 right-5 inline-flex items-center gap-1 text-xs font-bold text-slate-300 transition group-hover:text-white">
                    시작하기 <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.14fr_.86fr]" aria-label="성장 도구와 데이터 현황">
          <div className="relative overflow-hidden rounded-2xl border border-violet-200/15 bg-gradient-to-br from-violet-500/[0.12] via-slate-900/75 to-cyan-500/[0.07] p-6 sm:p-8">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-violet-200/20" />
            <div className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-md">
                <div className="inline-flex rounded-lg border border-violet-200/20 bg-violet-300/10 p-2.5 text-violet-100"><Swords className="h-5 w-5" /></div>
                <p className="mt-5 text-[10px] font-bold tracking-[0.2em] text-violet-200">MIX ROUTE</p>
                <h2 className="mt-2 text-2xl font-black text-white">재료부터 결과까지, 흐름을 놓치지 마세요.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">믹스법과 역산믹스법으로 원하는 헨치의 앞·뒤 조합을 함께 확인할 수 있습니다.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href="/tree" className="inline-flex items-center gap-2 rounded-xl bg-violet-200 px-3.5 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-white active:scale-[0.97]">
                  믹스법 <GitBranch className="h-4 w-4" />
                </Link>
                <Link href="/reverse" aria-label="역산믹스법 열기" className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] p-2.5 text-slate-100 transition hover:bg-white/[0.12] active:scale-[0.97]">
                  <Wand2 className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400">DATA SNAPSHOT</p>
                <h2 className="mt-1 text-lg font-extrabold text-white">탐색 데이터</h2>
              </div>
              <Timer className="h-5 w-5 text-cyan-200" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
              <div className="border-b border-white/8 pb-3"><p className="text-2xl font-black text-cyan-200">{overview.acquired.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">득코 가능 헨치</p></div>
              <div className="border-b border-white/8 pb-3"><p className="text-2xl font-black text-violet-200">{overview.mixReady.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">믹스 조합 데이터</p></div>
              <div><p className="text-2xl font-black text-amber-100">{ATTRIBUTES.length}</p><p className="mt-1 text-xs text-slate-400">속성 분류</p></div>
              <Link href="/hench" className="group"><p className="text-sm font-bold text-cyan-100 transition group-hover:text-white">상세 필터 열기 <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></p><p className="mt-1 text-xs text-slate-400">서식지·레벨·득코</p></Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-attributes-title">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-cyan-200/70">EXPLORE BY ATTRIBUTE</p>
              <h2 id="home-attributes-title" className="mt-2 text-2xl font-black tracking-tight text-white">속성별 헨치 현황</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {ATTRIBUTES.map((attribute) => (
              <div key={attribute} data-attribute={attribute} className="rounded-xl border border-white/8 bg-white/[0.025] p-3 text-center">
                <img src={attributeImages[attribute]} alt="" className="mx-auto h-9 w-9 rounded-full border border-white/15 object-cover" loading="lazy" decoding="async" />
                <p className="mt-2 text-xs font-bold text-slate-200">{attribute}</p>
                <p className="mt-0.5 text-sm font-black text-cyan-200">{overview.attributeCounts[attribute]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[.78fr_1.22fr]" aria-label="바로가기와 최근 업데이트">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400">QUICK ACCESS</p>
            <h2 className="mt-2 text-xl font-black text-white">자주 쓰는 기능</h2>
            <div className="mt-5 divide-y divide-white/8">
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} className="group flex items-center justify-between py-3 text-sm font-bold text-slate-300 transition hover:text-white"><span className="inline-flex items-center gap-3"><Icon className="h-4 w-4 text-cyan-200" />{item.label}</span><ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-100" /></Link>;
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold tracking-[0.2em] text-slate-400">CHANGELOG</p><h2 className="mt-2 text-xl font-black text-white">최근 업데이트</h2></div>
              <Link href="/updates" className="rounded-lg border border-white/12 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition hover:border-cyan-200/40 hover:text-white">전체 보기</Link>
            </div>
            <div className="mt-5 space-y-2">
              {latestUpdates.map((update) => (
                <Link key={update.id} href="/updates" className="group flex gap-3 rounded-xl p-3 transition hover:bg-white/[0.045]">
                  <div className="min-w-11 pt-0.5 text-xs font-black text-cyan-200">{formatUpdateDate(update.date)}</div>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-100 transition group-hover:text-cyan-100">{update.title}</p><span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-slate-400">{update.version}</span></div><p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-400">{update.description}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
