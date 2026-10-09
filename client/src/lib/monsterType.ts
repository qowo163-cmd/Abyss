import defaultMonsters from "@/data/monsters.json";

type MonsterTypeSource = {
  id?: string | number | null;
  name?: string | null;
  type?: string | null;
};
type ValidMonsterType = "장코" | "단코";

const VALID_TYPES = new Set<ValidMonsterType>(["장코", "단코"]);
const normalizeName = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, "");
const baseRecords = defaultMonsters as Array<{ id?: string | number; name?: string; type?: string }>;
const typeById = new Map(baseRecords.map((monster) => [String(monster.id ?? ""), String(monster.type ?? "").trim()]));
const typeByName = new Map(baseRecords.map((monster) => [normalizeName(monster.name), String(monster.type ?? "").trim()]));

/** Use canonical hench data as a fallback if an older API snapshot omitted type. */
export function resolveMonsterType(monster: MonsterTypeSource | null | undefined): ValidMonsterType | null {
  if (!monster) return null;
  const current = String(monster.type ?? "").trim();
  if (VALID_TYPES.has(current as ValidMonsterType)) return current as ValidMonsterType;
  const fallback = typeById.get(String(monster.id ?? "")) || typeByName.get(normalizeName(monster.name)) || "";
  return VALID_TYPES.has(fallback as ValidMonsterType) ? fallback as ValidMonsterType : null;
}

export function monsterTypeBadgeClass(type: ValidMonsterType, size: "xs" | "sm" | "md" = "sm") {
  const sizeClass = size === "xs" ? "px-1.5 py-0.5 text-[11px]" : size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  const colorClass = type === "장코"
    ? "border-amber-300 bg-amber-100 text-amber-950"
    : "border-sky-300 bg-sky-100 text-sky-950";
  return `inline-flex items-center justify-center rounded-md border font-extrabold leading-tight shadow-sm ${sizeClass} ${colorClass}`;
}
