import { useState, useMemo, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monster } from '@/types/monster';
import { Calculator, Plus, Equal, ArrowRightLeft } from 'lucide-react';
import { useMonsterData } from '@/hooks/useMonsterData';

export default function LevelCalculator() {
  const monsters = useMonsterData();
  
  // 정방향 계산: 메인/서브 레벨 입력 → 결과 레벨
  const [directMainName, setDirectMainName] = useState('');
  const deferredMainName = useDeferredValue(directMainName);
  const [directMainLevel, setDirectMainLevel] = useState('');
  const [directSubName, setDirectSubName] = useState('');
  const deferredSubName = useDeferredValue(directSubName);
  const [directSubLevel, setDirectSubLevel] = useState('');

  // 역방향 계산: 목표 레벨 입력 → 필요한 메인/서브 레벨 조합
  const [targetLevel, setTargetLevel] = useState('');
  const [reverseResults, setReverseResults] = useState<Array<{ main: number; sub: number }>>([]);

  const mainSuggestions = useMemo(() => {
    const query = deferredMainName.trim().toLowerCase();
    return query ? monsters.filter(monster => monster.name.toLowerCase().includes(query)).slice(0, 5) : [];
  }, [monsters, deferredMainName]);

  const subSuggestions = useMemo(() => {
    const query = deferredSubName.trim().toLowerCase();
    return query ? monsters.filter(monster => monster.name.toLowerCase().includes(query)).slice(0, 5) : [];
  }, [monsters, deferredSubName]);

  // 정방향 계산 로직
  const calculateDirectResult = () => {
    if (!directMainLevel || !directSubLevel) return null;

    const mainLv = parseInt(directMainLevel);
    const subLv = parseInt(directSubLevel);

    if (isNaN(mainLv) || isNaN(subLv)) return null;

    const resultLevel = Math.floor((mainLv + subLv) / 2) + 8;

    return {
      level: Math.min(resultLevel, 300),
      mainLv,
      subLv,
      mainName: directMainName || '메인',
      subName: directSubName || '서브',
    };
  };

  // 역방향 계산 로직
  const calculateReverseResult = () => {
    if (!targetLevel) return;

    const target = parseInt(targetLevel);
    if (isNaN(target) || target < 1 || target > 300) return;

    // 역계산: (main + sub) / 2 + 8 = target
    // (main + sub) / 2 = target - 8
    // main + sub = (target - 8) * 2
    const sum = (target - 8) * 2;

    const results: Array<{ main: number; sub: number }> = [];

    // 가능한 모든 조합 찾기
    for (let main = 1; main <= 300; main++) {
      const sub = sum - main;
      if (sub >= 1 && sub <= 300) {
        results.push({ main, sub });
      }
    }

    setReverseResults(results);
  };

  const directResult = calculateDirectResult();

  const handleMonsterSelect = (monster: Monster, isMain: boolean) => {
    if (isMain) {
      setDirectMainName(monster.name);
      setDirectMainLevel(monster.baseLevel.toString());
    } else {
      setDirectSubName(monster.name);
      setDirectSubLevel(monster.baseLevel.toString());
    }
  };

  const handleDirectReset = () => {
    setDirectMainName('');
    setDirectMainLevel('');
    setDirectSubName('');
    setDirectSubLevel('');
  };

  const handleReverseReset = () => {
    setTargetLevel('');
    setReverseResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
            <h1 className="text-lg sm:text-2xl font-bold text-cyan-300">레벨계산기</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">두 몬스터를 믹스했을 때 예상 레벨을 계산해보세요.</p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="px-4 sm:px-6 py-4 sm:py-8">
        <div className="w-full max-w-4xl mx-auto">
          {/* 탭 */}
          <Tabs defaultValue="forward" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700 mb-4 sm:mb-6">
              <TabsTrigger value="forward" className="data-[state=active]:bg-cyan-500/20 text-xs sm:text-sm">
                정방향 계산
              </TabsTrigger>
              <TabsTrigger value="reverse" className="data-[state=active]:bg-cyan-500/20 text-xs sm:text-sm">
                역방향 계산
              </TabsTrigger>
            </TabsList>

            {/* 탭 1: 정방향 계산 */}
            <TabsContent value="forward" className="mt-0">
              <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-3 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
                  {/* 메인 입력 */}
                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-xs sm:text-sm font-semibold text-cyan-300">메인 몬스터</label>
                    <div className="relative">
                      <Input
                        placeholder="몬스터 이름 (선택)"
                        value={directMainName}
                        onChange={(e) => setDirectMainName(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-xs sm:text-sm"
                      />
                      {directMainName && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                          {mainSuggestions.map((monster) => (
                              <button
                                key={monster.id}
                                onClick={() => handleMonsterSelect(monster, true)}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                              >
                                <p className="font-semibold text-cyan-300">{monster.name}</p>
                                <p className="text-slate-400">Lv.{monster.baseLevel}</p>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">레벨</label>
                      <Input
                        type="number"
                        placeholder="레벨 입력"
                        value={directMainLevel}
                        onChange={(e) => setDirectMainLevel(e.target.value)}
                        min="1"
                        max="300"
                        className="bg-slate-800/50 border-slate-700 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* 더하기 기호 */}
                  <div className="flex items-center justify-center">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-500/50">
                      <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                    </div>
                  </div>

                  {/* 서브 입력 */}
                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-xs sm:text-sm font-semibold text-cyan-300">서브 몬스터</label>
                    <div className="relative">
                      <Input
                        placeholder="몬스터 이름 (선택)"
                        value={directSubName}
                        onChange={(e) => setDirectSubName(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-xs sm:text-sm"
                      />
                      {directSubName && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                          {subSuggestions.map((monster) => (
                              <button
                                key={monster.id}
                                onClick={() => handleMonsterSelect(monster, false)}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                              >
                                <p className="font-semibold text-cyan-300">{monster.name}</p>
                                <p className="text-slate-400">Lv.{monster.baseLevel}</p>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">레벨</label>
                      <Input
                        type="number"
                        placeholder="레벨 입력"
                        value={directSubLevel}
                        onChange={(e) => setDirectSubLevel(e.target.value)}
                        min="1"
                        max="300"
                        className="bg-slate-800/50 border-slate-700 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* 결과 */}
                {directResult && (
                  <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-700">
                    <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <Equal className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
                      <h3 className="text-base sm:text-lg font-semibold text-cyan-300">예상 결과</h3>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 rounded-lg p-4 sm:p-6 text-center">
                      <p className="text-xs sm:text-sm text-slate-400 mb-2">예상 레벨</p>
                      <p className="text-4xl sm:text-5xl font-black text-cyan-300">{directResult.level}</p>
                      <p className="text-xs text-slate-500 mt-3 sm:mt-4">
                        ({directResult.mainLv} + {directResult.subLv}) ÷ 2 + 5 = {directResult.level}
                      </p>
                    </div>
                  </div>
                )}

                {/* 버튼 */}
                <div className="mt-6 sm:mt-8 flex gap-3 sm:gap-4">
                  <Button
                    onClick={handleDirectReset}
                    variant="outline"
                    className="flex-1 text-xs sm:text-sm"
                  >
                    초기화
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* 탭 2: 역방향 계산 */}
            <TabsContent value="reverse" className="mt-0">
              <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-4 sm:p-8">
                {/* 목표 레벨 입력 */}
                <div className="max-w-sm mx-auto mb-6 sm:mb-8">
                  <label className="block text-xs sm:text-sm font-semibold text-cyan-300 mb-3">목표 레벨</label>
                  <div className="flex gap-2 sm:gap-3">
                    <Input
                      type="number"
                      placeholder="목표 레벨 입력"
                      value={targetLevel}
                      onChange={(e) => setTargetLevel(e.target.value)}
                      min="1"
                      max="300"
                      className="bg-slate-800/50 border-slate-700 text-xs sm:text-sm flex-1"
                    />
                    <Button
                      onClick={calculateReverseResult}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs sm:text-sm px-3 sm:px-6"
                    >
                      계산
                    </Button>
                  </div>
                </div>

                {/* 결과 */}
                {reverseResults.length > 0 && (
                  <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-700">
                    <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <ArrowRightLeft className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
                      <h3 className="text-base sm:text-lg font-semibold text-cyan-300">
                        레벨 {targetLevel}을 만드는 조합
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-h-96 overflow-y-auto">
                      {reverseResults.map((result, idx) => (
                        <div
                          key={idx}
                          className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/50 rounded-lg p-3 sm:p-4 text-center hover:border-purple-500 transition-colors"
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-sm sm:text-base font-bold text-purple-300">{result.main}</span>
                            <Plus className="h-4 w-4 text-slate-400" />
                            <span className="text-sm sm:text-base font-bold text-blue-300">{result.sub}</span>
                          </div>
                          <p className="text-xs text-slate-400">= {targetLevel}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-400 mt-4 text-center">
                      총 {reverseResults.length}개의 조합이 있습니다.
                    </p>
                  </div>
                )}

                {/* 결과 없음 */}
                {targetLevel && reverseResults.length === 0 && (
                  <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-700">
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 sm:p-6 text-center">
                      <p className="text-xs sm:text-sm text-red-300">
                        레벨 {targetLevel}을 만드는 조합이 없습니다.
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        1 ~ 300 범위의 메인/서브 조합으로는 불가능합니다.
                      </p>
                    </div>
                  </div>
                )}

                {/* 버튼 */}
                <div className="mt-6 sm:mt-8 flex gap-3 sm:gap-4">
                  <Button
                    onClick={handleReverseReset}
                    variant="outline"
                    className="flex-1 text-xs sm:text-sm"
                  >
                    초기화
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* 설명 */}
          <div className="mt-6 sm:mt-8 rounded-lg border border-slate-700 bg-slate-800/30 p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-semibold text-cyan-300 mb-2 sm:mb-3">계산 방식</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              예상 레벨은 (메인 몬스터 레벨 + 서브 몬스터 레벨) ÷ 2 + 5 로 계산됩니다. 이는 게임의 실제 믹스 시스템과 유사하게 설계된 공식입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
