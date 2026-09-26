import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { Monster } from '@/types/monster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit2, Plus, LogOut, Download, Upload, Check, Clock, Home, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { parseMonsterCsv, parseMonsterExcel } from '@/lib/monsterCsv';
import { appendServerUpdate, fetchServerUpdates, normalizeUpdates, saveServerUpdates, type UpdateItem } from '@/lib/updates';
import { formatFileSize, optimizeImageForUpload, type OptimizedImage } from '@/lib/imageOptimizer';
import { fetchServerFeedbacks, subscribeToServerFeedbacks, updateServerFeedbackStatus, type FeedbackItem, type FeedbackStatus } from '@/lib/feedback';
import { replaceMonsterData, useMonsterData } from '@/hooks/useMonsterData';
import { useMembership } from '@/contexts/MembershipContext';
import SecurityAlertsPanel from '@/components/SecurityAlertsPanel';
import OnlineMembersPanel from '@/components/OnlineMembersPanel';
import ItemCatalogAdminPanel from '@/components/ItemCatalogAdminPanel';
import MarketplaceHistoryAdminPanel from '@/components/MarketplaceHistoryAdminPanel';
import MarketplacePriceProtectionAdminPanel from '@/components/MarketplacePriceProtectionAdminPanel';
import MemberManagement from '@/pages/MemberManagement';
import { MARKETPLACE_ALERT_TEST_EVENT } from '@/components/MarketplaceRequestNotifier';
import type { MarketplaceRequestAlert } from '@shared/marketplaceRequestAlerts';
import { applyMonsterBulkEdit, findAcquiredMismatches, type AcquiredMismatch } from '@/lib/monsterBulkEdit';
import { getAdminMarketplaceTabSettings, saveAdminMarketplaceTabSettings, type MarketplaceTabSettings } from '@/lib/marketplace';

const normalizeChanges = (changes: unknown): string[] => {
  if (Array.isArray(changes)) return changes.map(String).filter(Boolean);
  if (typeof changes === 'string') return changes.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  return [];
};

type MarketplaceTabSettingKey = 'sellEnabled' | 'buyEnabled' | 'exchangeEnabled' | 'itemsEnabled';
const MARKETPLACE_TAB_CONTROLS: Array<{ key: MarketplaceTabSettingKey; title: string; description: string }> = [
  { key: 'sellEnabled', title: '판매중 탭', description: '헨치 판매글 조회·거래 요청·관리자 등록을 허용합니다.' },
  { key: 'buyEnabled', title: '구매중 탭', description: '헨치 구매글 조회·판매 제안·관리자 등록을 허용합니다.' },
  { key: 'exchangeEnabled', title: '교환중 탭', description: '헨치 교환글 조회·교환 제안·관리자 등록을 허용합니다.' },
  { key: 'itemsEnabled', title: '아이템 거래 탭', description: '아이템 거래글 조회·제안·관리자 등록을 허용합니다.' },
];

const DEFAULT_MARKETPLACE_TAB_SETTINGS: MarketplaceTabSettings = {
  sellEnabled: true,
  buyEnabled: true,
  exchangeEnabled: true,
  itemsEnabled: true,
  updatedAt: null,
};

const ADMIN_NAV_ITEMS = [
  { value: 'members', label: '회원 관리' },
  { value: 'monsters', label: '몬스터 관리' },
  { value: 'recipes', label: '조합법 관리' },
  { value: 'data', label: '데이터 관리' },
  { value: 'feedback', label: '건의사항' },
  { value: 'updates', label: '업데이트 관리' },
  { value: 'settings', label: '사이트 설정' },
  { value: 'security', label: '보안 알림' },
  { value: 'online', label: '접속자' },
  { value: 'items', label: '아이템 관리' },
  { value: 'history', label: '거래 기록' },
  { value: 'price-protection', label: '시세 보호' },
] as const;

const ADMIN_MONSTER_PAGE_SIZE = 80;
const ADMIN_RECIPE_PAGE_SIZE = 80;

