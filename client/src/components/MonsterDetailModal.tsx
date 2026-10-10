import { Monster } from '@/types/monster';
import { attributeColors, attributeImages } from '@/data/attributeImages';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveMonsterType } from '@/lib/monsterType';
import { Heart, MapPin, Zap } from 'lucide-react';

interface MonsterDetailModalProps {
  monster: Monster | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectMonster?: (monster: Monster) => void;
  allMonsters?: Monster[];
}

export function MonsterDetailModal({ monster, isOpen, onClose, onSelectMonster, allMonsters = [] }: MonsterDetailModalProps) {
  if (!monster) return null;

  const colors = attributeColors[monster.attribute] || attributeColors['악마'];
  const image = monster.imageUrl || attributeImages[monster.attribute] || attributeImages['악마'];
  const monsterType = resolveMonsterType(monster);

  const handleMonsterClick = (monsterName: string) => {
    // [숫자] 제거 및 공백 정규화
    const cleanName = monsterName
      .replace(/\s*\[\d+\]$/, '')
      .trim();
    
    // 정확한 이름으로 찾기
    let selectedMonster = allMonsters.find((m) => m.name === cleanName);
    
    // 정확한 이름으로 찾지 못하면 공백 제거 후 찾기
    if (!selectedMonster) {
      const nameWithoutSpaces = cleanName.replace(/\s+/g, '');
      selectedMonster = allMonsters.find((m) => m.name.replace(/\s+/g, '') === nameWithoutSpaces);
    }
    
    if (selectedMonster && onSelectMonster) {
      onSelectMonster(selectedMonster);
    }
  };

  const getMonsterAcquiredStatus = (monsterName: string) => {
    // [숫자] 제거 및 공백 정규화
    const cleanName = monsterName
      .replace(/\s*\[\d+\]$/, '')
      .trim();
    
    // 정확한 이름으로 찾기
    let foundMonster = allMonsters.find((m) => m.name === cleanName);
    
    // 정확한 이름으로 찾지 못하면 공백 제거 후 찾기
    if (!foundMonster) {
      const nameWithoutSpaces = cleanName.replace(/\s+/g, '');
      foundMonster = allMonsters.find((m) => m.name.replace(/\s+/g, '') === nameWithoutSpaces);
    }
    
    return foundMonster?.acquired === '0';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="monster-detail-card" className="abyss-detail-modal abyss-dim-card mx-2 max-h-[85vh] w-full max-w-2xl overflow-y-auto border-cyan-700 sm:mx-0 sm:max-h-[90vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">{monster.name}</DialogTitle>
          <DialogDescription className="sr-only">{monster.name}의 상세 정보와 믹스 재료</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* 이미지 및 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 왼쪽: 큰 이미지 */}
            <div className="space-y-4 md:col-span-2">
              {/* 이미지 - 전체 크기 보이기 */}
              <div className={cn('abyss-dim-card-media relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border-2 sm:min-h-64 md:min-h-96', colors.border)}>
                <img
                  src={image}
                  alt={monster.name}
                  className="h-full w-full object-contain p-2 sm:p-4"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                {/* 속성 배지 */}
                <div className={cn('absolute right-3 top-3 rounded-full border px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-black shadow-lg', colors.text, colors.bg)}>
                  {monster.attribute}
                </div>
                {/* 장코/단코 배지 */}
                {monsterType && <div className={cn('absolute left-3 top-3 rounded-full border-2 px-3 py-1.5 text-xs font-black shadow-lg sm:px-4 sm:py-2 sm:text-sm', monsterType === '장코' ? 'border-amber-200 bg-amber-100 text-amber-950' : 'border-sky-200 bg-sky-100 text-sky-950')}>{monsterType}</div>}
              </div>
            </div>

            {/* 오른쪽: 기본 정보 */}
            <div className="space-y-3">
              {/* 레벨 */}
              <div className="abyss-dim-card rounded-lg border p-2 sm:p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
                  <h4 className="text-xs font-semibold text-cyan-300">레벨</h4>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-200">Lv. {monster.baseLevel} ~ {monster.maxLevel}</p>
              </div>

              {/* 서식지 */}
              {monster.habitat && (
                <div className="abyss-dim-card rounded-lg border p-2 sm:p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-amber-400" />
                    <h4 className="text-xs font-semibold text-cyan-300">서식지</h4>
                  </div>
                  <p className="text-xs text-slate-300">{monster.habitat}</p>
                </div>
              )}

              {/* 획득 여부 */}
              {monster.acquired === '0' && (
                <div className="abyss-acquired-label abyss-detail-acquired-label rounded-lg p-2 sm:p-3">
                  <p className="text-xs font-semibold text-green-300">✓ 득코 가능</p>
                </div>
              )}

              {Number(monster.xAntibody) > 0 && (
                <div className="abyss-x-data-badge rounded-lg p-2 sm:p-3">
                  <p className="text-xs">X데이터 {monster.xAntibody}개 필요</p>
                </div>
              )}
            </div>
          </div>

          {/* 믹스 공식 */}
          {(monster.main || monster.sub || monster.main2 || monster.sub2) && (
            <div className="abyss-detail-mix-shell abyss-dim-card rounded-lg border p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400" />
                <h4 className="text-xs sm:text-sm font-semibold text-cyan-300">믹스 공식</h4>
              </div>

              <div className="space-y-3">
                {/* 메인 믹스 */}
                {(monster.main || monster.sub) && (
                  <div className="abyss-detail-mix-row abyss-dim-card rounded-lg border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {monster.main && (
                        <>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMonsterClick(monster.main!)}
                              className="abyss-detail-main-chip inline-block rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-black transition-colors cursor-pointer"
                            >
                              {monster.main}
                            </button>
                            {getMonsterAcquiredStatus(monster.main) && (
                              <span className="abyss-detail-acquired-inline text-xs font-black">득코 가능</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-400">+</span>
                        </>
                      )}
                      {monster.sub && (
                        <>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMonsterClick(monster.sub!)}
                              className="abyss-detail-sub-chip inline-block rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-black transition-colors cursor-pointer"
                            >
                              {monster.sub}
                            </button>
                            {getMonsterAcquiredStatus(monster.sub) && (
                              <span className="abyss-detail-acquired-inline text-xs font-black">득코 가능</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-400">=</span>
                        </>
                      )}
                      <span className="abyss-detail-result-chip inline-block rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-black">
                        {monster.name}
                      </span>
                    </div>
                  </div>
                )}

                {/* 추가 믹스 */}
                {(monster.main2 || monster.sub2) && (
                  <div className="abyss-detail-mix-row abyss-dim-card rounded-lg border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {monster.main2 && (
                        <>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMonsterClick(monster.main2!)}
                              className="abyss-detail-main-chip inline-block rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-black transition-colors cursor-pointer"
                            >
                              {monster.main2}
                            </button>
                            {getMonsterAcquiredStatus(monster.main2) && (
                              <span className="abyss-detail-acquired-inline text-xs font-black">득코 가능</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-400">+</span>
                        </>
                      )}
                      {monster.sub2 && (
                        <>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMonsterClick(monster.sub2!)}
                              className="abyss-detail-sub-chip inline-block rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-black transition-colors cursor-pointer"
                            >
                              {monster.sub2}
                            </button>
                            {getMonsterAcquiredStatus(monster.sub2) && (
                              <span className="abyss-detail-acquired-inline text-xs font-black">득코 가능</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-400">=</span>
                        </>
                      )}
                      <span className="abyss-detail-result-chip inline-block rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm font-black">
                        {monster.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
