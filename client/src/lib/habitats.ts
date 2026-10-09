const MULTI_HABITAT_SEPARATOR = /\s*[,，;；/／|｜·ㆍ]\s*/g;

/** Merge newly entered habitats into the existing list without removing old locations. */
export function mergeHabitats(existing: string | null | undefined, incoming: string | null | undefined) {
  const split = (value: string | null | undefined) => (value ?? '')
    .replace(/\u00a0/g, ' ')
    .split(MULTI_HABITAT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  const entries = [...split(existing), ...split(incoming)];
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(', ');
}

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
