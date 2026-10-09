import { describe, expect, it } from 'vitest';
import { hasHabitat, splitHabitats } from './habitats';

describe('multi-habitat normalization', () => {
  it('separates comma-delimited habitats into independently selectable entries', () => {
    expect(splitHabitats('바로크 145lv~, 엘리시움 5층, 짐승의 구역 5층')).toEqual([
      '바로크 145lv~',
      '엘리시움 5층',
      '짐승의 구역 5층',
    ]);
  });

  it('trims whitespace, removes duplicates, and preserves a usable unknown option', () => {
    expect(splitHabitats('  짐승의 구역 5층 , 짐승의 구역 5층 ,  바로크 145lv~ ')).toEqual(['짐승의 구역 5층', '바로크 145lv~']);
    expect(splitHabitats('')).toEqual(['서식지 미상']);
  });

  it('matches one monster under each individual habitat instead of only its combined source text', () => {
    const habitat = '바로크 145lv~, 엘리시움 5층, 짐승의 구역 5층';
    expect(hasHabitat(habitat, '엘리시움 5층')).toBe(true);
    expect(hasHabitat(habitat, '짐승의 구역 5층')).toBe(true);
    expect(hasHabitat(habitat, '바로크 100lv~')).toBe(false);
    expect(hasHabitat(habitat, '__all__')).toBe(true);
  });
});
