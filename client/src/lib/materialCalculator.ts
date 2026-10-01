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
 * 데이터가 한쪽만 존재하는 부분 데이터는 제외한다.
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
  const requested = Number.isInteger(raw) ? raw : options[0].index;
  return options.some((option) => option.index === requested) ? requested : options[0].index;
}

function recipeIngredients(monster: MaterialRecipeMonster, selections?: RecipeSelections): string[] {
  const options = getRecipeOptions(monster);
  if (options.length === 0) return [];
  const option = options.find((candidate) => candidate.index === selectedRecipeIndex(monster, selections)) || options[0];
  return [option.main, option.sub].filter(isUsableIngredient);
}

/**
 * 현재 선택된 조합 경로에서 조합법을 골라야 하는 모든 헨치를 반환한다.
 * 140~169 레벨 재료는 최종 재료이므로 더 펼치지 않는다.
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

    // 140~169레벨은 계산의 최종 재료이므로, 조합법이 여러 개여도
    // 그 재료의 하위 조합을 사용자에게 선택하게 하지 않는다.
    if (isTargetLevel(monster)) return;

    const options = getRecipeOptions(monster);
    if (options.length > 1) choices.push(monster);

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
 * 선택한 헨치를 만들기 위해 필요한 140~169 레벨의 최종 재료를 재귀적으로 집계한다.
 *
 * 핵심 규칙:
 * - 140~169: 최종 재료로 집계하고 더 펼치지 않는다.
 * - 140 미만: 조합법을 계속 따라간다.
 * - 170 이상: 중간 제작 헨치일 수 있으므로 조합법을 계속 따라간다.
 * - 여러 조합법: recipeSelections에 선택된 조합을 사용한다.
 *
 * 따라서 170레벨 이상인 닌자걸 같은 중간 헨치가 있어도 최종적으로
 * 140~169레벨 재료까지 내려가서 합산한다.
 */
export function calculateMaterialCounts(
  monsters: MaterialRecipeMonster[],
  selectedMonster: MaterialRecipeMonster,
  quantity = 1,
  recipeSelections: RecipeSelections = {},
): MaterialCounts {
  const counts: MaterialCounts = {};
  const root = monsters.find((monster) => monster.id === selectedMonster.id) ?? selectedMonster;
  const safeQuantity = Math.max(0, Number(quantity) || 0);

  const add = (name: string, amount = safeQuantity) => {
    if (amount <= 0) return;
    counts[name] = (counts[name] || 0) + amount;
  };

  const walkIngredient = (ingredient: string, amount: number, ancestry: Set<string>) => {
    const material = findMonster(monsters, ingredient);
    if (!material) return;

    const materialKey = material.id || material.name;
    if (ancestry.has(materialKey)) return;

    if (isTargetLevel(material)) {
      add(material.name, amount);
      return;
    }

    const childIngredients = recipeIngredients(material, recipeSelections);
    if (childIngredients.length === 0) return;

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(materialKey);

    // 한 번의 조합에서 주재료와 부재료가 각각 1마리씩 필요하므로
    // 현재 필요한 헨치 수량을 그대로 각 재료에 전달한다.
    childIngredients.forEach((nextIngredient) => walkIngredient(nextIngredient, amount, nextAncestry));
  };

  const rootIngredients = recipeIngredients(root, recipeSelections);
  if (rootIngredients.length === 0) return counts;

  const rootKey = root.id || root.name;
  rootIngredients.forEach((ingredient) => walkIngredient(ingredient, safeQuantity, new Set([rootKey])));
  return counts;
}
