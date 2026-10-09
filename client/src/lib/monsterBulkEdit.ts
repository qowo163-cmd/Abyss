import type { Monster } from '@/types/monster';
import { mergeHabitats } from './habitats';

export type AcquiredValue = '0' | 'x';

export type MonsterBulkEdit = {
  acquired?: AcquiredValue;
  habitat?: string;
  clearHabitat?: boolean;
};

export type AcquiredMismatch = {
  id: string;
  name: string;
  current: AcquiredValue;
  incoming: AcquiredValue;
};

export function normalizeAcquired(value: unknown): AcquiredValue {
  return String(value ?? '').trim().toLowerCase() === '0' ? '0' : 'x';
}

export function applyMonsterBulkEdit(monsters: Monster[], monsterIds: Iterable<string>, edit: MonsterBulkEdit) {
  const selected = new Set(Array.from(monsterIds, String));
  const habitat = edit.habitat?.trim();
  return monsters.map((monster) => {
    if (!selected.has(String(monster.id))) return monster;
    return {
      ...monster,
      ...(edit.acquired ? { acquired: edit.acquired } : {}),
      ...(edit.clearHabitat ? { habitat: '' } : habitat ? { habitat: mergeHabitats(monster.habitat, habitat) } : {}),
    };
  });
}

export function findAcquiredMismatches(currentMonsters: Monster[], incomingMonsters: Monster[]): AcquiredMismatch[] {
  const currentByName = new Map(currentMonsters.map((monster) => [monster.name.trim().toLowerCase(), monster]));
  return incomingMonsters.flatMap((incoming) => {
    const current = currentByName.get(incoming.name.trim().toLowerCase());
    if (!current) return [];
    const currentAcquired = normalizeAcquired(current.acquired);
    const incomingAcquired = normalizeAcquired(incoming.acquired);
    return currentAcquired === incomingAcquired
      ? []
      : [{ id: String(current.id), name: current.name, current: currentAcquired, incoming: incomingAcquired }];
  });
}
