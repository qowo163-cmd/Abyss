type MonsterRecord = Record<string, unknown>;

const acquiredOverrides = new Map<string, "0">([
  ["트위스퉁가", "0"],
]);

export function applyMonsterDataCorrections(monsters: MonsterRecord[]) {
  return monsters.map((monster) => {
    // Correct the canonical spelling everywhere it can appear: monster names,
    // recipe ingredients, and references inside the persistent Railway DB.
    let corrected: MonsterRecord = monster;
    for (const [key, value] of Object.entries(monster)) {
      if (typeof value === "string" && value.includes("건스메쉬")) {
        if (corrected === monster) corrected = { ...monster };
        corrected[key] = value.replaceAll("건스메쉬", "건스매쉬");
      }
    }
    const acquired = acquiredOverrides.get(String(corrected.name || "").trim());
    if (acquired && corrected.acquired !== acquired) {
      if (corrected === monster) corrected = { ...monster };
      corrected.acquired = acquired;
    }
    return corrected;
  });
}
