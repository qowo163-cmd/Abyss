type MonsterRecord = Record<string, unknown>;

const acquiredOverrides = new Map<string, "0">([
  ["트위스퉁가", "0"],
]);

export function applyMonsterDataCorrections(monsters: MonsterRecord[]) {
  return monsters.map((monster) => {
    const acquired = acquiredOverrides.get(String(monster.name || "").trim());
    return acquired && monster.acquired !== acquired ? { ...monster, acquired } : monster;
  });
}
