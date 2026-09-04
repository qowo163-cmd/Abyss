const MULTI_HABITAT_SEPARATOR = /\s*[,，;；/／|｜·ㆍ]\s*/g;

export function splitHabitats(habitat: string | null | undefined) {
  const normalized = habitat?.replace(/\u00a0/g, " ").trim();
  if (!normalized) return ["서식지 미상"];
  return Array.from(new Set(normalized
    .split(MULTI_HABITAT_SEPARATOR)
    .map((value) => value.trim())
    .filter(Boolean)));
}

export function hasHabitat(habitat: string | null | undefined, selectedHabitat: string) {
  return selectedHabitat === "__all__" || splitHabitats(habitat).includes(selectedHabitat);
}
