import { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { MonsterCard } from '@/components/MonsterCard';
import { AttributeFilter } from '@/components/AttributeFilter';
import { MonsterDetailModal } from '@/components/MonsterDetailModal';
import { Monster, AttributeType } from '@/types/monster';
import { Search, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { attributeImages } from '@/data/attributeImages';
import { useMonsterData } from '@/hooks/useMonsterData';
import { hasHabitat, splitHabitats } from '@/lib/habitats';

const ATTRIBUTES: AttributeType[] = ['악마', '짐승', '새', '드래곤', '식물', '메탈', '곤충', '미스터리'];
const PAGE_SIZE = 60;

export default function HenchList() {
  const monsters = useMonsterData();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedAttributes, setSelectedAttributes] = useState<Set<AttributeType>>(new Set(ATTRIBUTES));
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [minLevel, setMinLevel] = useState(0);
  const [maxLevel, setMaxLevel] = useState(999);
  const [acquiredOnly, setAcquiredOnly] = useState(false);
  const [selectedHabitat, setSelectedHabitat] = useState('__all__');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 로컬 스토리지에서 즐겨찾기 로드
  useEffect(() => {
    const saved = localStorage.getItem('favoriteMonsters');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  const toggleFavorite = useCallback((monsterId: string) => {
    setFavorites((prev) => {
      let updated: string[];
      if (prev.includes(monsterId)) {
        updated = prev.filter((id) => id !== monsterId);
      } else {
        updated = [...prev, monsterId];
      }
      localStorage.setItem('favoriteMonsters', JSON.stringify(updated));
      return updated;
    });
  }, []);


  // 속성별 개수 계산
  const attributeCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(ATTRIBUTES.map((attr) => [attr, 0]));
    monsters.forEach((monster) => {
      if (monster.attribute in counts) counts[monster.attribute] += 1;
    });
    return counts;
  }, [monsters]);

  const habitatOptions = useMemo(() => {
    const counts = new Map<string, number>();

    monsters.forEach((monster) => {
      splitHabitats(monster.habitat).forEach((habitat) => {
        counts.set(habitat, (counts.get(habitat) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [monsters]);

  const searchableMonsters = useMemo(() => monsters.map((monster) => {
    const name = monster.name.toLowerCase();
    const habitat = monster.habitat?.toLowerCase() || '';
    const main = monster.main?.toLowerCase() || '';
    const sub = monster.sub?.toLowerCase() || '';
    return {
      monster,
      name,
      nameNoSpace: name.replace(/\s+/g, ''),
      habitat,
      habitatNoSpace: habitat.replace(/\s+/g, ''),
      main,
      mainNoSpace: main.replace(/\s+/g, ''),
      sub,
      subNoSpace: sub.replace(/\s+/g, ''),
    };
  }), [monsters]);

  // 헨치 몬스터 필터링 (검색 인덱스는 몬스터 데이터가 바뀔 때만 재생성)
  const henchMonsters = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase();
    const queryNoSpace = query.replace(/\s+/g, '');

    return searchableMonsters
      .filter(({ monster, name, nameNoSpace, habitat, habitatNoSpace, main, mainNoSpace, sub, subNoSpace }) => {
        const matchesSearch =
          name.includes(query) ||
          nameNoSpace.includes(queryNoSpace) ||
          habitat.includes(query) ||
          habitatNoSpace.includes(queryNoSpace) ||
          main.includes(query) ||
          mainNoSpace.includes(queryNoSpace) ||
          sub.includes(query) ||
          subNoSpace.includes(queryNoSpace);

        const matchesAttribute = selectedAttributes.has(monster.attribute as AttributeType);
        const matchesLevelRange = monster.baseLevel >= minLevel && monster.maxLevel <= maxLevel;
        const matchesAcquired = !acquiredOnly || monster.acquired === '0';
        const matchesHabitat = hasHabitat(monster.habitat, selectedHabitat);

        return matchesSearch && matchesAttribute && matchesLevelRange && matchesAcquired && matchesHabitat;
      })
      .map(({ monster }) => monster)
      .sort((a, b) => a.baseLevel - b.baseLevel);
  }, [searchableMonsters, deferredSearchQuery, selectedAttributes, minLevel, maxLevel, acquiredOnly, selectedHabitat]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearchQuery, selectedAttributes, minLevel, maxLevel, acquiredOnly, selectedHabitat]);

  const visibleHenchMonsters = useMemo(
    () => henchMonsters.slice(0, visibleCount),
    [henchMonsters, visibleCount],
  );

  const handleAttributeToggle = useCallback((attribute: AttributeType) => {
    setSelectedAttributes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(attribute)) {
        newSet.delete(attribute);
      } else {
        newSet.add(attribute);
      }
      return newSet;
    });
  }, []);

  const handleAttributeToggleWithClose = useCallback((attribute: AttributeType) => {
    handleAttributeToggle(attribute);
    setShowMobileFilter(false);
  }, [handleAttributeToggle]);

  const handleMonsterClick = useCallback((monster: Monster) => {
    setSelectedMonster(monster);
    setIsModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <h1 className="text-lg sm:text-2xl font-bold text-cyan-300 mb-1 sm:mb-2">헨치목록</h1>
          <p className="text-xs sm:text-sm text-slate-400">강력한 헨치 몬스터들을 확인하세요.</p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col md:flex-row">
        {/* 좌측 필터 - 데스크톱 */}
        <div className="hidden md:block">
          <AttributeFilter
            selectedAttributes={selectedAttributes}
            onAttributeToggle={handleAttributeToggle}
            counts={attributeCounts}
          />
        </div>

        {/* 우측 콘텐츠 */}
        <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-7xl mx-auto">
            {/* 모바일 필터 버튼 */}
            <div className="md:hidden mb-6">
              <button
                onClick={() => setShowMobileFilter(!showMobileFilter)}
                className="w-full py-2 px-4 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 text-sm font-semibold transition-colors"
              >
                {showMobileFilter ? '필터 닫기' : '필터 열기'}
              </button>
            </div>

            {/* 모바일 필터 패널 */}
            {showMobileFilter && (
              <div className="md:hidden mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <AttributeFilter
                  selectedAttributes={selectedAttributes}
                  onAttributeToggle={handleAttributeToggleWithClose}
                  counts={attributeCounts}
                />
              </div>
            )}

            {/* 검색 및 필터 영역 */}
            <div className="mb-6 sm:mb-8 space-y-4">
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="몬스터 이름, 서식지, 재료 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-800/50 border-slate-700 text-sm"
                />
              </div>
              
              {/* 레벨 범위 필터 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs sm:text-sm font-semibold text-cyan-300 block mb-2">최소 레벨</label>
                  <Input
                    type="number"
                    min="0"
                    max="999"
                    value={minLevel}
                    onChange={(e) => setMinLevel(Number(e.target.value))}
                    className="bg-slate-800/50 border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-semibold text-cyan-300 block mb-2">최대 레벨</label>
                  <Input
                    type="number"
                    min="0"
                    max="999"
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(Number(e.target.value))}
                    className="bg-slate-800/50 border-slate-700 text-sm"
                  />
                </div>
              </div>

              {/* 서식지별 탐색 */}
              <section aria-labelledby="habitat-filter-heading" className="rounded-xl border border-cyan-500/15 bg-slate-900/50 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 id="habitat-filter-heading" className="text-sm font-bold text-cyan-200">서식지별 헨치 목록</h2>
                    <p className="mt-0.5 text-xs text-slate-400">서식지를 선택하면 해당 지역의 헨치만 바로 확인할 수 있습니다.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                    {henchMonsters.length}마리
                  </span>
                </div>
                <label htmlFor="habitat-filter" className="sr-only">서식지 선택</label>
                <select
                  id="habitat-filter"
                  aria-label="서식지 선택"
                  value={selectedHabitat}
                  onChange={(event) => setSelectedHabitat(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                >
                  <option value="__all__">전체 서식지 ({monsters.length}마리)</option>
                  {habitatOptions.map((habitat) => (
                    <option key={habitat.name} value={habitat.name}>
                      {habitat.name} ({habitat.count}마리)
                    </option>
                  ))}
                </select>
              </section>
              
              {/* 획득 여부 필터 및 초기화 버튼 */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="acquiredOnly"
                    checked={acquiredOnly}
                    onChange={(e) => setAcquiredOnly(e.target.checked)}
                    className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                  />
                  <label htmlFor="acquiredOnly" className="text-xs sm:text-sm font-semibold text-cyan-300 cursor-pointer">
                    득코 가능만 보기
                  </label>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setMinLevel(0);
                    setMaxLevel(999);
                    setAcquiredOnly(false);
                    setSelectedHabitat('__all__');
                    setSelectedAttributes(new Set(ATTRIBUTES));
                  }}
                  className="text-xs sm:text-sm px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-200 transition-colors font-semibold"
                >
                  필터 초기화
                </button>
              </div>
            </div>

            {/* 헨치 목록 - 그리드 뷰 */}
            {henchMonsters.length > 0 ? (
              <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-3">
                {visibleHenchMonsters.map((monster) => (
                  <div
                    key={monster.id}
                    className="abyss-dim-card group relative overflow-hidden rounded-lg border-2 transition-all duration-200 hover:border-cyan-200/70 hover:shadow-lg hover:shadow-cyan-500/20 [content-visibility:auto] [contain-intrinsic-size:20rem]"
                  >
                    {/* 이미지 */}
                    <div
                      onClick={() => handleMonsterClick(monster)}
                      className="abyss-dim-card-media relative h-24 overflow-hidden cursor-pointer transition-colors sm:h-32"
                    >
                      {/* 즐겨찾기 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(monster.id);
                        }}
                        className="absolute top-1 right-1 sm:top-2 sm:right-2 z-10 p-1 sm:p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 transition-colors"
                        title="즐겨찾기"
                      >
                        <Heart
                          className={cn(
                            'h-3 w-3 sm:h-4 sm:w-4 transition-colors',
                            favorites.includes(monster.id)
                              ? 'fill-red-400 text-red-400'
                              : 'text-slate-400 hover:text-red-400'
                          )}
                        />
                      </button>

                      <img
                        src={monster.imageUrl || attributeImages[monster.attribute]}
                        alt={monster.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* 정보 */}
                    <div className="p-2 sm:p-3 space-y-1 sm:space-y-2">
                      <div>
                        <p className="font-semibold text-slate-200 text-xs sm:text-sm truncate">{monster.name}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-cyan-400 font-bold">{monster.attribute}</p>
                          {monster.type && <span className={`rounded px-1 py-px text-[10px] font-bold ${monster.type === '장코' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'}`}>{monster.type}</span>}
                        </div>
                      </div>

                      {/* 레벨 정보 */}
                      <div data-testid={`hench-status-${monster.id}`} className="text-xs text-slate-400 space-y-0.5">
                        <p>Lv. {monster.baseLevel} ~ {monster.maxLevel}</p>
                        {monster.acquired === '0' && (
                          <p className="abyss-acquired-label px-2 py-1 text-xs text-green-400 font-semibold">득코 가능</p>
                        )}
                        {monster.acquired !== '0' && (
                          <p className="abyss-unacquired-label px-2 py-1 text-xs text-red-400 font-semibold">득코 불가능</p>
                        )}
                        {Number(monster.xAntibody) > 0 && (
                          <p data-testid={`hench-x-antibody-${monster.id}`} className="abyss-x-data-badge px-2 py-1 text-xs">X데이터 {monster.xAntibody}개 필요</p>
                        )}
                        {monster.habitat && <p className="truncate">{monster.habitat}</p>}
                      </div>

                      {/* 클릭 유도 */}
                      <button
                        onClick={() => handleMonsterClick(monster)}
                        className="w-full mt-1 sm:mt-2 py-1 sm:py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition-colors"
                      >
                        상세정보
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {visibleCount < henchMonsters.length && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                    className="rounded-lg bg-cyan-500/20 px-5 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/40"
                  >
                    더 보기 ({visibleHenchMonsters.length}/{henchMonsters.length})
                  </button>
                </div>
              )}
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/30">
                <div className="text-center">
                  <p className="text-slate-400">검색 결과가 없습니다.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 상세 정보 모달 */}
      <MonsterDetailModal
        monster={selectedMonster}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectMonster={(monster) => {
          setSelectedMonster(monster);
          setIsModalOpen(true);
        }}
        allMonsters={monsters}
      />
    </div>
  );
}
