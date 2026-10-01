import { useState, useMemo, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { attributeImages } from '@/data/attributeImages';
import { Calculator, Search, GitBranch } from 'lucide-react';
import { useMonsterData } from '@/hooks/useMonsterData';
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
  main?: string | null;
  sub?: string | null;
  main2?: string | null;
  sub2?: string | null;
  imageUrl?: string;
}

const compactName = (value: string) => value.replace(/\\s+/g, '');

export default function MaterialCalculator() {
  const monsters = useMonsterData() as Monster[];

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set());
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
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        isChecked: checkedMaterials.has(name),
      }));
  }, [materials, checkedMaterials]);

  const toggleMaterialCheck = (name: string) => {
    const updated = new Set(checkedMaterials);
    if (updated.has(name)) updated.delete(name);
    else updated.add(name);
    setCheckedMaterials(updated);
  };

  const setRecipeSelection = (monster: Monster, optionIndex: number) => {
    setRecipeSelections((current) => ({ ...current, [monster.id]: optionIndex }));
    setCheckedMaterials(new Set());
  };

  const remainingCount = useMemo(() => {
    return sortedMaterials.reduce((total, material) => (material.isChecked ? total : total + material.count), 0);
  }, [sortedMaterials]);

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
      <div key={monster.id} className={`rounded-lg border p-4 ${nested ? 'border-slate-600 bg-slate-900/30' : 'border-cyan-500/20 bg-slate-800/40'}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold text-cyan-300">{monster.name}</p>
            <p className="text-xs text-slate-500">조합법 {options.length}가지 · 계산에 사용할 조합을 선택하세요</p>
          </div>
        </div>

        <div className="space-y-2">
          {options.map((option, optionPosition) => (
            <label
              key={`${monster.id}-${option.index}`}
              className={`flex items-center gap-3 rounded-md border px-3 py-3 cursor-pointer transition-colors ${
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
              <span className="text-xs font-semibold text-slate-300">조합 {optionPosition + 1}</span>
              <span className="text-sm text-white">{option.main}</span>
              <span className="text-cyan-300 font-bold">+</span>
              <span className="text-sm text-white">{option.sub}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const rootRecipeOptions = selectedMonster ? getRecipeOptions(selectedMonster) : [];
  const compactRecipeText = rootRecipeOptions.length > 1
    ? `${rootRecipeOptions[0].main} / ${rootRecipeOptions[1].main} + ${rootRecipeOptions[0].sub} / ${rootRecipeOptions[1].sub}`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Calculator className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-3xl font-bold text-cyan-300">재료 계산기</h1>
            <p className="text-xs text-slate-500 mt-1">140~169레벨 최종 재료만 계산합니다.</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-cyan-500/20">
          <div className="relative">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="헨치 이름 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-cyan-500/30 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {searchResults.map((monster) => (
                  <button
                    key={monster.id}
                    onClick={() => {
                      setSelectedMonster(monster);
                      setShowDropdown(false);
                      setSearchQuery('');
                      setCheckedMaterials(new Set());
                      setRecipeSelections({});
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 border-b border-slate-700/50 last:border-b-0"
                  >
                    <img
                      src={monster.imageUrl || attributeImages[monster.attribute as keyof typeof attributeImages] || attributeImages['악마']}
                      alt={monster.attribute}
                      loading="lazy"
                      decoding="async"
                      className="w-6 h-6 rounded"
                    />
                    <span className="text-white">{monster.name}</span>
                    <span className="ml-auto text-xs text-slate-500">Lv.{monster.baseLevel ?? '-'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedMonster && (
          <>
            <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-cyan-500/20">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedMonster.imageUrl || attributeImages[selectedMonster.attribute as keyof typeof attributeImages] || attributeImages['악마']}
                    alt={selectedMonster.attribute}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded"
                  />
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-cyan-300 truncate">{selectedMonster.name}</h2>
                    <p className="text-sm text-slate-400">{selectedMonster.attribute} · Lv.{selectedMonster.baseLevel ?? '-'}</p>
                  </div>
                </div>
              </div>

              {rootRecipeOptions.length > 1 && (
                <div className="mt-4 rounded-lg border border-cyan-500/20 bg-slate-900/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-slate-300">전체 조합법</span>
                  </div>
                  <p className="text-xs leading-6 text-slate-300 break-words">{compactRecipeText}</p>
                  <div className="mt-3">
                    {renderRecipeChoice(selectedMonster)}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mt-5">
                <span className="text-slate-300">제작 수량:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="제작 수량 감소"
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-white font-bold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="제작 수량 증가"
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {recipeChoices.filter((monster) => monster.id !== selectedMonster.id).length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <div>
                    <h3 className="text-lg font-bold text-cyan-300">하위 헨치 조합 선택</h3>
                    <p className="text-xs text-slate-500 mt-1">재료 트리 안에 여러 조합법이 있는 헨치도 여기서 선택하면 계산에 반영됩니다.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {recipeChoices
                    .filter((monster) => monster.id !== selectedMonster.id)
                    .map((monster) => renderRecipeChoice(monster as Monster, true))}
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 rounded-lg p-6 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyan-300">140~169 레벨 재료</h3>
                <button
                  onClick={handleReset}
                  className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
                >
                  초기화
                </button>
              </div>

              {sortedMaterials.length > 0 ? (
                <>
                  <div className="space-y-2 mb-4">
                    {sortedMaterials.map((material) => (
                      <div
                        key={material.name}
                        className={`flex items-center gap-3 p-3 rounded border ${
                          material.isChecked
                            ? 'bg-slate-700/50 border-slate-600 line-through text-slate-500'
                            : 'bg-slate-700/30 border-slate-600/50 text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={material.isChecked}
                          onChange={() => toggleMaterialCheck(material.name)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="flex-1">{material.name}</span>
                        <span className="font-bold">{material.count}마리</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-700/50 rounded p-3 border border-slate-600">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">구한 재료:</span>
                      <span className="text-cyan-300 font-bold">
                        {sortedMaterials.reduce((sum, m) => (m.isChecked ? sum + m.count : sum), 0)}마리
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-300">남은 재료:</span>
                      <span className="text-orange-300 font-bold">{remainingCount}마리</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-center py-4">140~169 레벨 재료가 없습니다</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
