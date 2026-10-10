import { useState, useMemo, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { attributeImages } from '@/data/attributeImages';
import { Calculator, Search, GitBranch, RotateCcw } from 'lucide-react';
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

export default function MaterialCalculator() {
  const monsters = useMonsterData() as Monster[];

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set());
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);
  const [recipeSelections, setRecipeSelections] = useState<RecipeSelections>({});

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

  const toggleMaterialCheck = (name: string) => {
    const updated = new Set(checkedMaterials);
    if (updated.has(name)) updated.delete(name);
    else updated.add(name);
    setCheckedMaterials(updated);
  };

  const setRecipeSelection = (monster: Monster, optionIndex: number) => {
    setRecipeSelections((current) => ({ ...current, [monster.id]: optionIndex }));
    setCheckedMaterials(new Set());
    setExpandedMaterial(null);
  };

  const selectMonster = (monster: Monster) => {
    setSelectedMonster(monster);
    setShowDropdown(false);
    setSearchQuery('');
    setCheckedMaterials(new Set());
    setExpandedMaterial(null);
    setRecipeSelections({});
  };

  const handleReset = () => {
    setSearchQuery('');
    setSelectedMonster(null);
    setQuantity(1);
    setCheckedMaterials(new Set());
    setRecipeSelections({});
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
            <p className="mt-1 text-xs text-slate-500">140~169레벨의 최종 재료만 집계합니다.</p>
          </div>
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
            <p className="mt-1 text-sm text-slate-500">선택한 헨치의 믹스법을 고르고 필요한 140~169레벨 재료를 확인할 수 있습니다.</p>
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
                  <p className="mt-1 text-xs text-slate-500">만들 마리수를 기준으로 실제 필요한 재료를 계산합니다.</p>
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
                    <span className="min-w-12 text-center text-xl font-bold text-cyan-300">{quantity}</span>
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

              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-cyan-300">140~169 레벨 재료</h3>
                <span className="rounded-full border border-cyan-500/20 px-2.5 py-1 text-xs text-slate-400">
                  총 {totalMaterials}마리
                </span>
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
                              checked={material.isChecked}
                              onChange={() => toggleMaterialCheck(material.name)}
                              className="h-4 w-4 cursor-pointer accent-cyan-400"
                            />
                            <button
                              type="button"
                              onClick={() => setExpandedMaterial((current) => (current === material.name ? null : material.name))}
                              aria-expanded={isExpanded}
                              className={`min-w-0 flex-1 text-left font-semibold underline-offset-4 hover:underline ${material.isChecked ? 'line-through text-slate-500' : 'text-white'}`}
                            >
                              {material.name}
                            </button>
                            <span className={`font-bold ${material.isChecked ? 'text-slate-500' : 'text-cyan-300'}`}>
                              {material.count}마리
                            </span>
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
                      <span className="font-bold text-cyan-300">{acquiredCount}마리</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-400">남은 재료</span>
                      <span className="font-bold text-orange-300">{remainingCount}마리</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center">
                  <Calculator className="mx-auto mb-3 h-9 w-9 text-slate-600" />
                  <p className="text-sm text-slate-400">140~169 레벨 재료가 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-600">왼쪽에서 조합법을 선택하거나 다른 헨치를 검색해 보세요.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
