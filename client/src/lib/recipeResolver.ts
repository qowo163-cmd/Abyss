export interface RecipeReferenceMonster {
  id: string;
  name: string;
}

export const RECIPE_FIELDS = ["main", "sub", "main2", "sub2"] as const;

const RECIPE_NAME_ALIASES: Record<string, string> = {
  "미라주오가몬": "미라쥬가오가몬",
  "벨루": "밸루",
  "안티비": "엔티비",
  "다크퍼브리": "다크퍼프리",
};

export function normalizeRecipeName(value: string): string {
  const withoutEnchantLevel = value.replace(/\s*\[\d+\]\s*$/, "").trim();
  return RECIPE_NAME_ALIASES[withoutEnchantLevel] ?? withoutEnchantLevel;
}

export function compactRecipeName(value: string): string {
  return normalizeRecipeName(value).replace(/\s+/g, "");
}

export function isRecipeIngredient(value: string | null | undefined): value is string {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

export function getRecipeIngredients<T extends Record<(typeof RECIPE_FIELDS)[number], string | null | undefined>>(monster: T): string[] {
  return RECIPE_FIELDS.map((field) => monster[field]).filter(isRecipeIngredient);
}

export function getRecipeEnchantLevel(value: string): number | undefined {
  const match = value.match(/\[(\d+)\]\s*$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function resolveRecipeMonster<T extends RecipeReferenceMonster>(monsters: readonly T[], recipeName: string): T | undefined {
  const normalized = normalizeRecipeName(recipeName);
  const exact = monsters.find((monster) => monster.name === normalized);
  if (exact) return exact;

  const compactName = compactRecipeName(recipeName);
  return monsters.find((monster) => compactRecipeName(monster.name) === compactName);
}
