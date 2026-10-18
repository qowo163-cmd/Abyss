import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MonsterCard } from '@/components/MonsterCard';
import { AttributeFilter } from '@/components/AttributeFilter';
import { MonsterDetailModal } from '@/components/MonsterDetailModal';
import { Monster, AttributeType } from '@/types/monster';
import { useMonsterData } from '@/hooks/useMonsterData';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const ATTRIBUTES: AttributeType[] = ['악마', '짐승', '새', '드래곤', '식물', '메탈', '곤충', '미스터리'];

export default function MonsterDex() {
  const monsters = useMonsterData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttributes, setSelectedAttributes] = useState<Set<AttributeType>>(new Set(ATTRIBUTES));
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        <div className="px-6 py-4">
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold text-cyan-300">몬스터 도감</h1>

            {/* 검색 바 */}
            <div className="max-w-md">
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
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex gap-6 px-6 py-6">
        {/* 사이드바 - 필터 */}
        <aside className="w-64 rounded-lg border border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4 h-fit sticky top-24">
          <AttributeFilter
            selectedAttributes={selectedAttributes}
            onAttributeToggle={handleAttributeToggle}
            counts={attributeCounts}
          />
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1">
          {/* 결과 정보 */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-cyan-300">
              전체 몬스터
              <span className="ml-2 text-base text-slate-400">
                {filteredMonsters.length} / {monsters.length}
              </span>
            </h2>
          </div>

          {/* 몬스터 그리드 */}
          {filteredMonsters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {/* 상세 정보 모달 */}
      <MonsterDetailModal
        monster={selectedMonster}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
