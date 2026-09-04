import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Monster } from '@/types/monster';
import { attributeImages } from '@/data/attributeImages';
import { Input } from '@/components/ui/input';
import { Search, GitBranch, ChevronDown, X, ZoomIn } from 'lucide-react';
import { useMonsterData } from '@/hooks/useMonsterData';
import { getRecipeEnchantLevel, getRecipeIngredients, normalizeRecipeName, resolveRecipeMonster } from '@/lib/recipeResolver';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TreeMaterial {
  rawName: string;
  normalizedName: string;
  monster?: Monster;
  enchantLevel?: number;
  isCircular?: boolean;
}

interface TreeNode {
  monster: Monster;
  materials: TreeMaterial[];
  depth: number;
  ancestry: Set<string>;
}

function monsterImage(monster: Monster) {
  return monster.imageUrl || attributeImages[monster.attribute] || attributeImages['악마'];
}

interface TreeNodeCardProps {
  node: TreeNode;
  enchantLevel?: number;
  parentId?: string;
  expandedNodes: ReadonlySet<string>;
  onToggle: (nodeId: string) => void;
  onShowDetail: (monster: Monster) => void;
  buildTreeNode: (monster: Monster, depth?: number, ancestry?: Set<string>) => TreeNode;
}

const TreeNodeCard = memo(function TreeNodeCard({
  node,
  enchantLevel,
  parentId = '',
  expandedNodes,
  onToggle,
  onShowDetail,
  buildTreeNode,
}: TreeNodeCardProps) {
  const nodeId = parentId ? `${parentId}/${node.monster.id}` : node.monster.id;
  const isExpanded = expandedNodes.has(nodeId);
  const hasChildren = node.materials.length > 0;

  return (
    <div className="space-y-3 [content-visibility:auto] sm:space-y-4">
      <div data-testid="mixbook-node-card" className="abyss-dim-card rounded-2xl border p-3 transition-colors hover:border-cyan-400/70 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(nodeId)}
              aria-label={`${node.monster.name} 하위 믹스법 ${isExpanded ? '접기' : '펼치기'}`}
              className="flex-shrink-0 text-cyan-400 transition-colors hover:text-cyan-300"
            >
              <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 200ms ease-out' }} />
            </button>
          ) : <div className="w-5 flex-shrink-0 sm:w-6" />}

          <img src={monsterImage(node.monster)} alt={node.monster.attribute} loading="lazy" decoding="async" draggable={false} className="h-8 w-8 flex-shrink-0 rounded-full object-cover sm:h-10 sm:w-10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onShowDetail(node.monster)} className="text-left text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200 hover:underline sm:text-sm">
                {node.monster.name}
              </button>
              {enchantLevel !== undefined && <span data-testid="mixbook-enchant-badge" className="rounded-lg border border-violet-500 bg-violet-100 px-2 py-0.5 text-xs font-extrabold text-violet-800 shadow-sm">[{enchantLevel}단계]</span>}
            </div>
            <p className="text-xs text-slate-400">Lv.{node.monster.baseLevel || 0}~{node.monster.maxLevel || 0}</p>
          </div>
          <span className={`flex-shrink-0 text-xs font-semibold ${node.monster.acquired === '0' ? 'text-green-400' : 'text-red-400'}`}>
            {node.monster.acquired === '0' ? '✓ 득코' : '✗ 불가'}
          </span>
          {!hasChildren && node.depth > 0 && <span className="flex-shrink-0 text-xs font-semibold text-amber-400">최하위</span>}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-4 space-y-3 border-l-2 border-slate-700 pl-3 sm:ml-6 sm:space-y-4 sm:pl-4">
          {node.materials.map((material, index) => {
            if (material.monster && !material.isCircular) {
              return <TreeNodeCard key={`${nodeId}-${material.monster.id}-${index}`} node={buildTreeNode(material.monster, node.depth + 1, node.ancestry)} enchantLevel={material.enchantLevel} parentId={nodeId} expandedNodes={expandedNodes} onToggle={onToggle} onShowDetail={onShowDetail} buildTreeNode={buildTreeNode} />;
            }
            return (
              <div key={`${nodeId}-${material.rawName}-${index}`} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {material.isCircular ? `순환 재료: ${material.normalizedName}` : `데이터 미등록: ${material.normalizedName}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default function ReverseTree() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [detailMonster, setDetailMonster] = useState<Monster | null>(null);
  const [isDetailImageOpen, setIsDetailImageOpen] = useState(false);
  const monsters = useMonsterData();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const treeCanvasRef = useRef<HTMLElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ windowX: number; windowY: number; canvasX: number; canvasY: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('selectedMixTreeMonster');
    if (!saved) return;
    try {
      const monster = JSON.parse(saved) as Monster;
      setSelectedMonster(monster);
      setExpandedNodes(new Set([monster.id]));
    } catch {
      // 손상된 이전 선택값은 무시하고 새 검색을 허용합니다.
    } finally {
      localStorage.removeItem('selectedMixTreeMonster');
    }
  }, []);

  const searchResults = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const compactQuery = query.replace(/\s+/g, '');
    return monsters.filter((monster) => {
      const compactName = monster.name.toLowerCase().replace(/\s+/g, '');
      return monster.baseLevel && monster.maxLevel && (
        monster.name.toLowerCase().includes(query)
        || compactName.includes(compactQuery)
        || monster.attribute.toLowerCase().includes(query)
        || monster.habitat?.toLowerCase().includes(query)
      );
    }).slice(0, 10);
  }, [deferredSearchQuery, monsters]);

  /**
   * 노드를 선택한 순간에는 바로 아래 재료만 해결합니다. 실제 하위 노드는
   * 사용자가 펼쳤을 때 생성하므로 33단계가 넘는 트리도 제한 없이 안전하게 볼 수 있습니다.
   */
  const buildTreeNode = useCallback((monster: Monster, depth = 0, ancestry = new Set<string>()): TreeNode => {
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(monster.id);
    const materials = getRecipeIngredients(monster).map((rawName) => {
      const material = resolveRecipeMonster(monsters, rawName);
      return {
        rawName,
        normalizedName: normalizeRecipeName(rawName),
        monster: material,
        enchantLevel: getRecipeEnchantLevel(rawName),
        isCircular: Boolean(material && nextAncestry.has(material.id)),
      };
    });
    return { monster, materials, depth, ancestry: nextAncestry };
  }, [monsters]);

  const treeRoot = useMemo(
    () => selectedMonster ? buildTreeNode(resolveRecipeMonster(monsters, selectedMonster.name) ?? selectedMonster) : null,
    [selectedMonster, monsters, buildTreeNode],
  );

  const toggleNode = useCallback((nodeId: string) => {
    const canvas = treeCanvasRef.current;
    pendingScrollRestoreRef.current = {
      windowX: window.scrollX,
      windowY: window.scrollY,
      canvasX: canvas?.scrollLeft ?? 0,
      canvasY: canvas?.scrollTop ?? 0,
    };
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const snapshot = pendingScrollRestoreRef.current;
    if (!snapshot) return;

    const restoreScroll = () => {
      const canvas = treeCanvasRef.current;
      if (canvas) {
        canvas.scrollLeft = snapshot.canvasX;
        canvas.scrollTop = snapshot.canvasY;
      }
      if (window.scrollX !== snapshot.windowX || window.scrollY !== snapshot.windowY) {
        window.scrollTo(snapshot.windowX, snapshot.windowY);
      }
    };

    restoreScroll();
    const frame = window.requestAnimationFrame(restoreScroll);
    pendingScrollRestoreRef.current = null;
    return () => window.cancelAnimationFrame(frame);
  }, [expandedNodes]);

  const handleSelectMonster = (monster: Monster) => {
    setSelectedMonster(monster);
    setShowDropdown(false);
    setSearchQuery('');
    setExpandedNodes(new Set([monster.id]));
    setDetailMonster(null);
    setIsDetailImageOpen(false);
  };

  const handleReset = () => {
    setSelectedMonster(null);
    setSearchQuery('');
    setExpandedNodes(new Set());
    setDetailMonster(null);
    setIsDetailImageOpen(false);
  };

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="flex-shrink-0 border-b border-cyan-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-2 flex items-center gap-2"><GitBranch className="h-5 w-5 text-cyan-400 sm:h-6 sm:w-6" /><h1 className="text-lg font-bold text-cyan-300 sm:text-2xl">믹스 트리</h1></div>
          <p className="text-xs text-slate-400 sm:text-sm">특정 헨치를 만들기 위한 모든 하위 재료 트리를 단계별로 확인하세요.</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-visible px-4 py-4 sm:gap-4 sm:overflow-hidden sm:px-6 sm:py-6">
          <section className="flex-shrink-0">
            <label className="mb-2 block text-xs font-semibold text-cyan-300 sm:mb-3 sm:text-sm">헨치 선택</label>
            {selectedMonster ? (
              <div data-testid="mixbook-selected-card" className="abyss-dim-card flex w-full flex-col items-center gap-2 rounded-2xl border p-2 sm:flex-row sm:gap-4 sm:p-4">
                <img src={monsterImage(selectedMonster)} alt={selectedMonster.attribute} loading="lazy" decoding="async" className="h-8 w-8 flex-shrink-0 rounded-full object-cover sm:h-12 sm:w-12" />
                <div className="min-w-0 flex-1 text-center sm:text-left"><p className="truncate text-xs font-semibold text-cyan-300 sm:text-lg">{selectedMonster.name}</p><p className="truncate text-xs text-slate-400">{selectedMonster.attribute} · Lv.{selectedMonster.baseLevel}~{selectedMonster.maxLevel}</p></div>
                <button type="button" onClick={handleReset} className="flex-shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 sm:px-4 sm:text-sm">변경</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input placeholder="몬스터 이름 검색..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} className="border-slate-700 bg-slate-800/50 pl-10 text-xs text-slate-100 placeholder:text-slate-500 sm:text-sm" />
                {showDropdown && searchResults.length > 0 && <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-lg">
                  {searchResults.map((monster) => <button type="button" key={monster.id} onClick={() => handleSelectMonster(monster)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-700 sm:px-4 sm:py-3">
                    <img src={monsterImage(monster)} alt={monster.attribute} loading="lazy" decoding="async" className="h-6 w-6 flex-shrink-0 rounded-full object-cover sm:h-8 sm:w-8" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-200 sm:text-sm">{monster.name}</span><span className="text-xs text-slate-400">{monster.attribute}</span></span>
                  </button>)}
                </div>}
              </div>
            )}
          </section>

          {treeRoot ? <section ref={treeCanvasRef} data-testid="mixbook-canvas" className="abyss-mixbook-canvas min-h-0 flex-1 overflow-visible rounded-2xl border p-2 [overflow-anchor:none] sm:overflow-auto sm:p-4"><TreeNodeCard node={treeRoot} expandedNodes={expandedNodes} onToggle={toggleNode} onShowDetail={setDetailMonster} buildTreeNode={buildTreeNode} /></section> : (
            <section className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/30"><div className="px-4 py-8 text-center"><GitBranch className="mx-auto mb-3 h-10 w-10 text-slate-600 sm:h-12 sm:w-12" /><p className="text-xs text-slate-400 sm:text-base">헨치를 선택하여 믹스 트리를 확인하세요.</p></div></section>
          )}
        </main>

        {detailMonster && <aside data-testid="mixbook-detail-panel" className="sticky top-0 hidden h-dvh max-h-dvh w-80 shrink-0 self-start flex-col border-l border-cyan-500/20 bg-slate-900/95 shadow-[-16px_0_32px_rgba(2,6,23,0.28)] backdrop-blur-sm sm:flex">
          <div className="flex items-center justify-between border-b border-slate-700 p-4"><h2 className="font-semibold text-cyan-300">상세정보</h2><button type="button" onClick={() => setDetailMonster(null)} className="text-slate-400 hover:text-slate-200"><X className="h-5 w-5" /></button></div>
          <div className="space-y-4 overflow-y-auto p-4"><DetailImageButton monster={detailMonster} onExpand={() => setIsDetailImageOpen(true)} /><Detail label="이름" value={detailMonster.name} /><Detail label="레벨" value={`Lv. ${detailMonster.baseLevel} ~ ${detailMonster.maxLevel}`} /><Detail label="속성" value={detailMonster.attribute} /><Detail label="서식지" value={detailMonster.habitat || '-'} /><Detail label="메인 재료" value={detailMonster.main || '-'} /><Detail label="서브 재료" value={detailMonster.sub || '-'} /><Detail label="보조 재료" value={detailMonster.main2 || '-'} /><Detail label="보조 재료 2" value={detailMonster.sub2 || '-'} /></div>
        </aside>}

        {detailMonster && <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:hidden"><div className="max-h-[78dvh] w-full overflow-y-auto rounded-t-2xl border-t border-cyan-500/20 bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-cyan-300">상세정보</h2><button type="button" aria-label="상세정보 닫기" onClick={() => setDetailMonster(null)} className="min-h-10 min-w-10 text-slate-400"><X className="mx-auto h-5 w-5" /></button></div><DetailImageButton monster={detailMonster} onExpand={() => setIsDetailImageOpen(true)} /><Detail label="이름" value={detailMonster.name} /><Detail label="레벨" value={`Lv. ${detailMonster.baseLevel} ~ ${detailMonster.maxLevel}`} /><Detail label="속성" value={detailMonster.attribute} /><Detail label="서식지" value={detailMonster.habitat || '-'} /><Detail label="메인 재료" value={detailMonster.main || '-'} /><Detail label="서브 재료" value={detailMonster.sub || '-'} /><Detail label="보조 재료" value={detailMonster.main2 || '-'} /><Detail label="보조 재료 2" value={detailMonster.sub2 || '-'} /></div></div>}
        {detailMonster && <Dialog open={isDetailImageOpen} onOpenChange={setIsDetailImageOpen}>
          <DialogContent className="max-w-3xl border-cyan-400/50 bg-slate-950 p-4 text-slate-100 sm:p-6">
            <DialogHeader><DialogTitle className="text-cyan-200">{detailMonster.name} 이미지 확대</DialogTitle><DialogDescription className="text-slate-300">사진을 크게 확인한 뒤 오른쪽 위 닫기 버튼 또는 바깥 영역을 눌러 돌아갈 수 있습니다.</DialogDescription></DialogHeader>
            <img data-testid="mixbook-enlarged-image" src={monsterImage(detailMonster)} alt={`${detailMonster.name} 확대 이미지`} className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-2xl border-2 border-cyan-400/60 bg-slate-900 object-contain" />
          </DialogContent>
        </Dialog>}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="mb-3"><p className="mb-1 text-xs text-slate-400">{label}</p><p className="text-sm text-slate-200">{value}</p></div>;
}

function DetailImageButton({ monster, onExpand }: { monster: Monster; onExpand: () => void }) {
  return <button type="button" data-testid="mixbook-detail-image-button" aria-label={`${monster.name} 이미지 확대`} onClick={onExpand} className="group mx-auto flex flex-col items-center gap-2 rounded-2xl p-1 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><span className="relative block"><img src={monsterImage(monster)} alt={monster.attribute} draggable={false} className="h-20 w-20 rounded-full border-2 border-cyan-500/50 object-cover transition-transform duration-200 group-hover:scale-105" /><span aria-hidden="true" className="absolute bottom-0 right-0 rounded-full border border-cyan-200/70 bg-slate-950 p-1 text-cyan-200"><ZoomIn className="h-3.5 w-3.5" /></span></span><span>사진 확대</span></button>;
}