export default function Admin() {
  const { member: currentMember, logout } = useMembership();
  const cachedMonsters = useMonsterData();
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [editingMonster, setEditingMonster] = useState<Monster | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newUpdateVersion, setNewUpdateVersion] = useState('');
  const [newUpdateTitle, setNewUpdateTitle] = useState('');
  const [newUpdateDescription, setNewUpdateDescription] = useState('');
  const [newUpdateChanges, setNewUpdateChanges] = useState('');
  const [newUpdateType, setNewUpdateType] = useState<'feature' | 'fix' | 'improvement'>('feature');
  const [siteTitle, setSiteTitle] = useState(() => localStorage.getItem('siteTitle') || 'ABYSS서버 믹스사이트');
  const [siteLogo, setSiteLogo] = useState(() => localStorage.getItem('siteLogo') || '');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#06b6d4');
  const [secondaryColor, setSecondaryColor] = useState(() => localStorage.getItem('secondaryColor') || '#0f172a');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bulkImageInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ fileName: string; monsterName?: string; status: 'success' | 'unmatched' | 'error'; message?: string }[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [imageOptimization, setImageOptimization] = useState<OptimizedImage | null>(null);
  const [monsterToDelete, setMonsterToDelete] = useState<Monster | null>(null);
  const [isDeletingMonster, setIsDeletingMonster] = useState(false);
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<Set<string>>(new Set());
  const [bulkAcquired, setBulkAcquired] = useState<'__keep__' | '0' | 'x'>('__keep__');
  const [bulkHabitat, setBulkHabitat] = useState('');
  const [clearBulkHabitat, setClearBulkHabitat] = useState(false);
  const [pendingImportedMonsters, setPendingImportedMonsters] = useState<Monster[] | null>(null);
  const [pendingImportMismatches, setPendingImportMismatches] = useState<AcquiredMismatch[]>([]);
  const [marketplaceTabSettings, setMarketplaceTabSettings] = useState<MarketplaceTabSettings>(DEFAULT_MARKETPLACE_TAB_SETTINGS);
  const [savingMarketplaceTabKey, setSavingMarketplaceTabKey] = useState<MarketplaceTabSettingKey | null>(null);
  const [activeTab, setActiveTab] = useState('monsters');
  const [visibleMonsterCount, setVisibleMonsterCount] = useState(ADMIN_MONSTER_PAGE_SIZE);
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(ADMIN_RECIPE_PAGE_SIZE);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const recordSiteUpdate = async (input: Omit<UpdateItem, 'id' | 'date'>) => {
    const update: UpdateItem = {
      ...input,
      id: `auto-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
    };
    try {
      const updates = await appendServerUpdate(update);
      localStorage.setItem('updates', JSON.stringify(updates));
      setUpdates(updates);
      window.dispatchEvent(new Event('updates-updated'));
      return true;
    } catch (error) {
      console.error('Failed to record site update:', error);
      toast.error('사이트 변경은 저장되었지만 업데이트 이력 기록에 실패했습니다');
      return false;
    }
  };

  // 관리자 저장·내보내기에는 원본 이미지 URL을 유지하기 위해 서버 원본 데이터를 한 번 로드합니다.
  useEffect(() => {
    fetch('/api/monsters', { cache: 'no-cache' })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMonsters(data as Monster[]);
          localStorage.setItem('monsters', JSON.stringify(data));
        }
      })
      .catch((error) => console.error('Failed to fetch monsters in admin:', error));
  }, []);

  // 업데이트 이력은 필요할 때만 로드해 초기 관리자 화면의 요청을 줄입니다.
  useEffect(() => {
    if (activeTab !== 'updates') return;
    const refreshUpdates = async () => {
      try {
        const serverUpdates = await fetchServerUpdates();
        setUpdates(serverUpdates);
        localStorage.setItem('updates', JSON.stringify(serverUpdates));
      } catch (error) {
        console.error('Failed to fetch updates in admin:', error);
        setUpdates(normalizeUpdates(JSON.parse(localStorage.getItem('updates') || '[]')));
      }
    };
    void refreshUpdates();
    window.addEventListener('updates-updated', refreshUpdates);
    return () => window.removeEventListener('updates-updated', refreshUpdates);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'feedback') return;
    const refreshFeedbacks = async () => {
      try {
        setFeedbacks(await fetchServerFeedbacks());
      } catch (error) {
        console.error('Failed to fetch feedbacks in admin:', error);
      }
    };
    void refreshFeedbacks();
    const unsubscribe = subscribeToServerFeedbacks(setFeedbacks);
    const interval = window.setInterval(refreshFeedbacks, 30_000);
    window.addEventListener('feedbacks-updated', refreshFeedbacks);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('feedbacks-updated', refreshFeedbacks);
    };
  }, [activeTab]);

  useEffect(() => {
    if (cachedMonsters.length > 0) setMonsters(cachedMonsters);
  }, [cachedMonsters]);

  useEffect(() => {
    if (currentMember?.role !== 'admin' || activeTab !== 'settings') return;
    void getAdminMarketplaceTabSettings()
      .then(({ settings }) => setMarketplaceTabSettings(settings))
      .catch((error) => {
        console.error('Failed to load marketplace tab settings:', error);
        toast.error('거래소 탭 사용 설정을 불러오지 못했습니다.');
      });
  }, [activeTab, currentMember?.role]);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const filteredMonsters = useMemo(() => monsters.filter((monster) =>
    !normalizedSearchQuery
    || monster.name.toLowerCase().includes(normalizedSearchQuery)
    || (monster.habitat || '').toLowerCase().includes(normalizedSearchQuery)
  ), [monsters, normalizedSearchQuery]);
  const recipeMonsters = useMemo(
    () => monsters.filter((monster) => monster.main !== '-' || monster.sub !== '-'),
    [monsters],
  );
  const visibleMonsters = useMemo(
    () => filteredMonsters.slice(0, visibleMonsterCount),
    [filteredMonsters, visibleMonsterCount],
  );
  const visibleRecipeMonsters = useMemo(
    () => recipeMonsters.slice(0, visibleRecipeCount),
    [recipeMonsters, visibleRecipeCount],
  );

  useEffect(() => {
    setVisibleMonsterCount(ADMIN_MONSTER_PAGE_SIZE);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    setVisibleRecipeCount(ADMIN_RECIPE_PAGE_SIZE);
  }, [recipeMonsters]);

  const handleFeedbackStatus = async (id: string, status: FeedbackStatus) => {
    try {
      setFeedbacks(await updateServerFeedbackStatus(id, status));
      toast.success(status === 'completed' ? '건의사항을 완료 처리했습니다.' : '건의사항을 검토중으로 변경했습니다.');
    } catch (error) {
      console.error('Failed to update feedback status:', error);
      toast.error('건의사항 상태 변경에 실패했습니다.');
    }
  };

  // 몬스터 추가
  const handleAddMonster = () => {
    const newMonster: Monster = {
      id: `new-${Date.now()}`,
      name: '새 몬스터',
      baseLevel: 1,
      maxLevel: 50,
      habitat: '',
      main: '-',
      sub: '-',
      main2: null,
      sub2: null,
      acquired: '0',
      attribute: '악마'
    };
    setMonsters([...monsters, newMonster]);
    setEditingMonster(newMonster);
  };

  // 서버로 데이터 저장 후 브라우저 캐시를 동기화
  const persistMonsters = async (newMonsters: Monster[]) => {
    try {
      const response = await fetch('/api/monsters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMonsters),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || `Server returned ${response.status}`);
      }
      // 서버가 메타데이터 병합 및 이미지 보호 URL 변환을 완료한 최종 배열을 우선합니다.
      // 업로드 직후에도 모든 화면이 동일한 캐시 상태를 사용하도록 응답값을 공통 캐시에 반영합니다.
      const persistedMonsters = Array.isArray(data.monsters) ? data.monsters as Monster[] : newMonsters;
      setMonsters(persistedMonsters);
      replaceMonsterData(persistedMonsters);
      return persistedMonsters;
    } catch (error) {
      console.error('Failed to sync with server:', error);
      toast.error(error instanceof Error ? error.message : '서버 저장에 실패했습니다.');
      return false;
    }
  };

  const toggleMonsterSelection = (monsterId: string) => {
    setSelectedMonsterIds((current) => {
      const next = new Set(current);
      if (next.has(monsterId)) next.delete(monsterId);
      else next.add(monsterId);
      return next;
    });
  };

  const selectVisibleMonsters = () => {
    const visibleIds = filteredMonsters.map((monster) => String(monster.id));
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedMonsterIds.has(id));
    setSelectedMonsterIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleBulkMonsterEdit = async () => {
    if (selectedMonsterIds.size === 0) {
      toast.error('일괄 수정할 헨치를 하나 이상 선택해 주세요.');
      return;
    }
    const edit = {
      ...(bulkAcquired === '__keep__' ? {} : { acquired: bulkAcquired }),
      ...(clearBulkHabitat ? { habitat: '' } : bulkHabitat.trim() ? { habitat: bulkHabitat } : {}),
    };
    if (Object.keys(edit).length === 0) {
      toast.error('변경할 득코 여부 또는 서식지를 입력해 주세요.');
      return;
    }
    const updated = applyMonsterBulkEdit(monsters, selectedMonsterIds, edit);
    const saved = await persistMonsters(updated);
    if (!saved) return;
    await recordSiteUpdate({
      version: new Date().toISOString().slice(0, 10),
      title: '헨치 일괄 정보 수정',
      description: `${selectedMonsterIds.size}개 헨치의 득코 여부 또는 서식지를 일괄 수정했습니다`,
      changes: [
        ...(bulkAcquired === '__keep__' ? [] : [`득코 여부: ${bulkAcquired === '0' ? '가능' : '불가능'}`]),
        ...(clearBulkHabitat ? ['서식지: 비움'] : bulkHabitat.trim() ? [`서식지: ${bulkHabitat.trim()}`] : []),
      ],
      type: 'improvement',
    });
    setSelectedMonsterIds(new Set());
    setBulkAcquired('__keep__');
    setBulkHabitat('');
    setClearBulkHabitat(false);
    toast.success(`${selectedMonsterIds.size}개 헨치 정보가 일괄 반영되었습니다.`);
  };

  // 전체 헨치의 서식지를 한 번에 비웁니다 (선택 여부와 상관없이 전부 적용).
  const handleClearAllHabitats = async () => {
    const ok = window.confirm(`전체 ${monsters.length}개 헨치의 서식지를 모두 지울까요?\n되돌릴 수 없습니다.`);
    if (!ok) return;
    const updated = monsters.map((monster) => ({ ...monster, habitat: '' }));
    const saved = await persistMonsters(updated);
    if (!saved) return;
    await recordSiteUpdate({
      version: new Date().toISOString().slice(0, 10),
      title: '헨치 서식지 전체 삭제',
      description: `전체 ${updated.length}개 헨치의 서식지 정보를 일괄 삭제했습니다`,
      changes: ['모든 헨치의 서식지 값을 비움'],
      type: 'improvement',
    });
    toast.success(`전체 ${updated.length}개 헨치의 서식지를 삭제했습니다.`);
  };

  // 몬스터 수정
  const handleUpdateMonster = async (updated: Monster) => {
    const updatedMonsters = monsters.map(m => m.id === updated.id ? updated : m);
    const saved = await persistMonsters(updatedMonsters);
    if (!saved) return;
    setEditingMonster(null);
    await recordSiteUpdate({
      version: new Date().toISOString().slice(0, 10),
      title: '헨치 정보 수정',
      description: `${updated.name} 헨치 정보가 수정되었습니다`,
      changes: ['몬스터 정보 저장', ...(updated.imageUrl ? ['헨치 이미지 반영'] : []), ...(updated.xAntibody ? [`X데이터 ${updated.xAntibody}개 필요 정보 반영`] : [])],
      type: 'improvement',
    });
    toast.success('몬스터가 수정되었습니다 (서버 및 모든 사용자에게 반영됨)');
  };

  // 몬스터 이미지 업로드: 브라우저에서 서버를 거쳐 내장 파일 저장소에 저장
  const handleImageUpload = async (file: File) => {
    if (!editingMonster) return;

    setUploadingImage(true);
    setImageOptimization(null);
    try {
      const optimized = await optimizeImageForUpload(file);
      const response = await fetch('/api/monster-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monsterId: editingMonster.id,
          fileName: optimized.file.name,
          contentType: optimized.file.type,
          data: optimized.dataUrl,
        }),
      });
      if (!response.ok) throw new Error('서버 업로드 실패');
      const result = await response.json() as { url?: string; monster?: Monster };
      if (!result.url) throw new Error('업로드 URL이 없습니다');
      // 이미지 API는 파일·메타데이터를 한 요청에서 원자적으로 저장하고, 캐시를 무효화한 보호 URL을 반환합니다.
      // 구형 서버 응답에는 monster가 없을 수 있으므로 그 경우에만 기존 전체 저장 경로를 보조 수단으로 사용합니다.
      const updatedMonster = result.monster && String(result.monster.id) === String(editingMonster.id)
        ? result.monster
        : { ...editingMonster, imageUrl: result.url, imageVersion: Date.now() };
      const updatedMonsters = monsters.map(monster => monster.id === updatedMonster.id ? updatedMonster : monster);
      const savedMonsters = result.monster
        ? updatedMonsters
        : await persistMonsters(updatedMonsters);
      if (!savedMonsters) throw new Error('이미지 URL 저장 실패');
      if (result.monster) {
        setMonsters(savedMonsters);
        replaceMonsterData(savedMonsters);
      }
      const persistedMonster = savedMonsters.find(monster => String(monster.id) === String(updatedMonster.id)) || updatedMonster;
      setEditingMonster(persistedMonster);
      setImageOptimization(optimized);
      const savedPercent = Math.max(0, Math.round((1 - optimized.optimizedBytes / optimized.originalBytes) * 100));
      await recordSiteUpdate({
        version: new Date().toISOString().slice(0, 10),
        title: '헨치 이미지 업로드',
        description: `${updatedMonster.name} 헨치 이미지가 업로드되고 사이트에 반영되었습니다`,
        changes: [
          `고화질 WebP 보존: ${formatFileSize(optimized.originalBytes)} → ${formatFileSize(optimized.optimizedBytes)} (${savedPercent}% 절감)`,
          `이미지 크기: ${optimized.width}×${optimized.height}px · WebP 95% 기준`,
          '헨치 데이터에 이미지 URL 저장',
          '공개 헨치 카드와 상세 모달에 이미지 반영',
        ],
        type: 'feature',
      });
      toast.success(`이미지를 고화질 WebP로 보존해 ${optimized.width}×${optimized.height}px로 즉시 반영했습니다`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // 파일 이름을 헨치 이름과 비교하기 좋게 다듬기: 띄어쓰기 제거, 소문자 변환
  const normalizeForImageMatch = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase();

  // 헨치 이미지 일괄 업로드: 파일 이름이 헨치 이름과 일치하면(띄어쓰기 무시) 자동으로 그 헨치에 적용
  const handleBulkImageUpload = async (files: FileList) => {
    setBulkUploading(true);
    setBulkResults([]);
    const results: typeof bulkResults = [];
    let latestMonsters = monsters;
    const appliedNames: string[] = [];

    for (const file of Array.from(files)) {
      const baseName = file.name.replace(/\.[^./\\]+$/, '');
      const target = latestMonsters.find((monster) => normalizeForImageMatch(monster.name) === normalizeForImageMatch(baseName));
      if (!target) {
        results.push({ fileName: file.name, status: 'unmatched', message: '이름이 일치하는 헨치를 찾지 못했습니다' });
        setBulkResults([...results]);
        continue;
      }
      try {
        const optimized = await optimizeImageForUpload(file);
        const response = await fetch('/api/monster-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monsterId: target.id,
            fileName: optimized.file.name,
            contentType: optimized.file.type,
            data: optimized.dataUrl,
          }),
        });
        if (!response.ok) throw new Error('서버 업로드 실패');
        const result = await response.json() as { url?: string; monster?: Monster };
        if (!result.url) throw new Error('업로드 URL이 없습니다');
        const updatedMonster = result.monster && String(result.monster.id) === String(target.id)
          ? result.monster
          : { ...target, imageUrl: result.url, imageVersion: Date.now() };
        latestMonsters = latestMonsters.map((monster) => monster.id === updatedMonster.id ? updatedMonster : monster);
        if (!result.monster) {
          const saved = await persistMonsters(latestMonsters);
          if (saved) latestMonsters = saved;
        }
        appliedNames.push(target.name);
        results.push({ fileName: file.name, monsterName: target.name, status: 'success' });
      } catch (error) {
        results.push({ fileName: file.name, monsterName: target.name, status: 'error', message: error instanceof Error ? error.message : '업로드 실패' });
      }
      setBulkResults([...results]);
    }

    setMonsters(latestMonsters);
    replaceMonsterData(latestMonsters);

    if (appliedNames.length > 0) {
      await recordSiteUpdate({
        version: new Date().toISOString().slice(0, 10),
        title: '헨치 이미지 일괄 업로드',
        description: `${appliedNames.length}개 헨치 이미지가 일괄 업로드되었습니다`,
        changes: [`적용된 헨치: ${appliedNames.slice(0, 10).join(', ')}${appliedNames.length > 10 ? ` 외 ${appliedNames.length - 10}개` : ''}`],
        type: 'feature',
      });
      toast.success(`${appliedNames.length}개 이미지 적용 완료`);
    }
    const unmatchedCount = results.filter((entry) => entry.status === 'unmatched').length;
    if (unmatchedCount > 0) toast.error(`${unmatchedCount}개 파일은 이름이 일치하는 헨치를 찾지 못했습니다`);

    setBulkUploading(false);
    if (bulkImageInputRef.current) bulkImageInputRef.current.value = '';
  };

  // 몬스터 삭제
  const handleDeleteMonster = async (id: string) => {
    const removed = monsters.find(monster => monster.id === id);
    if (!removed) {
      toast.error('삭제할 헨치 정보를 찾지 못했습니다. 목록을 새로고침해 주세요.');
      return false;
    }
    const updatedMonsters = monsters.filter(monster => monster.id !== id);
    const saved = await persistMonsters(updatedMonsters);
    if (!saved) return false;
    setEditingMonster(current => current?.id === id ? null : current);
    await recordSiteUpdate({
      version: new Date().toISOString().slice(0, 10),
      title: '헨치 데이터 삭제',
      description: `${removed.name} 데이터가 삭제되었습니다`,
      changes: ['관리자 데이터에서 몬스터 삭제'],
      type: 'fix',
    });
    toast.success('몬스터가 삭제되었습니다 (서버 및 모든 사용자에게 반영됨)');
    return true;
  };

  const confirmMonsterDeletion = async () => {
    if (!monsterToDelete || isDeletingMonster) return;
    setIsDeletingMonster(true);
    try {
      const deleted = await handleDeleteMonster(monsterToDelete.id);
      if (deleted) setMonsterToDelete(null);
    } finally {
      setIsDeletingMonster(false);
    }
  };

  // 데이터 저장
  const handleSaveData = () => {
    const dataStr = JSON.stringify(monsters, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monsters_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    toast.success('데이터가 저장되었습니다');
  };

  // 엑셀 데이터 엑스포트
  const handleExportExcel = () => {
    try {
      const headers = ['이름', '기본레벨', '최대레벨', '속성', '주재료', '부재료', '주재료2', '부재료2', '획듍여부', '서식지', 'X데이터'];
      const rows = monsters.map(m => [
        m.name,
        m.baseLevel,
        m.maxLevel,
        m.attribute,
        m.main || '-',
        m.sub || '-',
        m.main2 || '-',
        m.sub2 || '-',
        m.acquired || '-',
        m.habitat || '-',
        m.xAntibody || 0
      ]);

      let csv = headers.join(',') + '\n';
      rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monsters_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('엑셀 파일이 다운로드되었습니다');
    } catch (error) {
      toast.error('엑스포트 실패');
    }
  };

  const stageImportedMonsters = (importedMonsters: Monster[]) => {
    const existingById = new Map(monsters.map((monster) => [String(monster.id), monster]));
    const existingByName = new Map(monsters.map((monster) => [monster.name.trim().toLowerCase(), monster]));
    const mergedMonsters = importedMonsters.map((monster) => {
      const previous = existingById.get(String(monster.id)) || existingByName.get(monster.name.trim().toLowerCase());
      if (!previous?.imageUrl) return monster;
      return {
        ...monster,
        imageUrl: previous.imageUrl,
        ...(previous.imageVersion !== undefined ? { imageVersion: previous.imageVersion } : {}),
      };
    });
    setPendingImportMismatches(findAcquiredMismatches(monsters, mergedMonsters));
    setPendingImportedMonsters(mergedMonsters);
  };

  const confirmImportedMonsters = async () => {
    if (!pendingImportedMonsters) return;
    const saved = await persistMonsters(pendingImportedMonsters);
    if (!saved) return;
    await recordSiteUpdate({
      version: new Date().toISOString().slice(0, 10),
      title: '몬스터 데이터 업로드',
      description: `${pendingImportedMonsters.length}개의 몬스터 데이터가 업로드되었습니다`,
      changes: [
        `총 ${pendingImportedMonsters.length}개 몬스터 데이터 업데이트`,
        '기존 헨치 이미지 URL 보존',
        `득코 여부 불일치 ${pendingImportMismatches.length}건 사전 검토`,
      ],
      type: 'improvement',
    });
    toast.success(`${pendingImportedMonsters.length}개의 몬스터가 임포트되었습니다 (기존 이미지 보존)`);
    setPendingImportedMonsters(null);
    setPendingImportMismatches([]);
  };

  // 엑셀 데이터 임포트: 즉시 저장하지 않고 득코 여부 불일치를 먼저 검토합니다.
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedMonsters = /\.(xlsx|xls)$/i.test(file.name)
          ? parseMonsterExcel(event.target?.result as ArrayBuffer)
          : parseMonsterCsv(event.target?.result as string);
        if (importedMonsters.length === 0) {
          toast.error('유효한 CSV/엑셀 형식이 아닙니다');
          return;
        }

        stageImportedMonsters(importedMonsters);
        toast.success(`${importedMonsters.length}개 데이터를 읽었습니다. 아래 득코 여부 검증 결과를 확인한 뒤 반영해 주세요.`);
      } catch (error) {
        toast.error('파일 읽기 실패');
      }
    };
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 사이트 설정 저장
  const handleSaveSiteSettings = async () => {
    localStorage.setItem('siteTitle', siteTitle);
    document.title = siteTitle || 'ABYSS서버 믹스사이트';
    localStorage.setItem('siteLogo', siteLogo);
    localStorage.setItem('primaryColor', primaryColor);
    localStorage.setItem('secondaryColor', secondaryColor);
    
    await recordSiteUpdate({
      version: new Date().toISOString().slice(0, 10),
      title: '사이트 설정 업데이트',
      description: '사이트 제목, 로고, 색상 등이 변경되었습니다',
      changes: [`제목: ${siteTitle}`, `주색상: ${primaryColor}`, `보조색상: ${secondaryColor}`],
      type: 'improvement',
    });
    toast.success('사이트 설정이 저장되었습니다 (모든 사용자에게 반영됨)');
  };

  const handleMarketplaceTabToggle = async (key: MarketplaceTabSettingKey, enabled: boolean) => {
    const previous = marketplaceTabSettings;
    const next = { ...previous, [key]: enabled };
    setMarketplaceTabSettings(next);
    setSavingMarketplaceTabKey(key);
    try {
      const { settings } = await saveAdminMarketplaceTabSettings(next);
      setMarketplaceTabSettings(settings);
      const control = MARKETPLACE_TAB_CONTROLS.find((item) => item.key === key);
      await recordSiteUpdate({
        version: new Date().toISOString().slice(0, 10),
        title: '거래소 탭 사용 설정 변경',
        description: `${control?.title || '거래소 탭'}을 ${enabled ? '사용' : '중지'}로 전환했습니다.`,
        changes: [`${control?.title || key}: ${enabled ? '사용' : '중지'}`],
        type: 'improvement',
      });
      toast.success(`${control?.title || '거래소 탭'}을 ${enabled ? '사용' : '중지'}로 전환했습니다.`);
    } catch (error) {
      setMarketplaceTabSettings(previous);
      toast.error(error instanceof Error ? error.message : '거래소 탭 사용 설정 저장에 실패했습니다.');
    } finally {
      setSavingMarketplaceTabKey(null);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdateVersion || !newUpdateTitle || !newUpdateDescription) {
      toast.error('모든 필드를 입력해주세요');
      return;
    }
    const saved = await recordSiteUpdate({
      version: newUpdateVersion,
      title: newUpdateTitle,
      description: newUpdateDescription,
      changes: newUpdateChanges.split('\n').map(change => change.trim()).filter(Boolean),
      type: newUpdateType,
    });
    if (!saved) return;
    setNewUpdateVersion('');
    setNewUpdateTitle('');
    setNewUpdateDescription('');
    setNewUpdateChanges('');
    toast.success('업데이트가 서버에 저장되었습니다');
  };

  const handleDeleteUpdate = async (id: string) => {
    try {
      const current = await fetchServerUpdates();
      const saved = await saveServerUpdates(current.filter(update => update.id !== id));
      setUpdates(saved);
      window.dispatchEvent(new Event('updates-updated'));
      toast.success('업데이트가 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete update:', error);
      toast.error('업데이트 삭제에 실패했습니다');
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    await logout();
    window.location.assign('/login');
  };

  const runMarketplaceAlertTest = async () => {
    if (!currentMember) return;
    const alert: MarketplaceRequestAlert = {
      id: `marketplace-alert-preview-${Date.now()}`,
      recipientMemberId: currentMember.id,
      kind: 'hench-sell',
      title: '새 구매 요청',
      body: '알림 테스트님이 로엘 · 1마리 거래를 요청했습니다.',
      targetName: '로엘',
      actorName: '알림 테스트',
      createdAt: Date.now(),
    };
    window.dispatchEvent(new CustomEvent<MarketplaceRequestAlert>(MARKETPLACE_ALERT_TEST_EVENT, { detail: alert }));
    try {
      const response = await fetch('/api/admin/mobile/push-test', { method: 'POST' });
      const result = await response.json().catch(() => null) as { reason?: string; registeredDeviceCount?: number } | null;
      if (response.status === 409 && result?.reason === 'no-registered-device') {
        toast.warning('등록된 Android 기기가 없습니다. v1.0.6 앱을 설치하고 로그인·알림 허용 후 다시 테스트해 주세요.');
        return;
      }
      if (!response.ok) throw new Error('Android 푸시 테스트 요청 실패');
      toast.success(`카드·알림음을 표시했고 등록된 Android 기기 ${result?.registeredDeviceCount || 1}대로 시스템 푸시를 요청했습니다.`);
    } catch (error) {
      console.error('Failed to send Android push test:', error);
      toast.warning('화면 카드·알림음만 표시했습니다. Android 푸시는 앱 로그인 후 다시 확인해 주세요.');
    }
  };

  if (currentMember?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-cyan-300 mb-3 text-center">관리자 권한 필요</h1>
          <p className="text-center text-sm text-slate-400">이 페이지는 초기 관리자 계정으로 로그인한 사용자만 이용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="admin-dashboard" className="abyss-admin-page abyss-admin-high-contrast min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-cyan-300">관리자 대시보드</h1>
            <p className="text-xs sm:text-sm text-slate-400">몬스터 및 조합법 관리</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              onClick={() => void runMarketplaceAlertTest()}
              variant="outline"
              size="sm"
              className="gap-2 border-violet-400/45 bg-violet-500/10 text-violet-100 hover:bg-violet-400/20 hover:text-white"
            >
              <BellRing className="h-4 w-4" />
              <span className="hidden sm:inline">알림 테스트</span>
              <span className="sm:hidden">알림</span>
            </Button>
            <Button
              onClick={() => window.location.assign('/')}
              variant="outline"
              size="sm"
              className="gap-2 border-cyan-400/35 text-cyan-100 hover:bg-cyan-400/10 hover:text-cyan-50"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">사이트로 전환</span>
              <span className="sm:hidden">사이트</span>
            </Button>
            <Button
              onClick={() => void handleLogout()}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-[calc(100vh-4.5rem)] w-full flex-row gap-0">
          <aside data-testid="admin-left-navigation" className="sticky top-[73px] hidden h-[calc(100vh-4.5rem)] w-64 shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-950/95 p-3 md:block">
            <p className="px-3 pb-2 pt-1 text-[11px] font-black tracking-[0.14em] text-cyan-300">ADMIN MENU</p>
            <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
              {ADMIN_NAV_ITEMS.map((item) => <TabsTrigger key={item.value} value={item.value} className="h-auto min-h-11 flex-none justify-start rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-300 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950">{item.label}</TabsTrigger>)}
            </TabsList>
            <div className="mt-4 border-t border-slate-700/80 pt-3">
              <a href="/" className="flex items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2.5 text-sm font-extrabold text-cyan-100 transition hover:bg-cyan-400/20">
                <Home className="h-4 w-4" /> 사이트로 전환
              </a>
            </div>
          </aside>
          <section className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-4 md:hidden">
              <label className="sr-only" htmlFor="admin-mobile-menu">관리자 메뉴</label>
              <select id="admin-mobile-menu" value={activeTab} onChange={(event) => setActiveTab(event.target.value)} className="w-full rounded-xl border border-cyan-400/30 bg-slate-900 px-3 py-3 text-sm font-extrabold text-cyan-100">
                {ADMIN_NAV_ITEMS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

          <TabsContent value="members" className="space-y-4">
            <MemberManagement embedded />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecurityAlertsPanel />
          </TabsContent>

          <TabsContent value="online" className="space-y-4">
            <OnlineMembersPanel />
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <ItemCatalogAdminPanel />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <MarketplaceHistoryAdminPanel />
          </TabsContent>

          <TabsContent value="price-protection" className="space-y-4">
            <MarketplacePriceProtectionAdminPanel />
          </TabsContent>

          {/* 피드백 관리 탭 */}
          <TabsContent value="feedback" className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-cyan-300">사용자 건의사항</h2>
              <p className="text-sm text-slate-400">사용자들이 제출한 오류 보고 및 건의사항을 확인할 수 있습니다.</p>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {feedbacks.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p>아직 등록된 건의사항이 없습니다.</p>
                  </div>
                ) : feedbacks.map((feedback) => (
                  <div key={feedback.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            feedback.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {feedback.type === 'error' ? '오류' : '건의'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            feedback.status === 'completed' ? 'bg-green-500/20 text-green-300' : feedback.status === 'reviewing' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {feedback.status === 'completed' ? '완료' : feedback.status === 'reviewing' ? '검토중' : '접수'}
                          </span>
                          <span className="text-xs text-slate-400">{feedback.email}</span>
                        </div>
                        <h4 className="font-semibold text-cyan-300">{feedback.title}</h4>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(feedback.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap mb-3">{feedback.content}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleFeedbackStatus(feedback.id, 'reviewing')}
                        disabled={feedback.status === 'reviewing'}
                        className="text-xs gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        검토중
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleFeedbackStatus(feedback.id, 'completed')}
                        disabled={feedback.status === 'completed'}
                        className="text-xs gap-1 bg-green-500/10 hover:bg-green-500/20"
                      >
                        <Check className="h-3 w-3" />
                        완료
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 데이터 관리 탭 */}
          <TabsContent value="data" className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-cyan-300">데이터 임포트/엑스포트</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 엑스포트 */}
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-200">데이터 엑스포트</h3>
                  <p className="text-sm text-slate-400">현재 몬스터 데이터를 엑셀 파일로 다운로드합니다.</p>
                  <Button
                    onClick={handleExportExcel}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4" />
                    엑셀 다운로드
                  </Button>
                </div>

                {/* 임포트 */}
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-200">데이터 임포트</h3>
                  <p className="text-sm text-slate-400">엑셀 파일을 업로드하여 데이터를 업데이트합니다.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Upload className="h-4 w-4" />
                    파일 업로드
                  </Button>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm text-amber-200">
                  💡 <strong>팁:</strong> 엑셀 파일의 첫 번째 행은 헤더(이름, 기본레벨, 최대레벨 등)이어야 하며, 두 번째 행부터 데이터가 시작되어야 합니다.
                </p>
              </div>

              {pendingImportedMonsters && (
                <section className="space-y-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-cyan-200">득코 여부 사전 검증</h3>
                      <p className="text-sm text-slate-400">업로드 파일 {pendingImportedMonsters.length}건을 현재 서버 데이터와 비교했습니다.</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pendingImportMismatches.length > 0 ? 'bg-amber-500/20 text-amber-200' : 'bg-green-500/20 text-green-200'}`}>
                      불일치 {pendingImportMismatches.length}건
                    </span>
                  </div>
                  {pendingImportMismatches.length > 0 ? (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-700 bg-slate-950/50 p-3">
                      {pendingImportMismatches.map((mismatch) => (
                        <p key={mismatch.id} className="text-sm text-slate-200"><strong className="text-cyan-200">{mismatch.name}</strong>: 현재 {mismatch.current === '0' ? '가능' : '불가능'} → 엑셀 {mismatch.incoming === '0' ? '가능' : '불가능'}</p>
                      ))}
                    </div>
                  ) : <p className="text-sm text-green-200">현재 데이터와 이름이 같은 헨치의 득코 여부 불일치가 없습니다.</p>}
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => { setPendingImportedMonsters(null); setPendingImportMismatches([]); }}>취소</Button>
                    <Button type="button" onClick={() => void confirmImportedMonsters()} className="bg-green-600 hover:bg-green-500">검토 후 데이터 반영</Button>
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          {/* 업데이트 관리 탭 */}
          <TabsContent value="updates" className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-cyan-300">업데이트 관리</h2>
              <p className="text-sm text-slate-400">새로운 업데이트를 추가하면 업데이트 탭에 실시간으로 반영됩니다.</p>
              
              {/* 업데이트 추가 폼 */}
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-slate-200">새 업데이트 추가</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="버전 (예: v2.6.0)"
                      value={newUpdateVersion}
                      onChange={(e) => setNewUpdateVersion(e.target.value)}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <Input
                      placeholder="제목"
                      value={newUpdateTitle}
                      onChange={(e) => setNewUpdateTitle(e.target.value)}
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>
                  <Input
                    placeholder="설명"
                    value={newUpdateDescription}
                    onChange={(e) => setNewUpdateDescription(e.target.value)}
                    className="bg-slate-800/50 border-slate-700"
                  />
                  <textarea
                    placeholder="변경사항 (줄바꿈으로 구분)"
                    value={newUpdateChanges}
                    onChange={(e) => setNewUpdateChanges(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    rows={4}
                  />
                  <select
                    value={newUpdateType}
                    onChange={(e) => setNewUpdateType(e.target.value as 'feature' | 'fix' | 'improvement')}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="feature">새 기능</option>
                    <option value="fix">버그 수정</option>
                    <option value="improvement">개선</option>
                  </select>
                  <Button
                    onClick={handleAddUpdate}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4" />
                    업데이트 추가
                  </Button>
                </div>
              </div>

              {/* 업데이트 목록 */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(() => {
                  if (updates.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-400">
                        <p>등록된 업데이트가 없습니다.</p>
                      </div>
                    );
                  }
                  return updates.map((update: any) => (
                    <div key={update.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              update.type === 'feature' 
                                ? 'bg-blue-500/20 text-blue-300' 
                                : update.type === 'fix'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}>
                              {update.type === 'feature' ? '새 기능' : update.type === 'fix' ? '버그 수정' : '개선'}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold">{update.version}</span>
                          </div>
                          <h4 className="font-semibold text-cyan-300">{update.title}</h4>
                          <p className="text-sm text-slate-400 mt-1">{update.description}</p>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{update.date}</span>
                      </div>
                      {normalizeChanges(update.changes).length > 0 && (
                        <ul className="text-xs text-slate-400 space-y-1 mt-2 ml-2">
                          {normalizeChanges(update.changes).map((change: string, idx: number) => (
                            <li key={idx}>• {change}</li>
                          ))}
                        </ul>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDeleteUpdate(update.id)}
                        className="text-xs gap-1 mt-3 text-red-300 hover:text-red-200"
                      >
                        <Trash2 className="h-3 w-3" />
                        삭제
                      </Button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </TabsContent>

          {/* 몬스터 관리 탭 */}
          <TabsContent value="monsters" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Input
                placeholder="몬스터 이름 또는 서식지 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-800/50 border-slate-700"
              />
              <Button
                onClick={handleAddMonster}
                className="gap-2 bg-green-600 hover:bg-green-700 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                추가
              </Button>
              <Button
                onClick={handleSaveData}
                className="gap-2 bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
              >
                저장
              </Button>
            </div>

            <section className="space-y-3 rounded-lg border border-cyan-500/30 bg-slate-800/50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-cyan-200">선택 헨치 일괄 수정</h3>
                  <p className="text-xs text-slate-400">목록에서 여러 헨치를 선택한 뒤 득코 여부와 서식지를 한 번에 변경합니다.</p>
                </div>
                <span className="text-sm font-semibold text-cyan-300">{selectedMonsterIds.size}개 선택</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto]">
                <Button type="button" variant="outline" onClick={selectVisibleMonsters}>
                  {filteredMonsters.length > 0 && filteredMonsters.every((monster) => selectedMonsterIds.has(String(monster.id))) ? '검색 결과 선택 해제' : '검색 결과 전체 선택'}
                </Button>
                <select aria-label="일괄 득코 여부" value={bulkAcquired} onChange={(event) => setBulkAcquired(event.target.value as '__keep__' | '0' | 'x')} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                  <option value="__keep__">득코 여부 유지</option>
                  <option value="0">득코 가능으로 변경</option>
                  <option value="x">득코 불가능으로 변경</option>
                </select>
                <div className="flex items-center gap-2">
                  <Input aria-label="일괄 서식지" value={bulkHabitat} onChange={(event) => setBulkHabitat(event.target.value)} placeholder="변경할 서식지 (비우면 유지)" disabled={clearBulkHabitat} className="bg-slate-900 border-slate-700 disabled:opacity-50" />
                </div>
                <Button type="button" onClick={() => void handleBulkMonsterEdit()} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">일괄 반영</Button>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-700/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={clearBulkHabitat} onChange={(event) => setClearBulkHabitat(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-900" />
                  선택한 헨치의 서식지를 비우기 (위 "일괄 반영" 버튼 클릭 시 적용)
                </label>
                <Button type="button" variant="outline" onClick={() => void handleClearAllHabitats()} className="border-rose-700 text-rose-300 hover:bg-rose-950 hover:text-rose-200">
                  전체 헨치 서식지 일괄 삭제 (선택과 무관하게 전부)
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-cyan-500/30 bg-slate-800/50 p-4">
              <div>
                <h3 className="font-semibold text-cyan-200">헨치 이미지 일괄 업로드</h3>
                <p className="text-xs text-slate-400">파일 이름을 헨치 이름과 똑같이 맞춰서 여러 장을 한 번에 선택하면, 이름이 일치하는 헨치에 자동으로 적용돼요. (예: "마신 드래곤.png" → "마신드래곤" 헨치, 띄어쓰기는 무시하고 비교해요)</p>
              </div>
              <input
                ref={bulkImageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) void handleBulkImageUpload(files);
                }}
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={() => bulkImageInputRef.current?.click()} disabled={bulkUploading} className="gap-2 text-xs">
                <Upload className="h-3 w-3" />
                {bulkUploading ? '업로드 중...' : '이미지 여러 장 선택'}
              </Button>
              {bulkResults.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-700 bg-slate-900/60 p-2 text-xs">
                  {bulkResults.map((entry, index) => (
                    <div key={`${entry.fileName}-${index}`} className={entry.status === 'success' ? 'text-green-400' : entry.status === 'unmatched' ? 'text-amber-400' : 'text-red-400'}>
                      {entry.status === 'success' && `✓ ${entry.fileName} → ${entry.monsterName}`}
                      {entry.status === 'unmatched' && `⚠ ${entry.fileName} — 일치하는 헨치 없음`}
                      {entry.status === 'error' && `✗ ${entry.fileName} — ${entry.message}`}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 몬스터 목록 */}
            <div data-testid="admin-monster-list" className="space-y-2 max-h-96 overflow-y-auto">
              {visibleMonsters.map((monster) => (
                <div
                  key={monster.id}
                  data-testid="admin-monster-row"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" aria-label={`${monster.name} 선택`} checked={selectedMonsterIds.has(String(monster.id))} onChange={() => toggleMonsterSelection(String(monster.id))} className="h-4 w-4 rounded border-slate-600 text-cyan-500" />
                    <div className="min-w-0">
                      <p className="font-medium text-cyan-300 truncate">{monster.name}</p>
                      <p className="text-xs text-slate-400">
                        Lv.{monster.baseLevel}~{monster.maxLevel} | {monster.attribute} | 득코 {monster.acquired === '0' ? '가능' : '불가능'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => {
                        setEditingMonster(monster);
                        setImageOptimization(null);
                      }}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      수정
                    </Button>
                    <Button
                      onClick={() => setMonsterToDelete(monster)}
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {visibleMonsters.length < filteredMonsters.length && (
              <Button type="button" variant="outline" className="w-full" onClick={() => setVisibleMonsterCount((current) => current + ADMIN_MONSTER_PAGE_SIZE)}>
                더 보기 ({visibleMonsters.length}/{filteredMonsters.length})
              </Button>
            )}

            {/* 수정 폼 */}
            {editingMonster && (
              <div className="bg-slate-800/50 border border-cyan-500/50 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-cyan-300">몬스터 수정</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300">이름</label>
                    <Input
                      value={editingMonster.name}
                      onChange={(e) => setEditingMonster({ ...editingMonster, name: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">속성</label>
                    <Input
                      value={editingMonster.attribute}
                      onChange={(e) => setEditingMonster({ ...editingMonster, attribute: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">장코/단코</label>
                    <select
                      value={editingMonster.type || '장코'}
                      onChange={(e) => setEditingMonster({ ...editingMonster, type: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-1 text-xs text-slate-100"
                    >
                      <option value="장코">장코</option>
                      <option value="단코">단코</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">최소 레벨</label>
                    <Input
                      type="number"
                      value={editingMonster.baseLevel}
                      onChange={(e) => setEditingMonster({ ...editingMonster, baseLevel: parseInt(e.target.value) })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">최대 레벨</label>
                    <Input
                      type="number"
                      value={editingMonster.maxLevel}
                      onChange={(e) => setEditingMonster({ ...editingMonster, maxLevel: parseInt(e.target.value) })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-300">서식지</label>
                    <Input
                      value={editingMonster.habitat}
                      onChange={(e) => setEditingMonster({ ...editingMonster, habitat: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">Main</label>
                    <Input
                      value={editingMonster.main || ''}
                      onChange={(e) => setEditingMonster({ ...editingMonster, main: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">Sub</label>
                    <Input
                      value={editingMonster.sub || ''}
                      onChange={(e) => setEditingMonster({ ...editingMonster, sub: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">Main2</label>
                    <Input
                      value={editingMonster.main2 || ''}
                      onChange={(e) => setEditingMonster({ ...editingMonster, main2: e.target.value || null })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">Sub2</label>
                    <Input
                      value={editingMonster.sub2 || ''}
                      onChange={(e) => setEditingMonster({ ...editingMonster, sub2: e.target.value || null })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">득코 여부</label>
                    <select
                      value={editingMonster.acquired}
                      onChange={(e) => setEditingMonster({ ...editingMonster, acquired: e.target.value })}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      <option value="0">가능</option>
                      <option value="x">불가능</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">X데이터 필요 수량</label>
                    <Input
                      type="number"
                      min="0"
                      value={editingMonster.xAntibody || 0}
                      onChange={(e) => setEditingMonster({ ...editingMonster, xAntibody: parseInt(e.target.value) || 0 })}
                      className="bg-slate-700/50 border-slate-600 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-300">헨치 이미지</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="text-xs gap-1"
                      >
                        <Upload className="h-3 w-3" />
                        {uploadingImage ? '업로드 중...' : '이미지 선택'}
                      </Button>
                      {editingMonster.imageUrl && (
                        <span className="text-xs text-green-400">✓ 이미지 업로드됨</span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">원본은 최대 20MB까지 선택할 수 있으며, 긴 변 2048px·WebP 95% 품질을 우선 보존해 최대 6MB로 최적화됩니다.</p>
                    {imageOptimization && (
                      <p className="mt-1 text-[11px] text-cyan-300">
                        고화질 처리 완료: {formatFileSize(imageOptimization.originalBytes)} → {formatFileSize(imageOptimization.optimizedBytes)} · {imageOptimization.width}×{imageOptimization.height}px WebP 95%
                      </p>
                    )}
                    {editingMonster.imageUrl && (
                      <div className="mt-2">
                        <img
                          src={editingMonster.imageUrl}
                          alt="Preview"
                          className="h-16 w-16 object-cover rounded border border-slate-600"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUpdateMonster(editingMonster)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    저장
                  </Button>
                  <Button
                    onClick={() => setEditingMonster(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 조합법 관리 탭 */}
          <TabsContent value="recipes" className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-300 mb-4">조합법 관리</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {visibleRecipeMonsters.map((monster) => (
                    <div
                      key={monster.id}
                      className="bg-slate-700/50 rounded p-3 text-xs"
                    >
                      <p className="font-medium text-cyan-300">{monster.name}</p>
                      <p className="text-slate-400">
                        Main: {monster.main} | Sub: {monster.sub}
                        {monster.main2 && ` | Main2: ${monster.main2}`}
                        {monster.sub2 && ` | Sub2: ${monster.sub2}`}
                      </p>
                    </div>
                  ))}
              </div>
              {visibleRecipeMonsters.length < recipeMonsters.length && (
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setVisibleRecipeCount((current) => current + ADMIN_RECIPE_PAGE_SIZE)}>
                  조합법 더 보기 ({visibleRecipeMonsters.length}/{recipeMonsters.length})
                </Button>
              )}
            </div>
          </TabsContent>

          {/* 사이트 설정 탭 */}
          <TabsContent value="settings" className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">사이트 제목</label>
                <Input
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  className="bg-slate-700/50 border-slate-600"
                  placeholder="사이트 제목을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">로고 URL</label>
                <Input
                  value={siteLogo}
                  onChange={(e) => setSiteLogo(e.target.value)}
                  className="bg-slate-700/50 border-slate-600"
                  placeholder="로고 이미지 URL을 입력하세요"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">주 색상</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-slate-700/50 border-slate-600"
                      placeholder="#06b6d4"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">보조 색상</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 bg-slate-700/50 border-slate-600"
                      placeholder="#0f172a"
                    />
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSaveSiteSettings}
                className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2"
              >
                <Check className="h-4 w-4" />
                설정 저장
              </Button>
            </div>
            <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div>
                <h2 className="text-lg font-bold text-cyan-300">어비스거래소 탭 사용 관리</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">스위치를 끄면 일반 회원에게 해당 거래소 탭이 숨겨지고, 조회·거래 요청 API도 차단됩니다. 관리자는 설정을 확인·관리할 수 있습니다.</p>
              </div>
              <div className="mt-5 divide-y divide-slate-700/80 rounded-lg border border-slate-700 bg-slate-900/45">
                {MARKETPLACE_TAB_CONTROLS.map((control) => {
                  const enabled = marketplaceTabSettings[control.key];
                  const saving = savingMarketplaceTabKey === control.key;
                  return <div key={control.key} className="flex items-center justify-between gap-4 px-4 py-4">
                    <div className="min-w-0"><p className="font-semibold text-slate-100">{control.title}</p><p className="mt-1 text-sm leading-5 text-slate-400">{control.description}</p></div>
                    <div className="flex shrink-0 items-center gap-3"><span className={enabled ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-rose-300'}>{saving ? '저장 중' : enabled ? '사용 중' : '중지됨'}</span><Switch aria-label={`${control.title} 사용 전환`} checked={enabled} disabled={savingMarketplaceTabKey !== null} onCheckedChange={(checked) => void handleMarketplaceTabToggle(control.key, checked)} /></div>
                  </div>;
                })}
              </div>
            </section>
          </TabsContent>
          </section>
        </Tabs>

        <AlertDialog open={Boolean(monsterToDelete)} onOpenChange={(open) => { if (!open && !isDeletingMonster) setMonsterToDelete(null); }}>
          <AlertDialogContent className="border-red-500/30 bg-slate-950 text-slate-100">
            <AlertDialogHeader>
              <AlertDialogTitle>헨치 삭제를 다시 확인하세요</AlertDialogTitle>
              <AlertDialogDescription className="leading-6 text-slate-400">
                <strong className="text-red-200">{monsterToDelete?.name}</strong> 헨치를 삭제하면 믹스법과 목록에서 즉시 사라집니다. 정말 삭제하시겠습니까?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingMonster} className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">취소</AlertDialogCancel>
              <AlertDialogAction disabled={isDeletingMonster} onClick={() => void confirmMonsterDeletion()} className="bg-red-600 text-white hover:bg-red-500">
                {isDeletingMonster ? '삭제 중...' : '삭제 계속'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 통계 */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <p className="text-slate-400 text-sm">총 몬스터</p>
            <p className="text-2xl font-bold text-cyan-300">{monsters.length}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <p className="text-slate-400 text-sm">조합법 있는 몬스터</p>
            <p className="text-2xl font-bold text-cyan-300">
              {monsters.filter(m => m.main !== '-' || m.sub !== '-').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
