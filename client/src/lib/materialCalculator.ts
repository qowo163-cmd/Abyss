export interface MaterialRecipeMonster {
  id: string;
  name: string;
  baseLevel?: number;
  main?: string | null;
  sub?: string | null;
  main2?: string | null;
  sub2?: string | null;
}

export type MaterialCounts = Record<string, number>;

const TARGET_LEVEL_MIN = 170;
const TARGET_LEVEL_MAX = 179;

export function normalizeRecipeName(value: string): string {
  return value.replace(/\s*\[\d+\]\s*$/, "").trim();
}

function findMonster(monsters: MaterialRecipeMonster[], recipeName: string): MaterialRecipeMonster | undefined {
  const normalized = normalizeRecipeName(recipeName);
  const exact = monsters.find((monster) => monster.name === normalized);
  if (exact) return exact;

  const compactName = normalized.replace(/\s+/g, "");
  return monsters.find((monster) => monster.name.replace(/\s+/g, "") === compactName);
}

function isTargetLevel(monster: MaterialRecipeMonster): boolean {
  const level = Number(monster.baseLevel);
  return level >= TARGET_LEVEL_MIN && level <= TARGET_LEVEL_MAX;
}

function recipeIngredients(monster: MaterialRecipeMonster): string[] {
  return [monster.main, monster.sub, monster.main2, monster.sub2].filter(
    (ingredient): ingredient is string => Boolean(ingredient && ingredient.trim() && ingredient !== "-"),
  );
}

/**
 * 선택한 헨치를 만들기 위해 필요한 170~179 레벨 헨치를 재귀적으로 집계한다.
 * 레시피 문자열의 단계 표기([5] 등)는 제거하고 실제 데이터의 기본 레벨을 우선 사용한다.
 */
export function calculateMaterialCounts(
  monsters: MaterialRecipeMonster[],
  selectedMonster: MaterialRecipeMonster,
  quantity = 1,
): MaterialCounts {
  const counts: MaterialCounts = {};
  const root = monsters.find((monster) => monster.id === selectedMonster.id) ?? selectedMonster;

  const add = (name: string) => {
    counts[name] = (counts[name] || 0) + quantity;
  };

  const walkIngredient = (ingredient: string, ancestry: Set<string>) => {
    const material = findMonster(monsters, ingredient);
    if (!material) {
      return;
    }

    const materialKey = material.id || material.name;
    if (ancestry.has(materialKey)) return;

    if (isTargetLevel(material)) {
      add(material.name);
      return;
    }

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(materialKey);
    recipeIngredients(material).forEach((nextIngredient) => walkIngredient(nextIngredient, nextAncestry));
  };

  const rootKey = root.id || root.name;
  recipeIngredients(root).forEach((ingredient) => walkIngredient(ingredient, new Set([rootKey])));
  return counts;
}
