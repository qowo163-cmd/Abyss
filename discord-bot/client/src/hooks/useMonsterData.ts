import { useSyncExternalStore } from 'react';
import type { Monster } from '@/types/monster';
import defaultMonsters from '@/data/monsters.json';

const VALID_MONSTER_TYPES = new Set(['장코', '단코']);

function normalizeMonsterName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

const defaultMonsterTypesById = new Map(
  (defaultMonsters as Monster[]).map((monster) => [String(monster.id), monster.type]),
);
const defaultMonsterTypesByName = new Map(
  (defaultMonsters as Monster[]).map((monster) => [normalizeMonsterName(monster.name), monster.type]),
);

function enrichMonsterTypes(monsters: Monster[]): Monster[] {
  return monsters.map((monster) => {
    const currentType = String(monster.type ?? '').trim();
    if (VALID_MONSTER_TYPES.has(currentType)) {
      return currentType === monster.type ? monster : { ...monster, type: currentType };
    }

    const fallbackType =
      defaultMonsterTypesById.get(String(monster.id)) ??
      defaultMonsterTypesByName.get(normalizeMonsterName(monster.name));

    return VALID_MONSTER_TYPES.has(String(fallbackType ?? '').trim())
      ? { ...monster, type: String(fallbackType).trim() }
      : monster;
  });
}

const POLL_INTERVAL_MS = 60_000;
let snapshot: Monster[] = [];
let signature = JSON.stringify(snapshot);
let timer: number | undefined;
let eventSource: EventSource | undefined;
let fetching = false;
let etag: string | null = null;
const listeners = new Set<() => void>();

function protectCachedImageUrls(next: Monster[]): Monster[] {
  return next.map((monster) => {
    const imageUrl = monster.imageUrl;
    if (!imageUrl?.startsWith('/manus-storage/')) return monster;
    const key = imageUrl.slice('/manus-storage/'.length);
    const imageVersion = typeof monster.imageVersion === 'number' && Number.isFinite(monster.imageVersion)
      ? String(monster.imageVersion)
      : '';
    const query = new URLSearchParams({ key });
    if (imageVersion) query.set('v', imageVersion);
    return { ...monster, imageUrl: `/api/monster-image?${query.toString()}` };
  });
}

function updateSnapshot(next: Monster[]) {
  const enrichedNext = enrichMonsterTypes(next);
  const protectedNext = protectCachedImageUrls(enrichedNext);
  const nextSignature = JSON.stringify(protectedNext);
  if (nextSignature === signature) return;
  snapshot = protectedNext;
  signature = nextSignature;
  localStorage.setItem('monsters', signature);
  listeners.forEach(listener => listener());
}

export function replaceMonsterData(next: Monster[]) {
  etag = null;
  updateSnapshot(next);
  window.dispatchEvent(new CustomEvent('monsters-updated', { detail: next }));
}

async function refreshMonsters() {
  if (fetching || document.visibilityState === 'hidden') return;
  fetching = true;
  try {
    const response = await fetch('/api/monsters', {
      cache: 'no-cache',
      headers: etag ? { 'If-None-Match': etag } : undefined,
    });
    if (response.status === 304) return;
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    etag = response.headers.get('ETag') || etag;
    const data = await response.json();
    if (Array.isArray(data)) updateSnapshot(data as Monster[]);
  } catch (error) {
    console.error('Failed to refresh monster data:', error);
  } finally {
    fetching = false;
  }
}

function startPolling() {
  try {
    const stored = localStorage.getItem('monsters');
    if (stored) updateSnapshot(JSON.parse(stored) as Monster[]);
  } catch {
    // 기본 데이터로 계속 표시합니다.
  }
  void refreshMonsters();
  timer = window.setInterval(() => void refreshMonsters(), POLL_INTERVAL_MS);
  if (typeof EventSource !== 'undefined') {
    eventSource = new EventSource('/api/monsters/events');
    eventSource.addEventListener('monsters', (event) => {
      try {
        const next = JSON.parse((event as MessageEvent<string>).data);
        if (Array.isArray(next)) {
          etag = null;
          updateSnapshot(next as Monster[]);
        }
      } catch {
        // 잘못된 실시간 이벤트는 무시하고 폴링으로 다시 동기화합니다.
      }
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) startPolling();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
    if (listeners.size === 0 && eventSource) {
      eventSource.close();
      eventSource = undefined;
    }
  };
}

export function useMonsterData(): Monster[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => []);
}
