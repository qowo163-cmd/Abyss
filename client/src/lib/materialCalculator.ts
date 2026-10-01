export interface MaterialRecipeMonster {
  id: string;
  name: string;
  baseLevel?: number;
  main?: string | null;
  sub?: string | null;
  main2?: string | null;
  sub2?: string | null;
}

export interface MaterialRecipeOption {
  index: number;
  main: string;
  sub: string;
}

export type MaterialCounts = Record<string, number>;
export type RecipeSelections = Record<string, number>;

const TARGET_LEVEL_MIN = 140;
const TARGET_LEVEL_MAX = 169;

export function normalizeRecipeName(value: string): string {
  return value.replace(/\s*\[\d+\]\s*$/, "").trim();
}

function isUsableIngredient(value: string | null | undefined): value is string {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized && normalized !== "-");
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

/**
 * main + sub를 하나의 조합법으로, main2 + sub2를 두 번째 조합법으로 해석한다.
 * 데이터가 한쪽만 존재하는 비정상/부분 데이터도 최대한 안전하게 처리한다.
 */
export function getRecipeOptions(monster: MaterialRecipeMonster): MaterialRecipeOption[] {
  const options: MaterialRecipeOption[] = [];
  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [monster.main, monster.sub],
    [monster.main2, monster.sub2],
  ];

  pairs.forEach(([main, sub], index) => {
    if (!isUsableIngredient(main) && !isUsableIngredient(sub)) return;
    if (!isUsableIngredient(main) || !isUsableIngredient(sub)) return;
    options.push({ index, main: normalizeRecipeName(main), sub: normalizeRecipeName(sub) });
  });

  return options;
}

function selectedRecipeIndex(monster: MaterialRecipeMonster, selections?: RecipeSelections): number {
  const options = getRecipeOptions(monster);
  if (options.length === 0) return 0;
  const raw = Number(selections?.[monster.id]);
  const requested = Number.isInteger(raw) ? raw : 0;
  return options.some((option) => option.index === requested) ? requested : options[0].index;
}

function recipeIngredients(monster: MaterialRecipeMonster, selections?: RecipeSelections): string[] {
  const options = getRecipeOptions(monster);
  if (options.length === 0) return [];
  const option = options.find((candidate) => candidate.index === selectedRecipeIndex(monster, selections)) || options[0];
  return [option.main, option.sub].filter(isUsableIngredient);
}

/**
 * 현재 선택된 조합 경로에서, 사용자가 조합법을 골라야 하는 모든 헨치를 반환한다.
 * 140~169 레벨 재료는 더 펼치지 않는다.
 */
export function collectRecipeChoices(
  monsters: MaterialRecipeMonster[],
  selectedMonster: MaterialRecipeMonster,
  selections: RecipeSelections = {},
): MaterialRecipeMonster[] {
  const choices: MaterialRecipeMonster[] = [];
  const visited = new Set<string>();

  const walk = (monster: MaterialRecipeMonster, ancestry: Set<string>) => {
    const key = monster.id || monster.name;
    if (ancestry.has(key) || visited.has(key)) return;
    visited.add(key);

    const options = getRecipeOptions(monster);
    if (options.length > 1) choices.push(monster);
    if (isTargetLevel(monster)) return;

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(key);
    recipeIngredients(monster, selections).forEach((ingredient) => {
      const child = findMonster(monsters, ingredient);
      if (child) walk(child, nextAncestry);
    });
  };

  walk(selectedMonster, new Set());
  return choices;
}

/**
 * 선택한 헨치를 만들기 위해 필요한 140~169 레벨의 최종 재료 헨치를
 * 선택한 조합 경로대로 재귀적으로 따라가며 집계한다.
 *
 * - 140~169: 실제 준비 재료로 집계
 * - 140 미만: 다음 조합법으로 계속 펼침
 * - 170 이상: 결과에 포함하지 않음
 * - 복수 조합법: recipeSelections로 선택한 조합을 사용 (없으면 첫 번째)
 */
export function calculateMaterialCounts(
  monsters: MaterialRecipeMonster[],
  selectedMonster: MaterialRecipeMonster,
  quantity = 1,
  recipeSelections: RecipeSelections = {},
): MaterialCounts {
  const counts: MaterialCounts = {};
  const root = monsters.find((monster) => monster.id === selectedMonster.id) ?? selectedMonster;

  const add = (name: string) => {
    counts[name] = (counts[name] || 0) + quantity;
  };

  const walkIngredient = (ingredient: string, ancestry: Set<string>) => {
    const material = findMonster(monsters, ingredient);
    if (!material) return;

    const materialKey = material.id || material.name;
    if (ancestry.has(materialKey)) return;

    if (isTargetLevel(material)) {
      add(material.name);
      return;
    }

    // 170 이상 결과 헨치를 재료로 직접 요구하는 경우는 표시하지 않는다.
    if (Number(material.baseLevel) >= TARGET_LEVEL_MAX + 1) return;

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(materialKey);
    recipeIngredients(material, recipeSelections).forEach((nextIngredient) => walkIngredient(nextIngredient, nextAncestry));
  };

  const rootKey = root.id || root.name;
  recipeIngredients(root, recipeSelections).forEach((ingredient) => walkIngredient(ingredient, new Set([rootKey])));
  return counts;
}
