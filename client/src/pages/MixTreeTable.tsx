import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { GitBranch, Search, X, ChevronDown, Layers3 } from "lucide-react";
import type { Monster } from "@/types/monster";
import { Input } from "@/components/ui/input";
import { useMonsterData } from "@/hooks/useMonsterData";
import { getRecipeEnchantLevel, getRecipeIngredients, normalizeRecipeName, resolveRecipeMonster } from "@/lib/recipeResolver";

type RecipeGridNode = {
  key: string;
  name: string;
  monster?: Monster;
  enchantLevel?: number;
  children: RecipeGridNode[];
  leafCount: number;
  isCircular?: boolean;
  isMissing?: boolean;
  truncated?: boolean;
};

type PositionedCell = { node: RecipeGridNode; rowSpan: number };
type RecipeMatrix = Array<Map<number, PositionedCell>>;

const STORAGE_KEY = "abyss-mix-tree-table-state-v1";
const DEFAULT_MAIN = "뉴큐티캣";
const DEFAULT_SUB = "요르문";
const DEFAULT_DEPTH = 4;
const MAX_DEPTH = 5;

type SavedState = { mainName?: string; subName?: string; maxDepth?: number };

function readSavedState(): SavedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SavedState : {};
  } catch {
    return {};
  }
}

function buildRecipeTree(
  monster: Monster,
  monsters: Monster[],
  depthLimit: number,
  ancestry: Set<string> = new Set(),
  path = "root",
): RecipeGridNode {
  const nextAncestry = new Set(ancestry);
  nextAncestry.add(monster.id);
  const rawIngredients = getRecipeIngredients(monster);
  const truncated = rawIngredients.length > 0 && depthLimit <= 0;
  const children: RecipeGridNode[] = [];

  if (depthLimit > 0) {
    rawIngredients.forEach((rawName, index) => {
      const resolved = resolveRecipeMonster(monsters, rawName);
      const key = `${path}/${index}-${normalizeRecipeName(rawName)}`;
      const enchantLevel = getRecipeEnchantLevel(rawName);
      if (!resolved) {
        children.push({
          key,
          name: normalizeRecipeName(rawName),
          enchantLevel,
          children: [],
          leafCount: 1,
          isMissing: true,
        });
        return;
      }
      if (nextAncestry.has(resolved.id)) {
        children.push({
          key,
          name: resolved.name,
          monster: resolved,
          enchantLevel,
          children: [],
          leafCount: 1,
          isCircular: true,
        });
        return;
      }
      children.push(buildRecipeTree(resolved, monsters, depthLimit - 1, nextAncestry, keyWithDepth(key, depthLimit)));
      children[children.length - 1].enchantLevel = enchantLevel;
    });
  }

  return {
    key: path,
    name: monster.name,
    monster,
    children,
    leafCount: children.length ? children.reduce((sum, child) => sum + child.leafCount, 0) : 1,
    truncated,
  };
}

function keyWithDepth(key: string, depthLimit: number) {
  return `${key}:remaining-${depthLimit}`;
}

function buildMatrix(root: RecipeGridNode, maxDepth: number): RecipeMatrix {
  const rows: RecipeMatrix = Array.from({ length: Math.max(1, root.leafCount) }, () => new Map<number, PositionedCell>());
  const place = (node: RecipeGridNode, depth: number, startRow: number) => {
    rows[startRow].set(depth, { node, rowSpan: Math.max(1, node.leafCount) });
    let nextRow = startRow;
    node.children.forEach((child) => {
      if (depth < maxDepth) {
        place(child, depth + 1, nextRow);
        nextRow += Math.max(1, child.leafCount);
      }
    });
  };
  place(root, 0, 0);
  return rows;
}

