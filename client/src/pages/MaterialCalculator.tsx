import { useState, useMemo, useDeferredValue, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { attributeImages } from '@/data/attributeImages';
import { Calculator, Search, GitBranch, RotateCcw, Plus, X } from 'lucide-react';
import { useMonsterData } from '@/hooks/useMonsterData';
import { monsterTypeBadgeClass, resolveMonsterType } from '@/lib/monsterType';
import {
  calculateMaterialCounts,
  collectRecipeChoices,
  getRecipeOptions,
  type RecipeSelections,
} from '@/lib/materialCalculator';

interface Monster {
  id: string;
  name: string;
  baseLevel?: number;
  maxLevel?: number;
  attribute: string;
  type?: '장코' | '단코' | string;
  acquired?: '0' | 'x' | string;
  habitat?: string | null;
  main?: string | null;
  sub?: string | null;
  main2?: string | null;
  sub2?: string | null;
  imageUrl?: string;
}

const compactName = (value: string) => value.replace(/\s+/g, '');

interface MaterialCalculatorTab {
  id: string;
  selectedMonster: Monster | null;
  quantity: number;
  checkedMaterials: string[];
  expandedMaterial: string | null;
  recipeSelections: RecipeSelections;
}

interface MaterialCalculatorSavedState {
  tabs: MaterialCalculatorTab[];
  activeTabId: string;
}

const MATERIAL_CALCULATOR_STORAGE_KEY = 'abyss-material-calculator-tabs-v1';
const MAX_MATERIAL_CALCULATOR_TABS = 7;

function createMaterialCalculatorTab(): MaterialCalculatorTab {
  return {
    id: `material-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    selectedMonster: null,
    quantity: 1,
    checkedMaterials: [],
    expandedMaterial: null,
    recipeSelections: {},
  };
}

function readMaterialCalculatorState(): MaterialCalculatorSavedState {
  const firstTab = createMaterialCalculatorTab();
  if (typeof window === 'undefined') return { tabs: [firstTab], activeTabId: firstTab.id };

  try {
    const raw = window.localStorage.getItem(MATERIAL_CALCULATOR_STORAGE_KEY);
    if (!raw) return { tabs: [firstTab], activeTabId: firstTab.id };
    const parsed = JSON.parse(raw) as Partial<MaterialCalculatorSavedState>;
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      return { tabs: [firstTab], activeTabId: firstTab.id };
    }

    const tabs = parsed.tabs.slice(0, MAX_MATERIAL_CALCULATOR_TABS).map((candidate): MaterialCalculatorTab => {
      const tab = candidate as Partial<MaterialCalculatorTab>;
      const selectedMonster = tab.selectedMonster && typeof tab.selectedMonster === 'object'
        && typeof tab.selectedMonster.id === 'string'
        && typeof tab.selectedMonster.name === 'string'
        ? tab.selectedMonster as Monster
        : null;
      const recipeSelections = tab.recipeSelections && typeof tab.recipeSelections === 'object'
        ? Object.fromEntries(Object.entries(tab.recipeSelections).filter(([, value]) => Number.isInteger(value) && Number(value) >= 0)) as RecipeSelections
        : {};
      return {
        id: typeof tab.id === 'string' && tab.id ? tab.id : createMaterialCalculatorTab().id,
        selectedMonster,
        quantity: Number.isFinite(Number(tab.quantity)) ? Math.max(1, Math.floor(Number(tab.quantity))) : 1,
        checkedMaterials: Array.isArray(tab.checkedMaterials) ? tab.checkedMaterials.filter((name): name is string => typeof name === 'string') : [],
        expandedMaterial: typeof tab.expandedMaterial === 'string' ? tab.expandedMaterial : null,
        recipeSelections,
      };
    });
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId) ? String(parsed.activeTabId) : tabs[0].id;
    return { tabs: tabs.length ? tabs : [firstTab], activeTabId: tabs.length ? activeTabId : firstTab.id };
  } catch {
    return { tabs: [firstTab], activeTabId: firstTab.id };
  }
}

export default function MaterialCalculator() {
  const monsters = useMonsterData() as Monster[];

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedState, setSavedState] = useState<MaterialCalculatorSavedState>(readMaterialCalculatorState);
  const tabs = savedState.tabs;
  const activeTabId = savedState.activeTabId;
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);
  const selectedMonster = activeTab?.selectedMonster ?? null;
  const quantity = activeTab?.quantity ?? 1;
  const checkedMaterials = useMemo(() => new Set(activeTab?.checkedMaterials ?? []), [activeTab?.checkedMaterials]);
  const expandedMaterial = activeTab?.expandedMaterial ?? null;
  const recipeSelections = activeTab?.recipeSelections ?? {};

  useEffect(() => {
    try {
      window.localStorage.setItem(MATERIAL_CALCULATOR_STORAGE_KEY, JSON.stringify(savedState));
    } catch {
      // 저장 공간이 꽉 찼거나 브라우저 설정에서 저장이 막힌 경우에도 계산기는 계속 작동합니다.
    }
  }, [savedState]);

  const updateActiveTab = useCallback((updater: (tab: MaterialCalculatorTab) => MaterialCalculatorTab) => {
    setSavedState((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => tab.id === current.activeTabId ? updater(tab) : tab),
    }));
  }, []);

  const setQuantity = (update: number | ((current: number) => number)) => {
    updateActiveTab((tab) => ({
      ...tab,
      quantity: Math.max(1, Math.floor(typeof update === 'function' ? update(tab.quantity) : update)),
    }));
  };

  const setExpandedMaterial = (update: string | null | ((current: string | null) => string | null)) => {
    updateActiveTab((tab) => ({
      ...tab,
      expandedMaterial: typeof update === 'function' ? update(tab.expandedMaterial) : update,
    }));
  };

  const searchResults = useMemo(() => {
    if (!deferredSearchQuery.trim()) return [];
    const query = compactName(deferredSearchQuery.toLowerCase());
    return monsters
      .filter((m) => compactName(m.name.toLowerCase()).includes(query))
      .slice(0, 10);
  }, [deferredSearchQuery, monsters]);

  const materials = useMemo(() => {
    if (!selectedMonster) return {};
    return calculateMaterialCounts(monsters, selectedMonster, quantity, recipeSelections);
  }, [selectedMonster, quantity, monsters, recipeSelections]);

  const recipeChoices = useMemo(() => {
    if (!selectedMonster) return [];
    return collectRecipeChoices(monsters, selectedMonster, recipeSelections);
  }, [selectedMonster, monsters, recipeSelections]);

  const sortedMaterials = useMemo(() => {
    return Object.entries(materials)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .map(([name, count]) => ({
        name,
        count,
        isChecked: checkedMaterials.has(name),
      }));
  }, [materials, checkedMaterials]);

  const rootRecipeOptions = selectedMonster ? getRecipeOptions(selectedMonster) : [];
  const multiRecipeSummary = rootRecipeOptions.length > 1
    ? `${selectedMonster?.name} = ${rootRecipeOptions[0].main} / ${rootRecipeOptions[1].main} + ${rootRecipeOptions[0].sub} / ${rootRecipeOptions[1].sub}`
    : rootRecipeOptions.length === 1
      ? `${selectedMonster?.name} = ${rootRecipeOptions[0].main} + ${rootRecipeOptions[0].sub}`
      : '';

  const totalMaterials = useMemo(
    () => sortedMaterials.reduce((sum, material) => sum + material.count, 0),
    [sortedMaterials],
  );

  const remainingCount = useMemo(() => {
    return sortedMaterials.reduce((total, material) => (material.isChecked ? total : total + material.count), 0);
  }, [sortedMaterials]);

  const acquiredCount = totalMaterials - remainingCount;

  // 체크박스는 화면 표시만 바꾸는 토글이 아니라, 구한 재료 상태를 확정한다.
  // 브라우저가 onChange를 연속 전달하거나 탭 상태가 갱신되는 상황에서도
  // 이벤트가 전달한 checked 값 그대로 저장해 계산 요약과 행별 남은 수량이 일치하도록 한다.
  const setMaterialChecked = (name: string, isChecked: boolean) => {
    updateActiveTab((tab) => {
      const updated = new Set(tab.checkedMaterials);
      if (isChecked) updated.add(name);
      else updated.delete(name);
      return { ...tab, checkedMaterials: Array.from(updated) };
    });
  };

  const setRecipeSelection = (monster: Monster, optionIndex: number) => {
    updateActiveTab((tab) => ({
      ...tab,
      recipeSelections: { ...tab.recipeSelections, [monster.id]: optionIndex },
      checkedMaterials: [],
      expandedMaterial: null,
    }));
  };

  const selectMonster = (monster: Monster) => {
    updateActiveTab((tab) => ({
      ...tab,
      selectedMonster: monster,
      checkedMaterials: [],
      expandedMaterial: null,
      recipeSelections: {},
    }));
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleReset = () => {
    updateActiveTab((tab) => ({
      ...tab,
      selectedMonster: null,
      quantity: 1,
      checkedMaterials: [],
      expandedMaterial: null,
      recipeSelections: {},
    }));
    setSearchQuery('');
    setShowDropdown(false);
  };

  const switchTab = (tabId: string) => {
    setSavedState((current) => ({ ...current, activeTabId: tabId }));
    setSearchQuery('');
    setShowDropdown(false);
  };

  const addTab = () => {
    setSavedState((current) => {
      if (current.tabs.length >= MAX_MATERIAL_CALCULATOR_TABS) return current;
      const newTab = createMaterialCalculatorTab();
      return { tabs: [...current.tabs, newTab], activeTabId: newTab.id };
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const closeTab = (tabId: string) => {
    setSavedState((current) => {
      if (current.tabs.length <= 1) return current;
      const remaining = current.tabs.filter((tab) => tab.id !== tabId);
      if (remaining.length === current.tabs.length) return current;
      const nextActiveTabId = current.activeTabId === tabId
        ? remaining[Math.max(0, current.tabs.findIndex((tab) => tab.id === tabId) - 1)]?.id ?? remaining[0].id
        : current.activeTabId;
      return { tabs: remaining, activeTabId: nextActiveTabId };
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const renderRecipeChoice = (monster: Monster, nested = false) => {
    const options = getRecipeOptions(monster);
    if (options.length < 2) return null;
    const selectedIndex = Number(recipeSelections[monster.id] ?? options[0].index);

    return (
      <div
        key={monster.id}
        className={`rounded-xl border p-4 ${
          nested
            ? 'border-cyan-500/10 bg-slate-900/20'
            : 'border-cyan-500/20 bg-slate-800/30'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-cyan-300">{monster.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-300">서식지: {monster.habitat?.trim() || '정보 없음'}</p>
            <p className="mt-0.5 text-xs text-slate-500">조합법 {options.length}가지 · 계산에 사용할 조합</p>
          </div>
          <span className="shrink-0 rounded-full border border-cyan-500/20 px-2 py-0.5 text-[10px] text-slate-400">
            Lv.{monster.baseLevel ?? '-'}
          </span>
        </div>

        <div className="space-y-2">
          {options.map((option, optionPosition) => (
            <label
              key={`${monster.id}-${option.index}`}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-3 transition-colors ${
                selectedIndex === option.index
                  ? 'border-cyan-400/60 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-500'
              }`}
            >
              <input
                type="radio"
                name={`recipe-${monster.id}`}
                checked={selectedIndex === option.index}
                onChange={() => setRecipeSelection(monster, option.index)}
                className="h-4 w-4 accent-cyan-400"
              />
              <span className="shrink-0 text-xs font-semibold text-slate-400">조합 {optionPosition + 1}</span>
              <span className="min-w-0 flex-1 text-sm text-white">{option.main}</span>
              <span className="shrink-0 font-bold text-cyan-300">+</span>
              <span className="min-w-0 flex-1 text-sm text-white">{option.sub}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Calculator className="h-8 w-8 text-cyan-400" />
          <div>
            <h1 className="text-3xl font-bold text-cyan-300">재료 계산기</h1>
            <p className="mt-1 text-xs text-slate-500">173레벨 이하의 득코 가능 헨치는 최상위 단계에서 체크하고, 174레벨 이상은 하위 믹스를 따라갑니다.</p>
          </div>
        </div>

        {/* 여러 계산 내용을 각각 보관하는 탭 */}
        <div role="tablist" aria-label="재료계산기 탭" className="mb-4 flex flex-nowrap items-end gap-1 overflow-x-auto border-b border-cyan-500/20 bg-slate-900/50 px-2 pt-2">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              role="presentation"
              className={`group flex max-w-[12rem] flex-shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-sm transition-colors ${tab.id === activeTabId ? 'border-cyan-400/60 bg-slate-800 text-cyan-200' : 'border-transparent text-slate-400 hover:bg-slate-800/40'}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === activeTabId}
                onClick={() => switchTab(tab.id)}
                className="min-w-0 max-w-[9rem] truncate text-left font-medium"
                title={tab.selectedMonster?.name || `탭 ${index + 1}`}
              >
                {tab.selectedMonster?.name || `탭 ${index + 1}`}
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => closeTab(tab.id)}
                  aria-label={`${tab.selectedMonster?.name || `탭 ${index + 1}`} 닫기`}
                  className="flex-shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {tabs.length < MAX_MATERIAL_CALCULATOR_TABS && (
            <button
              type="button"
              onClick={addTab}
              aria-label="재료계산기 탭 추가"
              title="새 계산 탭 추가"
              className="mb-0.5 flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-cyan-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <span className="ml-auto flex-shrink-0 self-center pb-1 pl-2 text-xs text-slate-500">자동 저장 · {tabs.length} / {MAX_MATERIAL_CALCULATOR_TABS}</span>
        </div>

        {/* 헨치 검색 */}
        <div className="mb-6 rounded-xl border border-cyan-500/20 bg-slate-800/50 p-5">
          <div className="relative">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="만들 헨치 이름 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-lg border border-cyan-500/30 bg-slate-800 shadow-xl">
                {searchResults.map((monster) => (
                  <button
                    key={monster.id}
                    type="button"
                    onClick={() => selectMonster(monster)}
                    className="flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-3 text-left last:border-b-0 hover:bg-slate-700"
                  >
                    <img
                      src={monster.imageUrl || attributeImages[monster.attribute as keyof typeof attributeImages] || attributeImages['악마']}
                      alt={monster.attribute}
                      loading="lazy"
                      decoding="async"
                      className="h-7 w-7 rounded object-cover"
                    />
                    <span className="flex-1 text-white">{monster.name}</span>
                    <span className="text-xs text-slate-500">Lv.{monster.baseLevel ?? '-'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!selectedMonster ? (
          <div className="rounded-xl border border-dashed border-cyan-500/20 bg-slate-800/30 py-20 text-center">
            <GitBranch className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-lg font-semibold text-slate-300">만들 헨치를 선택해 주세요</p>
            <p className="mt-1 text-sm text-slate-500">믹스법을 선택해 필요한 재료를 확인하세요. 173레벨 이하의 득코 가능 헨치는 해당 단계에서 멈추고, 174레벨 이상 또는 득코 불가능한 헨치는 하위 믹스를 따라갑니다.</p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {/* 왼쪽: 믹스법 선택 */}
            <section className="rounded-xl border border-cyan-500/20 bg-slate-800/50 p-6">
              <div className="mb-5 flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-cyan-400" />
                <div>
                  <h2 className="text-xl font-bold text-cyan-300">믹스법 선택</h2>
                  <p className="mt-0.5 text-xs text-slate-500">여러 조합법이 있는 헨치는 계산에 사용할 조합을 선택합니다.</p>
                </div>
              </div>

              <div className="mb-5 rounded-xl border border-cyan-500/15 bg-slate-900/20 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedMonster.imageUrl || attributeImages[selectedMonster.attribute as keyof typeof attributeImages] || attributeImages['악마']}
                    alt={selectedMonster.attribute}
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-white">{selectedMonster.name}</h3>
                    <p className="text-sm text-slate-400">{selectedMonster.attribute} · Lv.{selectedMonster.baseLevel ?? '-'}</p>
                  </div>
                </div>

                {multiRecipeSummary && (
                  <div className="mt-4 rounded-lg border border-cyan-500/10 bg-slate-800/40 px-3 py-3">
                    <p className="text-xs text-slate-500">전체 조합법</p>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-200">{multiRecipeSummary}</p>
                  </div>
                )}
              </div>

              {rootRecipeOptions.length >= 2 ? (
                <div className="space-y-3">
                  {renderRecipeChoice(selectedMonster)}
                </div>
              ) : rootRecipeOptions.length === 1 ? (
                <div className="rounded-xl border border-cyan-500/10 bg-slate-900/20 p-4">
                  <p className="mb-2 text-xs text-slate-500">현재 조합법</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-slate-800 px-2.5 py-1.5 text-white">{rootRecipeOptions[0].main}</span>
                    <span className="font-bold text-cyan-300">+</span>
                    <span className="rounded-md bg-slate-800 px-2.5 py-1.5 text-white">{rootRecipeOptions[0].sub}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
                  저장된 조합법이 없습니다.
                </div>
              )}

              {recipeChoices.filter((monster) => monster.id !== selectedMonster.id).length > 0 && (
                <div className="mt-5 border-t border-slate-700/50 pt-5">
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-cyan-300">하위 헨치 조합 선택</h3>
                    <p className="mt-1 text-xs text-slate-500">선택한 경로 안에 여러 조합법이 있는 중간 헨치입니다.</p>
                  </div>
                  <div className="space-y-3">
                    {recipeChoices
                      .filter((monster) => monster.id !== selectedMonster.id)
                      .map((monster) => renderRecipeChoice(monster as Monster, true))}
                  </div>
                </div>
              )}
            </section>

            {/* 오른쪽: 재료 계산기 */}
            <section className="lg:sticky lg:top-4 rounded-xl border border-cyan-500/20 bg-slate-800/50 p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-cyan-400" />
                    <h2 className="text-xl font-bold text-cyan-300">재료계산기</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">173레벨 이하의 득코 가능한 최상위 헨치만 체크할 수 있습니다. 174레벨 이상 헨치는 하위 믹스를 따라갑니다.</p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
                >
                  <RotateCcw className="h-4 w-4" />
                  초기화
                </button>
              </div>

              <div className="mb-5 rounded-xl border border-cyan-500/15 bg-slate-900/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">제작 수량</p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">{selectedMonster.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      aria-label="제작 수량 감소"
                      className="h-9 w-9 rounded-lg bg-slate-700 text-lg text-white hover:bg-slate-600"
                    >
                      −
                    </button>
                    <span data-testid="material-calculator-quantity" className="min-w-12 text-center text-xl font-bold text-cyan-300">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => value + 1)}
                      aria-label="제작 수량 증가"
                      className="h-9 w-9 rounded-lg bg-slate-700 text-lg text-white hover:bg-slate-600"
                    >
                      +
                    </button>
                    <span className="text-sm text-slate-400">마리</span>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-cyan-300">필요 재료 목록</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">재료를 체크하면 구한 재료로 처리되어 남은 수량에서 제외됩니다.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span
                    data-testid="material-calculator-required-total"
                    className="rounded-full border border-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-slate-300"
                  >
                    필요 총 {totalMaterials}마리
                  </span>
                  <span
                    data-testid="material-calculator-remaining-total"
                    className="rounded-full border border-orange-400/40 bg-orange-950/40 px-2.5 py-1 text-xs font-bold text-orange-200"
                  >
                    남은 {remainingCount}마리
                  </span>
                </div>
              </div>

              {sortedMaterials.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {sortedMaterials.map((material) => {
                      const materialMonster = monsters.find(
                        (monster) => compactName(monster.name.toLowerCase()) === compactName(material.name.toLowerCase()),
                      );
                      const detailRecipes = materialMonster ? getRecipeOptions(materialMonster) : [];
                      const isExpanded = expandedMaterial === material.name;
                      const acquiredStatus = materialMonster?.acquired === '0' ? '가능' : materialMonster?.acquired === 'x' ? '불가능' : '정보 없음';

                      return (
                        <div key={material.name} className="space-y-2">
                          <div
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                              material.isChecked
                                ? 'border-slate-700 bg-slate-700/40 text-slate-500'
                                : isExpanded
                                  ? 'border-cyan-400/70 bg-cyan-950/40 text-white'
                                  : 'border-slate-700/70 bg-slate-900/20 text-white hover:border-cyan-500/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              aria-label={`${material.name} 구한 재료 체크`}
                              checked={material.isChecked}
                              disabled={materialMonster?.acquired === 'x' && detailRecipes.length === 0}
                              title={materialMonster?.acquired === 'x' && detailRecipes.length === 0 ? '득코 불가능하며 하위 믹스가 없어 체크할 수 없습니다.' : undefined}
                              onChange={(event) => setMaterialChecked(material.name, event.currentTarget.checked)}
                              className="h-4 w-4 cursor-pointer accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                            <button
                              type="button"
                              onClick={() => setExpandedMaterial((current) => (current === material.name ? null : material.name))}
                              aria-expanded={isExpanded}
                              className={`min-w-0 flex-1 text-left font-semibold underline-offset-4 hover:underline ${material.isChecked ? 'line-through text-slate-500' : 'text-white'}`}
                            >
                              {material.name}
                            </button>
                            <div className="shrink-0 text-right">
                              {material.isChecked ? (
                                <>
                                  <span className="block text-xs font-medium text-slate-500 line-through">필요 {material.count}마리</span>
                                  <span className="mt-0.5 block text-sm font-extrabold text-emerald-300">구함 완료</span>
                                  <span className="block text-xs font-bold text-emerald-200">남은 0마리</span>
                                </>
                              ) : (
                                <>
                                  <span className="block text-sm font-extrabold text-cyan-300">{material.count}마리 필요</span>
                                  <span className="mt-0.5 block text-xs font-bold text-orange-200">남은 {material.count}마리</span>
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && materialMonster && (
                            <div className="rounded-xl border-2 border-cyan-500/40 bg-slate-950/90 p-4 shadow-lg">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-bold text-white">
                                  Lv.{materialMonster.baseLevel ?? '-'}{materialMonster.maxLevel ? `~${materialMonster.maxLevel}` : ''}
                                </span>
                                {resolveMonsterType(materialMonster) && <span className={monsterTypeBadgeClass(resolveMonsterType(materialMonster)!, 'sm')}>{resolveMonsterType(materialMonster)}</span>}
                                <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${acquiredStatus === '가능' ? 'border-green-400 bg-green-700 text-green-50' : acquiredStatus === '불가능' ? 'border-red-400 bg-red-700 text-red-50' : 'border-slate-500 bg-slate-700 text-slate-100'}`}>
                                  {acquiredStatus === '가능' ? '✓ 득코 가능' : acquiredStatus === '불가능' ? '✕ 득코 불가능' : '득코 정보 없음'}
                                </span>
                              </div>

                              <div className="mt-3 rounded-lg border border-cyan-500/30 bg-slate-900 p-3">
                                <p className="text-xs font-black text-cyan-300">서식지</p>
                                <p className="mt-1 break-words text-sm font-semibold leading-6 text-white">{materialMonster.habitat?.trim() || '정보 없음'}</p>
                              </div>

                              <div className="mt-3 rounded-lg border border-violet-500/30 bg-slate-900 p-3">
                                <p className="text-xs font-black text-violet-300">믹스법</p>
                                {detailRecipes.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {detailRecipes.map((recipe, index) => (
                                      <div key={`${materialMonster.id}-detail-${recipe.index}`} className="rounded-lg border border-violet-400/40 bg-violet-950/50 px-3 py-2.5 text-sm font-semibold text-white">
                                        <span className="mr-2 text-xs font-black text-violet-300">조합 {index + 1}</span>
                                        <span>{recipe.main}</span>
                                        <span className="mx-2 font-black text-cyan-300">+</span>
                                        <span>{recipe.sub}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm font-semibold text-slate-300">저장된 조합법이 없습니다.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/20 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">구한 재료</span>
                      <span data-testid="material-calculator-acquired-count" className="font-bold text-cyan-300">{acquiredCount}마리</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-400">남은 재료</span>
                      <span data-testid="material-calculator-remaining-count" className="font-bold text-orange-300">{remainingCount}마리</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center">
                  <Calculator className="mx-auto mb-3 h-9 w-9 text-slate-600" />
                  <p className="text-sm text-slate-400">표시할 재료가 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-600">조합법을 선택하거나 다른 헨치를 검색해 보세요.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
