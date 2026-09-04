import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { MonsterDetailModal } from '@/components/MonsterDetailModal';
import { Monster, AttributeType } from '@/types/monster';
import { Search, Heart, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { attributeImages } from '@/data/attributeImages';
import { useMonsterData } from '@/hooks/useMonsterData';

const ATTRIBUTES: AttributeType[] = ['악마', '짐승', '새', '드래곤', '식물', '메탈', '곤충', '미스터리'];
const MOBILE_PAGE_SIZE = 24;
const ATTRIBUTE_COLORS: Record<string, string> = {
  '악마': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  '짐승': 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  '새': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  '드래곤': 'bg-red-500/20 text-red-300 border-red-500/50',
  '식물': 'bg-green-500/20 text-green-300 border-green-500/50',
  '메탈': 'bg-slate-500/20 text-slate-300 border-slate-500/50',
  '곤충': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
  '미스터리': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
};

export default function MobileHenchList() {
  const monsters = useMonsterData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttributes, setSelectedAttributes] = useState<Set<AttributeType>>(new Set(ATTRIBUTES));
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const deferredSearchQuery = useDeferredValue(searchQuery);


  // 로컬 스토리지에서 즐겨찾기 로드
  useEffect(() => {
    const saved = localStorage.getItem('favoriteMonsters');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  const toggleFavorite = (monsterId: string) => {
    setFavorites((current) => {
      const updated = current.includes(monsterId) ? current.filter((id) => id !== monsterId) : [...current, monsterId];
      localStorage.setItem('favoriteMonsters', JSON.stringify(updated));
      return updated;
    });
  };

  // 헨치 몬스터 필터링
  const henchMonsters = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase();
    const queryNoSpace = query.replace(/\s+/g, '');
    
    return monsters
      .filter((m) => {
        const nameNoSpace = m.name.toLowerCase().replace(/\s+/g, '');
        const habitatNoSpace = m.habitat?.toLowerCase().replace(/\s+/g, '') || '';
        const mainNoSpace = m.main?.toLowerCase().replace(/\s+/g, '') || '';
        const subNoSpace = m.sub?.toLowerCase().replace(/\s+/g, '') || '';
        
        const matchesSearch =
          m.name.toLowerCase().includes(query) ||
          nameNoSpace.includes(queryNoSpace) ||
          m.habitat?.toLowerCase().includes(query) ||
          habitatNoSpace.includes(queryNoSpace) ||
          m.main?.toLowerCase().includes(query) ||
          mainNoSpace.includes(queryNoSpace) ||
          m.sub?.toLowerCase().includes(query) ||
          subNoSpace.includes(queryNoSpace);

        const matchesAttribute = selectedAttributes.has(m.attribute as AttributeType);
        return matchesSearch && matchesAttribute;
      })
      .sort((a, b) => a.baseLevel - b.baseLevel);
  }, [monsters, deferredSearchQuery, selectedAttributes]);

  const visibleMonsters = useMemo(() => henchMonsters.slice(0, visibleCount), [henchMonsters, visibleCount]);
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  useEffect(() => {
    setVisibleCount(MOBILE_PAGE_SIZE);
  }, [deferredSearchQuery, selectedAttributes]);

  const handleMonsterClick = (monster: Monster) => {
    setSelectedMonster(monster);
    setIsModalOpen(true);
  };

  const toggleAttribute = (attr: AttributeType) => {
    const updated = new Set(selectedAttributes);
    if (updated.has(attr)) {
      updated.delete(attr);
    } else {
      updated.add(attr);
    }
    setSelectedAttributes(updated);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-cyan-300 mb-3">헨치목록</h1>
          
          {/* 검색 */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="몬스터 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-800/50 border-slate-700 text-sm"
            />
          </div>

          {/* 필터 토글 */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className="flex min-h-10 touch-manipulation items-center gap-2 rounded-lg px-2 text-xs font-semibold text-cyan-300 transition-colors active:scale-[0.98] hover:text-cyan-200"
          >
            <Filter className="h-4 w-4" />
            속성 필터
          </button>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <div className="px-4 pb-3 border-t border-slate-700 space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {ATTRIBUTES.map((attr) => (
                <button
                  key={attr}
                  type="button"
                  onClick={() => toggleAttribute(attr)}
                  className={cn(
                    'text-xs font-semibold py-1 px-2 rounded-lg border transition-all',
                    selectedAttributes.has(attr)
                      ? ATTRIBUTE_COLORS[attr]
                      : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                  )}
                >
                  {attr}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* 몬스터 리스트 */}
      <main className="px-3 py-4 space-y-2">
        {henchMonsters.length > 0 ? (
          <>
          <p className="px-1 text-xs text-slate-400"><span className="font-semibold text-cyan-200">{henchMonsters.length}</span>마리 중 {visibleMonsters.length}마리 표시</p>
          {visibleMonsters.map((monster) => (
            <div
              key={monster.id}
              className="[content-visibility:auto] [contain-intrinsic-size:104px] overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 transition-colors hover:bg-slate-800/70"
            >
              <div className="flex gap-3 p-3">
                {/* 이미지 */}
                <button type="button" aria-label={`${monster.name} 상세정보`} onClick={() => handleMonsterClick(monster)} className="h-16 w-16 flex-shrink-0 touch-manipulation rounded-lg active:scale-[0.97]"><img src={monster.imageUrl || attributeImages[monster.attribute]} alt="" loading="lazy" decoding="async" draggable={false} className="h-16 w-16 rounded-lg object-cover" /></button>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-semibold text-slate-200 text-sm truncate">{monster.name}</p>
                      <p className="text-xs text-cyan-400 font-bold">{monster.attribute}</p>
                    </div>
                    <button
                      onClick={() => toggleFavorite(monster.id)}
                      className={`flex-shrink-0 transition-colors ${
                        favoriteIds.has(monster.id)
                          ? 'text-red-400'
                          : 'text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      <Heart className="h-4 w-4" fill={favoriteIds.has(monster.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="text-xs text-slate-400 space-y-0.5 mb-2">
                    <p>Lv. {monster.baseLevel} ~ {monster.maxLevel}</p>
                    {monster.acquired === '0' && (
                      <p className="abyss-acquired-label px-2 py-1 text-xs text-green-400 font-semibold">득코 가능</p>
                    )}
                    {monster.acquired !== '0' && (
                      <p className="abyss-unacquired-label px-2 py-1 text-xs text-red-400 font-semibold">득코 불가능</p>
                    )}
                    {Number(monster.xAntibody) > 0 && (
                      <p className="abyss-x-data-badge px-2 py-1 text-xs">X데이터 {monster.xAntibody}개 필요</p>
                    )}
                    {monster.habitat && <p className="truncate">{monster.habitat}</p>}
                  </div>

                  <button
                    onClick={() => handleMonsterClick(monster)}
                    className="min-h-9 w-full touch-manipulation rounded-lg bg-cyan-500/20 py-1 text-xs font-semibold text-cyan-300 transition-colors active:scale-[0.98] hover:bg-cyan-500/40 hover:text-cyan-200"
                  >
                    상세정보
                  </button>
                </div>
              </div>
            </div>
          ))}
          {visibleCount < henchMonsters.length && <button type="button" onClick={() => setVisibleCount((count) => count + MOBILE_PAGE_SIZE)} className="min-h-11 w-full touch-manipulation rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-200 transition-colors active:scale-[0.98] hover:bg-cyan-500/20">헨치 더 보기 ({henchMonsters.length - visibleCount}마리)</button>}
          </>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/30">
            <p className="text-sm text-slate-400">검색 결과가 없습니다.</p>
          </div>
        )}
      </main>

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
