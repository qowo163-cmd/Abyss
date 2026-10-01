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

const TARGET_LEVEL_MIN = 140;
const TARGET_LEVEL_MAX = 169;

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
 * 선택한 헨치를 만들기 위해 필요한 140~169 레벨의 최종 재료 헨치를
 * 레시피 트리 끝까지 재귀적으로 따라가며 집계한다.
 * 140~169 레벨에 도달한 헨치는 실제 준비 재료로 취급하고,
 * 140 미만은 계속 레시피를 펼치며 170 이상은 결과에 포함하지 않는다.
 * 레시피 문자열의 단계 표기([5] 등)는 헨치 레벨로 오인하지 않고 이름 매칭에만 사용한다.
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
