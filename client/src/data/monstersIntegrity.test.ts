import { describe, expect, it } from 'vitest';
import monsters from './monsters.json';
import { getRecipeIngredients, normalizeRecipeName, resolveRecipeMonster } from '@/lib/recipeResolver';

describe('current monster data integrity', () => {
  it('keeps the 793-record import and uses the client acquired field', () => {
    expect(monsters).toHaveLength(793);
    expect(new Set(monsters.map((monster) => monster.name)).size).toBe(793);
    expect(monsters.every((monster) => monster.acquired === '0' || monster.acquired === 'x')).toBe(true);
    expect(monsters.every((monster) => !('acquire' in monster))).toBe(true);
  });

  it('keeps the validated acquire status and restored recipe spellings', () => {
    const byName = new Map(monsters.map((monster) => [monster.name, monster]));
    expect(byName.get('골든듀크')?.acquired).toBe('x');
    expect(byName.get('군주가루곤킹')?.sub).toBe('폭주버드키스 [5]');
    expect(byName.get('매드카우')).toMatchObject({ main: '밀크카우 [3]', sub: '올드매지션 [3]' });
    expect(byName.get('데빌메쉬')?.main).toBe('블루메탈 [2]');
    expect(byName.get('덤블러머')).toMatchObject({ main: '킹코뿔소 [2]', sub: '뉴벤시 [2]' });
  });

  it('resolves every registered lower-mix reference and explicitly tracks the two source-only materials', () => {
    const unresolved = monsters.flatMap((monster) =>
      getRecipeIngredients(monster)
        .filter((ingredient) => !resolveRecipeMonster(monsters, ingredient))
        .map(normalizeRecipeName),
    ).sort((left, right) => left.localeCompare(right, 'ko'));

    expect(unresolved).toEqual(['빼빼군', '빼빼양']);
  });
});
