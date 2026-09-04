export type FeedbackType = 'error' | 'suggestion';
export type FeedbackStatus = 'pending' | 'reviewing' | 'completed';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  content: string;
  email: string;
  createdAt: string;
  status: FeedbackStatus;
}

function normalizeFeedback(value: unknown): FeedbackItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<FeedbackItem>;
  if (!item.id || !item.title || !item.content) return null;
  return {
    id: String(item.id),
    type: item.type === 'error' ? 'error' : 'suggestion',
    title: String(item.title),
    content: String(item.content),
    email: String(item.email || '익명'),
    createdAt: String(item.createdAt || new Date().toISOString()),
    status: item.status === 'reviewing' || item.status === 'completed' ? item.status : 'pending',
  };
}

export function normalizeFeedbacks(values: unknown): FeedbackItem[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap(value => {
    const feedback = normalizeFeedback(value);
    return feedback ? [feedback] : [];
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export async function fetchServerFeedbacks(): Promise<FeedbackItem[]> {
  const response = await fetch('/api/feedbacks', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  return normalizeFeedbacks(await response.json());
}

export async function submitServerFeedback(feedback: FeedbackItem): Promise<FeedbackItem[]> {
  const response = await fetch('/api/feedbacks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  const payload = await response.json() as { feedbacks?: unknown };
  return normalizeFeedbacks(payload.feedbacks);
}

export async function updateServerFeedbackStatus(id: string, status: FeedbackStatus): Promise<FeedbackItem[]> {
  const response = await fetch(`/api/feedbacks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  const payload = await response.json() as { feedbacks?: unknown };
  return normalizeFeedbacks(payload.feedbacks);
}

export function subscribeToServerFeedbacks(onFeedbacks: (feedbacks: FeedbackItem[]) => void): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => undefined;
  const source = new EventSource('/api/feedbacks/events');
  const handleFeedbacks = (event: MessageEvent<string>) => {
    try {
      onFeedbacks(normalizeFeedbacks(JSON.parse(event.data)));
    } catch {
      // 잘못된 이벤트가 와도 기존 목록을 유지합니다.
    }
  };
  source.addEventListener('feedbacks', handleFeedbacks as EventListener);
  return () => source.close();
}
