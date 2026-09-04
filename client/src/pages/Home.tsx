import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MonsterCard } from '@/components/MonsterCard';
import { AttributeFilter } from '@/components/AttributeFilter';
import { MonsterDetailModal } from '@/components/MonsterDetailModal';
import { Monster, AttributeType } from '@/types/monster';
import { useMonsterData } from '@/hooks/useMonsterData';
import { Search, Grid3x3, List, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

const ATTRIBUTES: AttributeType[] = ['악마', '짐승', '새', '드래곤', '식물', '메탈', '곤충', '미스터리'];

export default function Home() {
  const monsters = useMonsterData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttributes, setSelectedAttributes] = useState<Set<AttributeType>>(new Set(ATTRIBUTES));
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 속성별 개수 계산
  const attributeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ATTRIBUTES.forEach((attr) => {
      counts[attr] = monsters.filter((m) => m.attribute === attr).length;
    });
    return counts;
  }, [monsters]);

  // 필터링된 몬스터 목록
  const filteredMonsters = useMemo(() => {
    return monsters.filter((monster) => {
      const matchesSearch =
        monster.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        monster.habitat?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        monster.main?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        monster.sub?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAttribute = selectedAttributes.has(monster.attribute as AttributeType);

      return matchesSearch && matchesAttribute;
    });
  }, [monsters, searchQuery, selectedAttributes]);

  const handleAttributeToggle = (attribute: AttributeType) => {
    const newSet = new Set(selectedAttributes);
    if (newSet.has(attribute)) {
      newSet.delete(attribute);
    } else {
      newSet.add(attribute);
    }
    setSelectedAttributes(newSet);
  };

  const handleMonsterClick = (monster: Monster) => {
    setSelectedMonster(monster);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* 로고 */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-cyan-300">ABYSS서버 믹스사이트</h1>
                <p className="text-xs text-slate-400">몬스터 데이터베이스</p>
              </div>
            </div>

            {/* 검색 바 */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="몬스터 이름, 서식지, 재료 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* 뷰 모드 토글 */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                onClick={() => setViewMode('grid')}
                className="gap-2"
              >
                <Grid3x3 className="h-4 w-4" />
                <span className="hidden sm:inline">그리드</span>
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">리스트</span>
              </Button>
            </div>

            {/* 모바일 사이드바 토글 */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden"
            >
              필터
            </Button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-5">
          {/* 사이드바 - 필터 */}
          <aside
            className={cn(
              'rounded-lg border border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4 h-fit sticky top-20',
              'md:block',
              !isSidebarOpen && 'hidden'
            )}
          >
            <AttributeFilter
              selectedAttributes={selectedAttributes}
              onAttributeToggle={handleAttributeToggle}
              counts={attributeCounts}
            />
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="md:col-span-3 lg:col-span-4">
            {/* 결과 정보 */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-cyan-300">
                  전체 몬스터
                  <span className="ml-2 text-base text-slate-400">
                    {filteredMonsters.length} / {monsters.length}
                  </span>
                </h2>
              </div>
            </div>

            {/* 몬스터 목록 */}
            {filteredMonsters.length > 0 ? (
              <div
                className={cn(
                  'gap-4',
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'flex flex-col'
                )}
              >
                {filteredMonsters.map((monster) => (
                  <MonsterCard
                    key={monster.id}
                    monster={monster}
                    onClick={() => handleMonsterClick(monster)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/30">
                <div className="text-center">
                  <Search className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                  <p className="text-slate-400">검색 결과가 없습니다.</p>
                  <p className="text-sm text-slate-500">다른 검색어나 필터를 시도해보세요.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 상세 정보 모달 */}
      <MonsterDetailModal
        monster={selectedMonster}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* 모바일 오버레이 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
