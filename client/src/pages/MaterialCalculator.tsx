import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { attributeImages } from '@/data/attributeImages';
import { Calculator, Search } from 'lucide-react';
import { useMonsterData } from '@/hooks/useMonsterData';
import { calculateMaterialCounts } from '@/lib/materialCalculator';

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

export default function MaterialCalculator() {
  const monsters = useMonsterData() as Monster[];

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set());

  // 검색 결과
  const searchResults = useMemo(() => {
    if (!deferredSearchQuery.trim()) return [];
    const query = deferredSearchQuery.toLowerCase().replace(/\s/g, '');
    return monsters
      .filter(m => {
        const name = m.name.toLowerCase().replace(/\s/g, '');
        return name.includes(query);
      })
      .slice(0, 10);
  }, [deferredSearchQuery, monsters]);

  // 선택한 몬스터의 재료 계산
  const materials = useMemo(() => {
    if (!selectedMonster) return {};
    return calculateMaterialCounts(monsters, selectedMonster, quantity);
  }, [selectedMonster, quantity, monsters]);

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
    if (updated.has(name)) {
      updated.delete(name);
    } else {
      updated.add(name);
    }
    setCheckedMaterials(updated);
  };

  const remainingCount = useMemo(() => {
    let total = 0;
    sortedMaterials.forEach(m => {
      if (!m.isChecked) total += m.count;
    });
    return total;
  }, [sortedMaterials]);

  const handleReset = () => {
    setSearchQuery('');
    setSelectedMonster(null);
    setQuantity(1);
    setCheckedMaterials(new Set());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Calculator className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-cyan-300">재료 계산기</h1>
        </div>

        {/* 헨치 검색 */}
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

            {/* 검색 결과 드롭다운 */}
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedMonster && (
          <>
            {/* 선택된 헨치 정보 */}
            <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedMonster.imageUrl || attributeImages[selectedMonster.attribute as keyof typeof attributeImages] || attributeImages['악마']}
                    alt={selectedMonster.attribute}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-cyan-300">{selectedMonster.name}</h2>
                    <p className="text-sm text-slate-400">{selectedMonster.attribute}</p>
                  </div>
                </div>
              </div>

              {/* 수량 조절 */}
              <div className="flex items-center gap-4">
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

            {/* 재료 목록 */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyan-300">170~179 레벨 재료</h3>
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
                        <span className="font-bold">{material.count}개</span>
                      </div>
                    ))}
                  </div>

                  {/* 통계 */}
                  <div className="bg-slate-700/50 rounded p-3 border border-slate-600">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">구한 재료:</span>
                      <span className="text-cyan-300 font-bold">
                        {sortedMaterials.reduce((sum, m) => (m.isChecked ? sum + m.count : sum), 0)}개
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-300">남은 재료:</span>
                      <span className="text-orange-300 font-bold">{remainingCount}개</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-center py-4">170~179 레벨 재료가 없습니다</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
