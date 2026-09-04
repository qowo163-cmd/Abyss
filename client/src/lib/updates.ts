export type UpdateType = 'feature' | 'fix' | 'improvement';

export interface UpdateItem {
  id: string;
  date: string;
  version: string;
  title: string;
  description: string;
  changes: string[];
  type: UpdateType;
}

export function normalizeChanges(changes: unknown): string[] {
  if (Array.isArray(changes)) return changes.map(String).filter(Boolean);
  if (typeof changes === 'string') return changes.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  return [];
}

export function normalizeUpdate(value: any): UpdateItem | null {
  if (!value || typeof value !== 'object' || !value.id || !value.title) return null;
  const type = value.type === 'fix' || value.type === 'improvement' ? value.type : 'feature';
  return {
    id: String(value.id),
    date: String(value.date || new Date().toISOString()),
    version: String(value.version || '업데이트'),
    title: String(value.title),
    description: String(value.description || ''),
    changes: normalizeChanges(value.changes),
    type,
  };
}

export function normalizeUpdates(values: unknown): UpdateItem[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap(value => {
    const normalized = normalizeUpdate(value);
    return normalized ? [normalized] : [];
  });
}

export function readLocalUpdates(): UpdateItem[] {
  try {
    return normalizeUpdates(JSON.parse(localStorage.getItem('updates') || '[]'));
  } catch {
    return [];
  }
}

export function mergeUpdates(...lists: UpdateItem[][]): UpdateItem[] {
  const byId = new Map<string, UpdateItem>();
  for (const list of lists) {
    for (const item of list) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const bTime = Date.parse(b.date) || 0;
    const aTime = Date.parse(a.date) || 0;
    return bTime - aTime;
  });
}

export async function fetchServerUpdates(): Promise<UpdateItem[]> {
  const response = await fetch('/api/updates', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  return normalizeUpdates(await response.json());
}

export async function saveServerUpdates(updates: UpdateItem[]): Promise<UpdateItem[]> {
  const normalized = normalizeUpdates(updates);
  const response = await fetch('/api/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  localStorage.setItem('updates', JSON.stringify(normalized));
  return normalized;
}

export async function appendServerUpdate(update: UpdateItem): Promise<UpdateItem[]> {
  const response = await fetch('/api/updates/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeUpdate(update)),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  const payload = await response.json() as { updates?: unknown };
  const normalized = normalizeUpdates(payload.updates);
  localStorage.setItem('updates', JSON.stringify(normalized));
  return normalized;
}

export function subscribeToServerUpdates(onUpdates: (updates: UpdateItem[]) => void): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => undefined;
  const source = new EventSource('/api/updates/events');
  const handleUpdates = (event: MessageEvent<string>) => {
    try {
      const updates = normalizeUpdates(JSON.parse(event.data));
      localStorage.setItem('updates', JSON.stringify(updates));
      onUpdates(updates);
    } catch {
      // 서버가 보내는 잘못된 이벤트는 현재 화면을 중단시키지 않습니다.
    }
  };
  source.addEventListener('updates', handleUpdates as EventListener);
  return () => source.close();
}
