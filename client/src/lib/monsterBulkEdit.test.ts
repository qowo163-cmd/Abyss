import { describe, expect, it } from 'vitest';
import type { Monster } from '@/types/monster';
import { applyMonsterBulkEdit, findAcquiredMismatches } from './monsterBulkEdit';

const monsters: Monster[] = [
  { id: 'one', name: '트위스퉁가', baseLevel: 144, maxLevel: 169, attribute: '메탈', habitat: '메탈의 구역 4층', main: '-', sub: '-', main2: null, sub2: null, acquired: '0', xAntibody: 0 },
  { id: 'two', name: '뉴벤시', baseLevel: 161, maxLevel: 186, attribute: '악마', habitat: '악마의 구역 6층', main: '-', sub: '-', main2: null, sub2: null, acquired: 'x', xAntibody: 0 },
];

describe('monster bulk editing', () => {
  it('updates acquired status and habitat only for the selected monsters', () => {
    const updated = applyMonsterBulkEdit(monsters, ['one'], { acquired: 'x', habitat: '바로크 145lv~' });
    expect(updated[0]).toMatchObject({ acquired: 'x', habitat: '메탈의 구역 4층, 바로크 145lv~' });
    expect(updated[1]).toBe(monsters[1]);
  });

  it('clears habitat only when the explicit clear option is used', () => {
    const updated = applyMonsterBulkEdit(monsters, ['one'], { clearHabitat: true });
    expect(updated[0].habitat).toBe('');
    expect(updated[1].habitat).toBe('악마의 구역 6층');
  });

  it('appends new habitats for each selected monster while preserving its own existing location', () => {
    const updated = applyMonsterBulkEdit(monsters, ['one', 'two'], { habitat: '바로크 145lv~' });
    expect(updated[0].habitat).toBe('메탈의 구역 4층, 바로크 145lv~');
    expect(updated[1].habitat).toBe('악마의 구역 6층, 바로크 145lv~');
  });

  it('finds only matching-name rows whose acquired value differs before import', () => {
    const incoming = [
      { ...monsters[0], id: 'imported-1', acquired: 'x' },
      { ...monsters[1], id: 'imported-2', acquired: 'x' },
      { ...monsters[1], id: 'imported-3', name: '신규헨치', acquired: '0' },
    ];
    expect(findAcquiredMismatches(monsters, incoming)).toEqual([
      { id: 'one', name: '트위스퉁가', current: '0', incoming: 'x' },
    ]);
  });
});
