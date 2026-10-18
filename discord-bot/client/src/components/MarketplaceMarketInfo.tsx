import { ImageOff, TrendingUp } from "lucide-react";
import { attributeImages } from "@/data/attributeImages";
import type { Monster } from "@/types/monster";
import type { MarketplaceMonsterSnapshot, MarketplacePriceSummary } from "@/lib/marketplace";

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function MarketplaceMonsterImage({ monster, monsters }: { monster: MarketplaceMonsterSnapshot; monsters: Monster[] }) {
  const current = monsters.find((candidate) => candidate.id === monster.id) || monsters.find((candidate) => candidate.name === monster.name);
  const fallback = attributeImages[(current?.attribute || monster.attribute || "악마") as keyof typeof attributeImages] || attributeImages.악마;
  const source = current?.imageUrl || fallback;
  if (!source) return <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-600"><ImageOff className="h-5 w-5" /></div>;
  return <img src={source} alt={`${monster.name} 이미지`} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()} className="h-16 w-16 shrink-0 rounded-xl border border-cyan-400/20 bg-slate-900 object-cover" />;
}

export function MarketplaceAveragePrice({ summary, accent = "amber" }: { summary?: MarketplacePriceSummary; accent?: "amber" | "violet" }) {
  const color = accent === "violet" ? "border-violet-400/20 bg-violet-400/5 text-violet-200" : "border-amber-400/20 bg-amber-400/5 text-amber-200";
  const captionColor = accent === "violet" ? "text-violet-200/60" : "text-amber-200/60";
  const value = summary?.displayBoxesPerUnit;
  const label = summary?.source === "recent"
    ? `최근 2주 거래 ${formatNumber(summary.recentCompletedCount)}건 · 마리당`
    : summary?.source === "baseline"
      ? "초기 시세표 기준 · 마리당"
      : "평균 거래가 · 마리당";
  return <div className={`rounded-xl border px-3 py-2 ${color}`}><p className={`flex items-center gap-1 text-[11px] ${captionColor}`}><TrendingUp className="h-3 w-3" />{label}</p><p className="mt-0.5 font-bold">{value === null || value === undefined ? "시세표 대기" : `${formatNumber(value)}개`}</p></div>;
}
