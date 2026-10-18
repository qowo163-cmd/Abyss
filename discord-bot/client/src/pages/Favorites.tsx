import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Monster } from '@/types/monster';
import { attributeImages, attributeColors } from '@/data/attributeImages';
import { MonsterDetailModal } from '@/components/MonsterDetailModal';
import { Heart, Search, GitBranch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useMonsterData } from '@/hooks/useMonsterData';


export default function Favorites() {
  const monsters = useMonsterData();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isTransitioning, setIsTransitioning] = useState(false);


  // 로컬 스토리지에서 즐겨찾기 로드
  useEffect(() => {
    const saved = localStorage.getItem('favoriteMonsters');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  // 즐겨찾기 몬스터 필터링 (useMemo로 최적화)
  const favoriteMonsters = useMemo(() => {
    const favoriteIds = new Set(favorites);
    const query = deferredSearchQuery.toLowerCase();
    return monsters
      .filter((monster) => favoriteIds.has(monster.id) && monster.name.toLowerCase().includes(query))
      .sort((a, b) => b.maxLevel - a.maxLevel);
  }, [monsters, favorites, deferredSearchQuery]);

  const handleMonsterClick = (monster: Monster) => {
    setSelectedMonster(monster);
    setIsModalOpen(true);
  };

  const handleRemoveFavorite = (monsterId: string) => {
    const updated = favorites.filter((id) => id !== monsterId);
    setFavorites(updated);
    localStorage.setItem('favoriteMonsters', JSON.stringify(updated));
  };

  const handleViewMixTree = (monster: Monster) => {
    // 애니메이션 시작
    setIsTransitioning(true);
    
    // 몬스터 정보 저장
    localStorage.setItem('selectedMixTreeMonster', JSON.stringify(monster));
    
    // 애니메이션 완료 후 단계로 내비게이트
    setTimeout(() => {
      // 라우팅 수행
      window.location.href = '/tree';
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 transition-opacity duration-300",
      isTransitioning && "opacity-50"
    )}>
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-4">
            <Heart className="h-5 sm:h-6 w-5 sm:w-6 text-red-400 fill-red-400" />
            <h1 className="text-lg sm:text-2xl font-bold text-cyan-300">즐겨찾기</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">자주 찾는 헨치들을 한곳에서 관리하세요.</p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* 검색 영역 */}
          <div className="mb-6 sm:mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="즐겨찾기한 헨치 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800/50 border-slate-700"
              />
            </div>
          </div>

          {/* 즐겨찾기 목록 */}
          {favoriteMonsters.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-3">
              {favoriteMonsters.map((monster) => {
                const colors = attributeColors[monster.attribute] || attributeColors['악마'];
                const image = monster.imageUrl || attributeImages[monster.attribute];

                return (
                  <div
                    key={monster.id}
                    className="group relative rounded-lg border-2 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden hover:border-cyan-400/50 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/20"
                  >
                    {/* 이미지 */}
                    <div
                      onClick={() => handleMonsterClick(monster)}
                      className="relative h-24 sm:h-32 bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden cursor-pointer group-hover:from-slate-600 group-hover:to-slate-700 transition-colors"
                    >
                      <img
                        src={image}
                        alt={monster.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* 정보 */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-200 text-sm truncate">{monster.name}</p>
                          <p className={cn('text-xs font-bold', colors.text)}>{monster.attribute}</p>
                        </div>

                        {/* 즐겨찾기 제거 버튼 */}
                        <button
                          onClick={() => handleRemoveFavorite(monster.id)}
                          className="flex-shrink-0 p-1 sm:p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors"
                          title="즐겨찾기 제거"
                        >
                          <Heart className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
                        </button>
                      </div>

                      {/* 레벨 정보 */}
                      <div className="text-xs text-slate-400 space-y-0.5">
                        <p>Lv. {monster.baseLevel} ~ {monster.maxLevel}</p>
                        {Number(monster.xAntibody) > 0 && (
                          <p className="abyss-x-data-badge px-2 py-1 text-xs">X데이터 {monster.xAntibody}개 필요</p>
                        )}
                        {monster.habitat && <p className="truncate">{monster.habitat}</p>}
                      </div>

                      {/* 버튼 그룹 */}
                      <div className="flex gap-1 mt-1 sm:mt-2">
                        <button
                          onClick={() => handleMonsterClick(monster)}
                          className="flex-1 py-1 sm:py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition-colors"
                        >
                          상세정보
                        </button>
                        <button
                          onClick={() => handleViewMixTree(monster)}
                          className="flex-1 py-1 sm:py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 hover:text-purple-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                          title="믹스법 보기"
                        >
                          <GitBranch className="h-3 w-3" />
                          <span className="hidden sm:inline">믹스</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/30">
              <div className="text-center">
                <Heart className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 mb-2">즐겨찾기한 헨치가 없습니다.</p>
                <p className="text-sm text-slate-500">헨치목록에서 하트 버튼을 눌러 즐겨찾기를 추가하세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 정보 모달 */}
      <MonsterDetailModal
        monster={selectedMonster}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMonster(null);
        }}
        onSelectMonster={(monster) => {
          setSelectedMonster(monster);
          setIsModalOpen(true);
        }}
        allMonsters={monsters}
      />
    </div>
  );
}