function MonsterPicker({
  label,
  selectedName,
  monsters,
  color,
  onSelect,
}: {
  label: string;
  selectedName: string;
  monsters: Monster[];
  color: "main" | "sub";
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => setQuery(selectedName), [selectedName]);

  const results = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase().replace(/\s+/g, "");
    if (!normalizedQuery) return [];
    return monsters.filter((monster) => {
      const name = monster.name.toLowerCase().replace(/\s+/g, "");
      return name.includes(normalizedQuery) || monster.attribute.toLowerCase().includes(deferredQuery.trim().toLowerCase());
    }).slice(0, 12);
  }, [deferredQuery, monsters]);

  const accentClass = color === "main"
    ? "border-violet-300 bg-violet-50 text-violet-950"
    : "border-orange-300 bg-orange-50 text-orange-950";

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${accentClass}`}>
      <label className="mb-2 block text-sm font-black">{label} 헨치 선택</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-55" />
        <Input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="헨치 이름 검색..."
          aria-label={`${label} 헨치 검색`}
          className="border-sky-200 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400"
        />
        {query && <button type="button" onClick={() => { setQuery(""); onSelect(""); setOpen(true); }} aria-label={`${label} 선택 지우기`} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            {results.map((monster) => (
              <button
                type="button"
                key={monster.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onSelect(monster.name); setQuery(monster.name); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-sky-50"
              >
                <span className="truncate text-sm font-semibold text-slate-900">{monster.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{monster.attribute} · Lv.{monster.baseLevel}~{monster.maxLevel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs opacity-70">현재 선택: {selectedName || "선택 안 함"}</p>
    </div>
  );
}

function formatCellTitle(node: RecipeGridNode) {
  if (node.isCircular) return `순환: ${node.name}`;
  if (node.isMissing) return `정보 없음: ${node.name}`;
  return node.name;
}

function RecipeTreeTable({
  root,
  sectionLabel,
  maxDepth,
  testId,
}: {
  root: RecipeGridNode | null;
  sectionLabel: "메인" | "서브";
  maxDepth: number;
  testId: string;
}) {
  const matrix = useMemo(() => root ? buildMatrix(root, maxDepth) : [], [root, maxDepth]);
  const rowCount = matrix.length;
  const sectionColor = sectionLabel === "메인" ? "#eadcf2" : "#ffb98a";
  if (!root) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500">
        {sectionLabel} 헨치를 검색해 선택하면 계보가 여기에 표시됩니다.
      </div>
    );
  }

  const hasNoMix = root.children.length === 0 && !root.truncated;

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-400 bg-white shadow-sm" data-testid={testId}>
      <table className="border-collapse text-slate-950" style={{ tableLayout: "fixed", minWidth: `${34 + (maxDepth + 1) * 148}px` }}>
        <colgroup>
          <col style={{ width: 34 }} />
          {Array.from({ length: maxDepth + 1 }, (_, index) => <col key={index} style={{ width: 148 }} />)}
        </colgroup>
        <thead>
          <tr className="bg-slate-100 text-xs font-bold">
            <th className="border border-slate-400 px-1 py-2" aria-label={`${sectionLabel} 구분`} />
            {Array.from({ length: maxDepth + 1 }, (_, depth) => (
              <th key={depth} className="border border-slate-400 px-1 py-2">{depth === 0 ? "목표 헨치" : `${depth}단계 재료`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rowIndex) => (
            <tr key={`${sectionLabel}-row-${rowIndex}`} className="h-[38px]">
              {rowIndex === 0 && (
                <td rowSpan={rowCount} className="border border-slate-500 px-1 text-center text-sm font-black" style={{ background: sectionColor, writingMode: "vertical-rl", textOrientation: "mixed", minWidth: 34 }}>
                  {sectionLabel}
                </td>
              )}
              {Array.from(row.entries()).sort(([a], [b]) => a - b).map(([depth, cell]) => {
                const node = cell.node;
                const statusClass = node.isCircular
                  ? "bg-rose-100 text-rose-900"
                  : node.isMissing
                    ? "bg-amber-100 text-amber-950"
                    : depth === 0
                      ? "bg-slate-100 font-bold"
                      : "bg-white";
                return (
                  <td key={`${node.key}-${depth}`} rowSpan={cell.rowSpan} className={`border border-slate-500 px-1.5 py-1 text-center align-middle ${statusClass}`} title={formatCellTitle(node)}>
                    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-xs leading-tight">
                      <span className="break-words">{node.name}</span>
                      {node.enchantLevel !== undefined && <span className="whitespace-nowrap font-semibold text-sky-700">[{node.enchantLevel}]</span>}
                      {node.isCircular && <span className="text-[10px] font-bold text-rose-700">순환</span>}
                      {node.isMissing && <span className="text-[10px] font-bold text-amber-800">확인 필요</span>}
                      {node.truncated && <span className="font-black text-sky-700">…</span>}
                      {depth === 0 && hasNoMix && <span className="w-full text-[10px] font-medium text-slate-500">하위 믹스 없음</span>}
                    </div>
                    {node.monster && depth > 0 && <div className="mt-0.5 text-[10px] text-slate-500">Lv.{node.monster.baseLevel}~{node.monster.maxLevel}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MixTreeTable() {
  const monsters = useMonsterData();
  const [initialState] = useState(readSavedState);
  const [mainName, setMainName] = useState(initialState.mainName ?? DEFAULT_MAIN);
  const [subName, setSubName] = useState(initialState.subName ?? DEFAULT_SUB);
  const initialDepth = Number(initialState.maxDepth ?? DEFAULT_DEPTH);
  const [maxDepth, setMaxDepth] = useState(Number.isFinite(initialDepth) ? Math.max(2, Math.min(MAX_DEPTH, initialDepth)) : DEFAULT_DEPTH);

  const mainMonster = useMemo(() => monsters.find((monster) => monster.name === mainName) ?? null, [monsters, mainName]);
  const subMonster = useMemo(() => monsters.find((monster) => monster.name === subName) ?? null, [monsters, subName]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mainName, subName, maxDepth }));
    } catch {
      // If local storage is unavailable, keep the current page usable.
    }
  }, [mainName, subName, maxDepth]);

  const mainTree = useMemo(() => mainMonster ? buildRecipeTree(mainMonster, monsters, maxDepth) : null, [mainMonster, monsters, maxDepth]);
  const subTree = useMemo(() => subMonster ? buildRecipeTree(subMonster, monsters, maxDepth) : null, [subMonster, monsters, maxDepth]);

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-[#eaf7ff] text-slate-950">
      <header className="flex-shrink-0 border-b border-sky-200 bg-gradient-to-r from-sky-100 to-cyan-50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-sky-700" />
          <h1 className="text-xl font-black text-sky-900 sm:text-2xl">믹스법2</h1>
        </div>
        <p className="mt-1 text-sm text-sky-800">메인과 서브 헨치의 하위 믹스 계보를 사진처럼 가로 표로 펼쳐 확인합니다.</p>
      </header>

      <section className="grid flex-shrink-0 grid-cols-1 gap-3 border-b border-sky-200 bg-white/60 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:p-5">
        <MonsterPicker label="메인" selectedName={mainName} monsters={monsters} color="main" onSelect={setMainName} />
        <MonsterPicker label="서브" selectedName={subName} monsters={monsters} color="sub" onSelect={setSubName} />
        <div className="flex items-end">
          <label className="block w-full text-xs font-bold text-slate-700">
            표시 단계
            <span className="relative mt-2 block">
              <Layers3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} aria-label="표시 단계" className="h-10 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
                <option value={2}>2단계</option>
                <option value={3}>3단계</option>
                <option value={4}>4단계</option>
                <option value={5}>5단계</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </span>
          </label>
        </div>
      </section>

      <div className="min-w-0 flex-1 p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>각 칸의 세로 높이는 하위 계보 수에 맞춰 연결됩니다. 표는 가로로 스크롤할 수 있습니다.</span>
          <span>기본 대상: 뉴큐티캣 / 요르문</span>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-5 2xl:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-violet-200 bg-white/70 p-2 shadow-sm sm:p-3">
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-violet-300" />
              <h2 className="text-sm font-black text-violet-950">메인 계보</h2>
              <span className="ml-auto text-xs text-violet-700">{mainMonster?.name ?? "선택 대기"}</span>
            </div>
            <RecipeTreeTable root={mainTree} sectionLabel="메인" maxDepth={maxDepth} testId="mix-tree2-main-table" />
          </section>
          <section className="min-w-0 rounded-xl border border-orange-200 bg-white/70 p-2 shadow-sm sm:p-3">
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-orange-300" />
              <h2 className="text-sm font-black text-orange-950">서브 계보</h2>
              <span className="ml-auto text-xs text-orange-800">{subMonster?.name ?? "선택 대기"}</span>
            </div>
            <RecipeTreeTable root={subTree} sectionLabel="서브" maxDepth={maxDepth} testId="mix-tree2-sub-table" />
          </section>
        </div>
      </div>
    </div>
  );
}
