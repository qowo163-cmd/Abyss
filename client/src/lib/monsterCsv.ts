import * as XLSX from 'xlsx';
import type { Monster } from '../types/monster';

export function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function levelValues(levelText: string): [number, number] {
  const values = levelText.match(/\d+/g)?.map(Number) ?? [];
  return [values[0] ?? 1, values[1] ?? values[0] ?? 50];
}

function nullableMaterial(value: unknown, fallback = '-'): string | null {
  const normalized = text(value);
  return normalized && normalized !== '-' ? normalized : fallback;
}

function applyVerifiedRecipeCorrections(monster: Monster): Monster {
  // 최신 원본 파일에 남아 있는 7단계 오기를 보정합니다. 동일 재료 두 마리를
  // 사용하는 뉴아르카나 계열은 모든 속성에서 둘 다 6단계가 맞습니다.
  const arcanaVariant = monster.name.match(/^뉴아르카나(드래곤|짐승|곤충|메탈|미스터리|새|식물|악마)$/);
  if (arcanaVariant) {
    const material = `아르카나${arcanaVariant[1]}`;
    if ((monster.main ?? '').trim() === `${material} [6]` && (monster.sub ?? '').trim() === `${material} [7]`) {
      return { ...monster, main: `${material} [6]`, sub: `${material} [6]` };
    }
  }
  // 동일한 커터맨티스·기와장군 재료가 같은 단계로 들어가는 뉴커터맨티스와
  // 대조해 확인한 뉴기와장군의 6단계 오기를 재업로드에서도 바로잡습니다.
  if (monster.name === '뉴기와장군') {
    return {
      ...monster,
      main: monster.main === '기와장군 [6]' ? '기와장군 [5]' : monster.main,
      sub: monster.sub === '커터맨티스 [6]' ? '커터맨티스 [5]' : monster.sub,
    };
  }
  // 블루메탈은 데빌메쉬 재료로 2단계가 맞습니다. 원본의 3단계 오기가
  // 재업로드로 되돌아오지 않도록 같은 규칙으로 보정합니다.
  if (monster.name === '데빌메쉬' && monster.main === '블루메탈 [3]') {
    return { ...monster, main: '블루메탈 [2]' };
  }
  // 매드카우 조합은 밀크카우가 메인, 올드매지션이 서브입니다.
  if (monster.name === '매드카우' && monster.main === '올드매지션 [3]' && monster.sub === '밀크카우 [3]') {
    return { ...monster, main: '밀크카우 [3]', sub: '올드매지션 [3]' };
  }
  return monster;
}

function buildMonster(values: string[], index: number): Monster | null {
  if (values.length < 5 || !values[0]) return null;
  return applyVerifiedRecipeCorrections({
    id: `imported-${Date.now()}-${index}`,
    name: values[0] || '새 몬스터',
    baseLevel: numberValue(values[1], 1),
    maxLevel: numberValue(values[2], 50),
    attribute: values[3] || '악마',
    main: values[4] || '-',
    sub: values[5] || '-',
    main2: nullableMaterial(values[6]),
    sub2: nullableMaterial(values[7]),
    acquired: values[8] || '0',
    habitat: values[9] || '',
    xAntibody: numberValue(values[10], 0),
  });
}

export function parseMonsterCsv(csv: string): Monster[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return [];

  return rows.slice(1).flatMap((values, index) => {
    const monster = buildMonster(values, index);
    return monster ? [monster] : [];
  });
}

function parseNamedRow(row: Record<string, unknown>, index: number): Monster | null {
  const name = text(row['이름'] ?? row['name'] ?? row['Name']);
  if (!name) return null;

  const [levelBase, levelMax] = levelValues(text(row['레벨'] ?? row['level']));
  const baseLevel = numberValue(row['기본레벨'] ?? row['baseLevel'], levelBase);
  const maxLevel = numberValue(row['최대레벨'] ?? row['maxLevel'], levelMax);
  const acquired = text(row['획득여부'] ?? row['acquired'] ?? row['acquire']) || '0';

  return applyVerifiedRecipeCorrections({
    id: `imported-xls-${Date.now()}-${index}`,
    name,
    baseLevel,
    maxLevel,
    attribute: text(row['속성'] ?? row['attribute']) || '악마',
    main: text(row['메인'] ?? row['주재료'] ?? row['main']) || '-',
    sub: text(row['서브'] ?? row['부재료'] ?? row['sub']) || '-',
    main2: nullableMaterial(row['메인2'] ?? row['주재료2'] ?? row['main2']),
    sub2: nullableMaterial(row['서브2'] ?? row['부재료2'] ?? row['sub2']),
    acquired,
    habitat: text(row['서식지'] ?? row['habitat']),
    xAntibody: numberValue(row['X데이터'] ?? row['x데이터'] ?? row['x항체'] ?? row['X항체'] ?? row['xAntibody'], 0),
  });
}

export function parseMonsterExcel(data: ArrayBuffer): Monster[] {
  try {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
    let best: Monster[] = [];

    // Prefer named-column parsing. This supports the current 1111.xlsx layout:
    // 이름, 레벨, 장단, 서식지, 메인, 서브, 메인2, 서브2, 획득여부, 속성,
    // 기본레벨, 최대레벨, X데이터(구형 x항체 헤더도 호환).
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });
      const parsed = rows.flatMap((row, index) => {
        const monster = parseNamedRow(row, index);
        return monster ? [monster] : [];
      });
      if (parsed.length > best.length) best = parsed;
    }

    if (best.length > 0) return best;

    // Fallback for legacy exports that use positional columns without names.
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n', blankrows: false });
      const parsed = parseMonsterCsv(csv);
      if (parsed.length > best.length) best = parsed;
    }
    return best;
  } catch (error) {
    console.error('Failed to parse excel file:', error);
    return [];
  }
}
