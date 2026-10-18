import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { GitBranch, Search, X, ChevronDown, Layers3 } from "lucide-react";
import type { Monster } from "@/types/monster";
import { Input } from "@/components/ui/input";
import { useMonsterData } from "@/hooks/useMonsterData";
import { getRecipeEnchantLevel, getRecipeIngredients, isRecipeIngredient, normalizeRecipeName, resolveRecipeMonster } from "@/lib/recipeResolver";

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
const DEFAULT_TARGET = "데미헬파드";
const DEFAULT_DEPTH = 4;
const MAX_DEPTH = 5;

type SavedState = { targetName?: string; mainName?: string; subName?: string; maxDepth?: number };

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

function TargetMonsterPicker({
  selectedMonster,
  monsters,
  onSelect,
}: {
  selectedMonster: Monster | null;
  monsters: Monster[];
  onSelect: (name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(!selectedMonster);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setIsEditing(!selectedMonster);
  }, [selectedMonster?.id]);

  const results = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase().replace(/\s+/g, "");
    if (!normalizedQuery) return [];
    return monsters.filter((monster) => {
      const name = monster.name.toLowerCase().replace(/\s+/g, "");
      return name.includes(normalizedQuery)
        || monster.attribute.toLowerCase().includes(deferredQuery.trim().toLowerCase())
        || monster.habitat?.toLowerCase().includes(deferredQuery.trim().toLowerCase());
    }).slice(0, 12);
  }, [deferredQuery, monsters]);

  if (selectedMonster && !isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-sky-200 bg-white/85 p-3 shadow-sm sm:p-4" data-testid="mix-tree2-target-card">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-lg font-black text-sky-700">
          {selectedMonster.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-sky-700">선택된 헨치</p>
          <p className="truncate text-base font-black text-slate-900">{selectedMonster.name}</p>
          <p className="truncate text-xs text-slate-500">{selectedMonster.attribute} · Lv.{selectedMonster.baseLevel}~{selectedMonster.maxLevel}</p>
          <p className="mt-1 truncate text-xs text-slate-600">메인: {isRecipeIngredient(selectedMonster.main) ? normalizeRecipeName(selectedMonster.main) : "정보 없음"} · 서브: {isRecipeIngredient(selectedMonster.sub) ? normalizeRecipeName(selectedMonster.sub) : "정보 없음"}</p>
        </div>
        <button type="button" onClick={() => { setQuery(""); setOpen(false); setIsEditing(true); }} className="shrink-0 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-100">변경</button>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 rounded-xl border border-sky-200 bg-white/85 p-3 shadow-sm sm:p-4">
      <label className="mb-2 block text-sm font-black text-sky-900">헨치 검색</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-700/65" />
        <Input
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="몬스터 이름 검색..."
          aria-label="헨치 검색"
          className="h-11 border-sky-200 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400"
        />
        {query && <button type="button" onClick={() => { setQuery(""); setOpen(true); }} aria-label="검색어 지우기" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            {results.map((monster) => (
              <button
                type="button"
                key={monster.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onSelect(monster.name); setQuery(""); setOpen(false); setIsEditing(false); }}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-sky-50"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{monster.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{monster.attribute} · Lv.{monster.baseLevel}~{monster.maxLevel}</span>
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && results.length === 0 && <p className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 shadow-xl">검색 결과가 없습니다.</p>}
      </div>
      {selectedMonster && <button type="button" onClick={() => { setIsEditing(false); setQuery(""); setOpen(false); }} className="mt-2 text-xs font-semibold text-sky-800 underline underline-offset-2">현재 선택 유지: {selectedMonster.name}</button>}
      <p className="mt-2 text-xs text-slate-500">헨치를 선택하면 해당 헨치의 메인·서브 재료 계보가 자동으로 표시됩니다.</p>
    </div>
  );
}

function buildIngredientTree(
  rawName: string | null | undefined,
  monsters: Monster[],
  maxDepth: number,
  path: string,
): RecipeGridNode | null {
  if (!isRecipeIngredient(rawName)) return null;
  const resolved = resolveRecipeMonster(monsters, rawName);
  const enchantLevel = getRecipeEnchantLevel(rawName);
  if (!resolved) {
    return {
      key: path,
      name: normalizeRecipeName(rawName),
      enchantLevel,
      children: [],
      leafCount: 1,
      isMissing: true,
    };
  }
  const root = buildRecipeTree(resolved, monsters, maxDepth, new Set(), path);
  root.enchantLevel = enchantLevel;
  return root;
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
        {sectionLabel} 재료 정보가 없거나 선택한 헨치의 조합 데이터가 없습니다.
      </div>
    );
  }

  const hasNoMix = root.children.length === 0 && !root.truncated;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-400 bg-white shadow-sm" data-testid={testId}>
      <table className="w-full border-collapse text-slate-950" style={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: "5%" }} />
          {Array.from({ length: maxDepth + 1 }, (_, index) => <col key={index} style={{ width: `${95 / (maxDepth + 1)}%` }} />)}
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
                <td rowSpan={rowCount} className="border border-slate-500 px-1 text-center text-sm font-black" style={{ background: sectionColor, writingMode: "vertical-rl", textOrientation: "mixed" }}>
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
                  <td key={`${node.key}-${depth}`} rowSpan={cell.rowSpan} className={`min-w-0 border border-slate-500 px-1 py-1 text-center align-middle text-[11px] sm:px-1.5 sm:text-xs ${statusClass}`} title={formatCellTitle(node)}>
                    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-xs leading-tight">
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{node.name}</span>
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
  const [targetName, setTargetName] = useState(() => {
    if (initialState.targetName) return initialState.targetName;
    // 이전 버전의 저장 상태는 메인/서브 재료 이름만 갖고 있으므로 해당 조합의 결과 헨치를 찾아 이전합니다.
    if (initialState.mainName && initialState.subName) {
      const legacyTarget = monsters.find((monster) =>
        normalizeRecipeName(monster.main || "") === initialState.mainName
        && normalizeRecipeName(monster.sub || "") === initialState.subName,
      );
      if (legacyTarget) return legacyTarget.name;
    }
    return DEFAULT_TARGET;
  });
  const initialDepth = Number(initialState.maxDepth ?? DEFAULT_DEPTH);
  const [maxDepth, setMaxDepth] = useState(Number.isFinite(initialDepth) ? Math.max(2, Math.min(MAX_DEPTH, initialDepth)) : DEFAULT_DEPTH);

  const targetMonster = useMemo(() => monsters.find((monster) => monster.name === targetName) ?? null, [monsters, targetName]);
  const mainReference = targetMonster?.main;
  const subReference = targetMonster?.sub;

  useEffect(() => {
    if (initialState.targetName || !initialState.mainName || !initialState.subName || !monsters.length) return;
    const legacyTarget = monsters.find((monster) =>
      normalizeRecipeName(monster.main || "") === initialState.mainName
      && normalizeRecipeName(monster.sub || "") === initialState.subName,
    );
    if (legacyTarget) setTargetName((current) => current === DEFAULT_TARGET ? legacyTarget.name : current);
  }, [initialState, monsters]);

  const mainTree = useMemo(
    () => buildIngredientTree(mainReference, monsters, maxDepth, "main-root"),
    [mainReference, monsters, maxDepth],
  );
  const subTree = useMemo(
    () => buildIngredientTree(subReference, monsters, maxDepth, "sub-root"),
    [subReference, monsters, maxDepth],
  );
  const mainMonster = useMemo(() => isRecipeIngredient(mainReference) ? resolveRecipeMonster(monsters, mainReference) ?? null : null, [mainReference, monsters]);
  const subMonster = useMemo(() => isRecipeIngredient(subReference) ? resolveRecipeMonster(monsters, subReference) ?? null : null, [subReference, monsters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        targetName,
        mainName: mainMonster?.name ?? (isRecipeIngredient(mainReference) ? normalizeRecipeName(mainReference) : ""),
        subName: subMonster?.name ?? (isRecipeIngredient(subReference) ? normalizeRecipeName(subReference) : ""),
        maxDepth,
      }));
    } catch {
      // If local storage is unavailable, keep the current page usable.
    }
  }, [targetName, mainMonster, subMonster, mainReference, subReference, maxDepth]);

  return (
    <div className="flex min-h-full min-w-0 flex-col overflow-x-hidden bg-[#eaf7ff] text-slate-950">
      <header className="flex-shrink-0 border-b border-sky-200 bg-gradient-to-r from-sky-100 to-cyan-50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-sky-700" />
          <h1 className="text-xl font-black text-sky-900 sm:text-2xl">믹스법v2</h1>
        </div>
        <p className="mt-1 text-sm text-sky-800">기존 믹스법처럼 헨치 하나를 검색하면 해당 헨치의 메인·서브 재료 계보를 좌우 표로 확인합니다.</p>
      </header>

      <section className="grid min-w-0 flex-shrink-0 grid-cols-1 gap-3 border-b border-sky-200 bg-white/60 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_180px]">
        <TargetMonsterPicker selectedMonster={targetMonster} monsters={monsters} onSelect={setTargetName} />
        <div className="flex items-end">
          <label className="block w-full text-xs font-bold text-slate-700">
            표시 단계
            <span className="relative mt-2 block">
              <Layers3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} aria-label="표시 단계" className="h-11 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200">
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

      <div className="min-w-0 flex-1 p-2 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>선택한 결과 헨치: <strong className="text-slate-900">{targetMonster?.name ?? "선택 대기"}</strong> · 표는 화면 너비에 맞춰 자동 조정됩니다.</span>
          <span>메인: {mainMonster?.name ?? (isRecipeIngredient(mainReference) ? normalizeRecipeName(mainReference) : "정보 없음")} / 서브: {subMonster?.name ?? (isRecipeIngredient(subReference) ? normalizeRecipeName(subReference) : "정보 없음")}</span>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-violet-200 bg-white/70 p-1.5 shadow-sm sm:p-2">
            <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-2 py-2 sm:px-3">
              <span className="inline-block h-3 w-3 shrink-0 rounded-sm bg-violet-300" />
              <h2 className="text-sm font-black text-violet-950">메인 계보</h2>
              <span className="ml-auto min-w-0 truncate text-xs text-violet-700">{mainMonster?.name ?? (isRecipeIngredient(mainReference) ? normalizeRecipeName(mainReference) : "재료 없음")}</span>
            </div>
            <RecipeTreeTable root={mainTree} sectionLabel="메인" maxDepth={maxDepth} testId="mix-tree2-main-table" />
          </section>
          <section className="min-w-0 rounded-xl border border-orange-200 bg-white/70 p-1.5 shadow-sm sm:p-2">
            <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-2 sm:px-3">
              <span className="inline-block h-3 w-3 shrink-0 rounded-sm bg-orange-300" />
              <h2 className="text-sm font-black text-orange-950">서브 계보</h2>
              <span className="ml-auto min-w-0 truncate text-xs text-orange-800">{subMonster?.name ?? (isRecipeIngredient(subReference) ? normalizeRecipeName(subReference) : "재료 없음")}</span>
            </div>
            <RecipeTreeTable root={subTree} sectionLabel="서브" maxDepth={maxDepth} testId="mix-tree2-sub-table" />
          </section>
        </div>
      </div>
    </div>
  );
}
