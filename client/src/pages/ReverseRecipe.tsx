import { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronDown, X } from 'lucide-react';
import { attributeImages } from '@/data/attributeImages';
import { useMonsterData } from '@/hooks/useMonsterData';

interface Monster {
  id: string;
  name: string;
  main: string | null;
  sub: string | null;
  main2?: string | null;
  sub2?: string | null;
  attribute: string;
  baseLevel?: number;
  maxLevel?: number;
  acquired: string;
  imageUrl?: string;
}

interface ReverseTreeNode {
  monster: Monster;
  recipes: ReverseTreeNode[]; // 이 몬스터로 만들 수 있는 헨치들
  depth: number;
}

export default function ReverseRecipe() {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const monsters = useMonsterData() as Monster[];

  // 정확한 이름 매칭으로 검색
  const searchResults = useMemo(() => {
    if (!deferredSearchQuery.trim()) return [];

    const query = deferredSearchQuery.toLowerCase().replace(/\s/g, '');
    return monsters.filter((m) => {
      const name = m.name.toLowerCase().replace(/\s/g, '');
      return name.includes(query);
    }).slice(0, 10);
  }, [deferredSearchQuery, monsters]);

  // 역산 트리 구조 빌드
  const buildReverseTree = useCallback((targetMonster: Monster, depth = 0, visited = new Set<string>()): ReverseTreeNode => {
    if (depth > 10 || visited.has(targetMonster.id)) {
      return { monster: targetMonster, recipes: [], depth };
    }

    visited.add(targetMonster.id);
    const recipes: ReverseTreeNode[] = [];

    // 모든 몬스터를 순회하면서 targetMonster를 주·부·보조 재료로 사용하는 몬스터 찾기
    monsters.forEach((m) => {
      const ingredientNames = [m.main, m.sub, m.main2, m.sub2]
        .filter((ingredient): ingredient is string => Boolean(ingredient && ingredient !== '-'))
        .map(ingredient => ingredient.split('[')[0].trim());

      // 정확한 이름 매칭
      if (ingredientNames.includes(targetMonster.name)) {
        if (!visited.has(m.id)) {
          recipes.push(buildReverseTree(m, depth + 1, new Set(visited)));
        }
      }
    });

    return { monster: targetMonster, recipes, depth };
  }, [monsters]);

  const reverseTree = useMemo(() => {
    return selectedMonster ? buildReverseTree(selectedMonster) : null;
  }, [selectedMonster, buildReverseTree]);

  const handleSelectMonster = (monster: Monster) => {
    setSelectedMonster(monster);
    setShowDropdown(false);
    setSearchQuery('');
    setExpandedNodes(new Set());
  };

  const handleReset = () => {
    setSelectedMonster(null);
    setSearchQuery('');
    setExpandedNodes(new Set());
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const TreeNodeComponent = ({ node, parentId = '' }: { node: ReverseTreeNode; parentId?: string }) => {
    const nodeId = `${parentId}-${node.monster.id}`;
    const isExpanded = expandedNodes.has(nodeId);
    const hasChildren = node.recipes.length > 0;

    return (
      <div className="space-y-3 sm:space-y-4">
        {/* 현재 노드 카드 */}
        <div className="bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50 rounded-lg p-3 sm:p-4 transition-all hover:bg-slate-700/50">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 토글 화살표 */}
            {hasChildren ? (
              <button
                onClick={() => toggleNode(nodeId)}
                className="flex-shrink-0 text-cyan-400 hover:text-cyan-300 transition-all duration-200"
              >
                <ChevronDown
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  style={{
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 200ms ease-out',
                  }}
                />
              </button>
            ) : (
              <div className="w-5 sm:w-6 flex-shrink-0" />
            )}

            {/* 속성 이미지 */}
            <img
              src={node.monster.imageUrl || attributeImages[node.monster.attribute] || attributeImages['악마']}
              alt={node.monster.attribute}
              loading="lazy"
              decoding="async"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover flex-shrink-0"
            />

            {/* 몬스터 정보 */}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-cyan-300">
                {node.monster.name}
              </p>
              <p className="text-xs text-slate-400">
                Lv.{node.monster.baseLevel || 0}~{node.monster.maxLevel || 0}
              </p>
            </div>

            {/* 획득 여부 */}
            {node.monster.acquired === '0' && (
              <span className="text-xs text-green-400 font-semibold flex-shrink-0">✓ 득코</span>
            )}
            {node.monster.acquired !== '0' && (
              <span className="text-xs text-red-400 font-semibold flex-shrink-0">✗ 불가</span>
            )}

            {/* 최상위 표기 */}
            {node.recipes.length === 0 && node.depth > 0 && (
              <span className="text-xs text-amber-400 font-semibold flex-shrink-0">최상위</span>
            )}
          </div>
        </div>

        {/* 자식 노드들 - 토글로 표시/숨김 */}
        {hasChildren && isExpanded && (
          <div className="ml-4 sm:ml-6 border-l-2 border-slate-700 pl-3 sm:pl-4 space-y-3 sm:space-y-4">
            {node.recipes.map((recipe, idx) => (
              <TreeNodeComponent key={idx} node={recipe} parentId={nodeId} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">역산 믹스트리</h1>
          <p className="text-slate-300">하위 헨치를 선택하면 그것으로 만들 수 있는 상위 헨치를 트리로 볼 수 있습니다</p>
        </div>

        {/* 검색 입력 */}
        <div className="relative mb-8">
          <div className="relative">
            <Input
              type="text"
              placeholder="몬스터 이름 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-slate-700 border-slate-600 text-white placeholder-slate-400"
            />
          </div>

          {/* 검색 드롭다운 */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {searchResults.map((monster) => (
                <button
                  key={monster.id}
                  onClick={() => handleSelectMonster(monster)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-600 transition-colors border-b border-slate-600 last:border-b-0 flex items-center gap-3"
                >
                  <img
                    src={monster.imageUrl || attributeImages[monster.attribute] || attributeImages['악마']}
                    alt={monster.attribute}
                    loading="lazy"
                    decoding="async"
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{monster.name}</p>
                    <p className="text-xs text-slate-400">
                      Lv.{monster.baseLevel || 0}~{monster.maxLevel || 0} | {monster.attribute}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 몬스터 표시 */}
        {selectedMonster && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-cyan-300">선택된 몬스터</h2>
              <button
                onClick={handleReset}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedMonster.imageUrl || attributeImages[selectedMonster.attribute] || attributeImages['악마']}
                  alt={selectedMonster.attribute}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">{selectedMonster.name}</p>
                  <p className="text-sm text-slate-400">
                    Lv.{selectedMonster.baseLevel || 0}~{selectedMonster.maxLevel || 0} | {selectedMonster.attribute}
                  </p>
                </div>
                {selectedMonster.acquired === '0' && (
                  <span className="text-sm text-green-400 font-semibold">✓ 득코 가능</span>
                )}
                {selectedMonster.acquired !== '0' && (
                  <span className="text-sm text-red-400 font-semibold">✗ 득코 불가능</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 트리 뷰 */}
        {reverseTree && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-cyan-300 mb-4">
              이 몬스터로 만들 수 있는 헨치
            </h2>
            {reverseTree.recipes.length === 0 ? (
              <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 text-center">
                <p className="text-slate-300">이 몬스터로 만들 수 있는 헨치가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reverseTree.recipes.map((recipe, idx) => (
                  <TreeNodeComponent key={idx} node={recipe} parentId="root" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 초기 상태 */}
        {!selectedMonster && (
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-12 text-center">
            <p className="text-slate-300 text-lg">
              몬스터를 검색하고 선택하면 그것으로 만들 수 있는 헨치를 트리 형태로 볼 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
