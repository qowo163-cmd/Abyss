import { Clock, CheckCircle, Bug, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import historyUpdates from '@/data/updates.json';
import {
  fetchServerUpdates,
  mergeUpdates,
  subscribeToServerUpdates,
  normalizeChanges,
  normalizeUpdates,
  readLocalUpdates,
  type UpdateItem,
} from '@/lib/updates';

const defaultUpdates = normalizeUpdates(historyUpdates).filter((update, index, list) => list.findIndex((candidate) => candidate.id === update.id) === index);

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Zap className="h-5 w-5 text-yellow-400" />;
    case 'fix':
      return <Bug className="h-5 w-5 text-red-400" />;
    case 'improvement':
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    default:
      return <Clock className="h-5 w-5 text-slate-400" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'feature':
      return '새 기능';
    case 'fix':
      return '버그 수정';
    case 'improvement':
      return '개선';
    default:
      return '업데이트';
  }
};

export default function Updates() {
  const [updates, setUpdates] = useState<UpdateItem[]>(defaultUpdates);

  useEffect(() => {
    const applyServerUpdates = (serverUpdates: UpdateItem[]) => {
      const merged = mergeUpdates(serverUpdates, readLocalUpdates(), defaultUpdates);
      // Never replace a usable local/static history with an empty server payload.
      const safeUpdates = merged.length > 0 ? merged : defaultUpdates;
      setUpdates(safeUpdates);
      localStorage.setItem('updates', JSON.stringify(safeUpdates));
    };

    const refreshUpdates = async () => {
      try {
        const serverUpdates = await fetchServerUpdates();
        applyServerUpdates(serverUpdates);
      } catch (error) {
        console.error('Failed to fetch updates from server:', error);
        const fallback = mergeUpdates(readLocalUpdates(), defaultUpdates);
        setUpdates(fallback.length > 0 ? fallback : defaultUpdates);
      }
    };

    void refreshUpdates();
    const unsubscribe = subscribeToServerUpdates(applyServerUpdates);
    const interval = window.setInterval(refreshUpdates, 30_000);
    window.addEventListener('storage', refreshUpdates);
    window.addEventListener('updates-updated', refreshUpdates);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('storage', refreshUpdates);
      window.removeEventListener('updates-updated', refreshUpdates);
    };
  }, []);

  return (
    <div className="updates-page min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <h1 className="text-lg sm:text-2xl font-bold text-cyan-300">업데이트 내역</h1>
          <p className="text-xs sm:text-sm text-slate-400">ABYSS서버 믹스사이트의 최신 업데이트와 변경 이력을 확인하세요</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="space-y-6">
          {updates.length === 0 && (
            <div className="updates-empty rounded-xl border-2 border-cyan-500/50 bg-white p-8 text-center">
              <p className="text-lg font-black">아직 업데이트 내역이 없습니다.</p>
              <p className="mt-2 text-sm">사이트 기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
            </div>
          )}
          {updates.map((update, index) => {
            const changes = normalizeChanges(update.changes);
            const displayChanges = changes.length > 0 ? changes : ['업데이트 내용이 자동으로 기록되지 않은 기존 배포입니다.'];
            return (
              <div key={update.id} className="relative">
                {index !== updates.length - 1 && (
                  <div className="absolute left-5 top-16 w-0.5 h-12 bg-gradient-to-b from-cyan-500/50 to-transparent" />
                )}

                <div className="flex gap-4">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="relative z-10 w-10 h-10 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center">
                      {getTypeIcon(update.type)}
                    </div>
                  </div>

                  <div className="updates-card flex-1 rounded-lg p-4 transition-colors hover:border-cyan-500/70">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">{update.version}</span>
                          <span className="text-xs font-medium text-slate-400 bg-slate-700/50 px-2 py-1 rounded">{getTypeLabel(update.type)}</span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-cyan-300">{update.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                        <Clock className="h-4 w-4" />
                        {new Date(update.date).toLocaleDateString('ko-KR')}
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{update.description}</p>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400">변경사항:</p>
                      <ul className="space-y-1">
                        {displayChanges.map((change, idx) => (
                          <li key={idx} className="text-xs text-slate-400 flex gap-2">
                            <span className="text-cyan-400 flex-shrink-0">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400">관리자가 사이트를 수정하면 이곳에 변경 내역이 자동으로 추가됩니다.</p>
        </div>
      </div>
    </div>
  );
}
