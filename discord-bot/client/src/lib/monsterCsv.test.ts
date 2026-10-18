import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseMonsterCsv, parseMonsterExcel } from "./monsterCsv";

describe("parseMonsterCsv", () => {
  it("parses quoted commas and the X-antibody column without shifting fields", () => {
    const csv = [
      '이름,기본레벨,최대레벨,속성,주재료,부재료,주재료2,부재료2,획득여부,서식지,X항체',
      '테스트헨치,170,195,드래곤,"재료, 특수",부재료,-,-,0,"테스트 지역, 북부",6',
    ].join("\n");

    const [monster] = parseMonsterCsv(csv);
    expect(monster).toMatchObject({
      name: "테스트헨치",
      baseLevel: 170,
      maxLevel: 195,
      main: "재료, 특수",
      habitat: "테스트 지역, 북부",
      acquired: "0",
      xAntibody: 6,
    });
  });

  it("returns no records for an empty or header-only file", () => {
    expect(parseMonsterCsv("")).toEqual([]);
    expect(parseMonsterCsv("이름,기본레벨,최대레벨,속성,주재료")).toEqual([]);
  });

  it("parses the first worksheet of a real XLSX upload", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "기본레벨", "최대레벨", "속성", "주재료", "부재료", "주재료2", "부재료2", "획득여부", "서식지", "X항체"],
      ["엑셀업로드헨치", 170, 195, "드래곤", "주재료", "부재료", "-", "-", "0", "엑셀 지역", 5],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "헨치");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

    expect(parseMonsterExcel(bytes)).toEqual([
      expect.objectContaining({ name: "엑셀업로드헨치", main: "주재료", xAntibody: 5 }),
    ]);
  });

  it("parses the current 1111.xlsx named columns and preserves acquire status", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "레벨", "장단", "서식지", "메인", "서브", "메인2", "서브2", "획득여부", "속성", "기본레벨", "최대레벨", "x항체"],
      ["1111헨치", "216 ~ 241", "장코", "테스트 지역", "주재료 [5]", "부재료 [5]", "보조 [1]", "보조2 [1]", "x", "드래곤", 216, 241, 4],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "어비스");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

    expect(parseMonsterExcel(bytes)).toEqual([
      expect.objectContaining({
        name: "1111헨치",
        baseLevel: 216,
        maxLevel: 241,
        acquired: "x",
        main: "주재료 [5]",
        sub2: "보조2 [1]",
        xAntibody: 4,
      }),
    ]);
  });

  it("preserves all verified 6-stage 뉴아르카나 recipes during CSV and Excel reimports", () => {
    const variants = [
      ["뉴아르카나드래곤", "드래곤", "아르카나드래곤"],
      ["뉴아르카나짐승", "짐승", "아르카나짐승"],
      ["뉴아르카나곤충", "곤충", "아르카나곤충"],
      ["뉴아르카나메탈", "메탈", "아르카나메탈"],
      ["뉴아르카나미스터리", "미스터리", "아르카나미스터리"],
      ["뉴아르카나새", "새", "아르카나새"],
      ["뉴아르카나식물", "식물", "아르카나식물"],
      ["뉴아르카나악마", "악마", "아르카나악마"],
    ];
    const csv = [
      "이름,기본레벨,최대레벨,속성,주재료,부재료,주재료2,부재료2,획득여부,서식지,X항체",
      ...variants.map(([name, attribute, material]) => `${name},232,257,${attribute},${material} [6],${material} [7],-,-,x,-,0`),
    ].join("\n");
    expect(parseMonsterCsv(csv).map(({ name, main, sub }) => ({ name, main, sub }))).toEqual(
      variants.map(([name, , material]) => ({ name, main: `${material} [6]`, sub: `${material} [6]` })),
    );

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "레벨", "장단", "서식지", "메인", "서브", "메인2", "서브2", "획득여부", "속성", "기본레벨", "최대레벨", "x항체"],
      ...variants.map(([name, attribute, material]) => [name, "232 ~ 257", "장코", "-", `${material} [6]`, `${material} [7]`, "", "", "x", attribute, 232, 257, 0]),
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "어비스");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    expect(parseMonsterExcel(bytes).map(({ name, main, sub }) => ({ name, main, sub }))).toEqual(
      variants.map(([name, , material]) => ({ name, main: `${material} [6]`, sub: `${material} [6]` })),
    );
  });

  it("corrects the verified 6-to-5 stage typo for 뉴기와장군 during CSV and Excel reimports", () => {
    const csv = [
      "이름,기본레벨,최대레벨,속성,주재료,부재료,주재료2,부재료2,획득여부,서식지,X항체",
      "뉴기와장군,208,233,미스터리,기와장군 [6],커터맨티스 [6],-,-,x,-,0",
    ].join("\n");
    expect(parseMonsterCsv(csv)[0]).toMatchObject({
      main: "기와장군 [5]",
      sub: "커터맨티스 [5]",
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "레벨", "장단", "서식지", "메인", "서브", "메인2", "서브2", "획득여부", "속성", "기본레벨", "최대레벨", "x항체"],
      ["뉴기와장군", "208 ~ 233", "장코", "-", "기와장군 [6]", "커터맨티스 [6]", "", "", "x", "미스터리", 208, 233, 0],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "어비스");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    expect(parseMonsterExcel(bytes)[0]).toMatchObject({
      main: "기와장군 [5]",
      sub: "커터맨티스 [5]",
    });
  });

  it("preserves the verified 블루메탈 stage and 매드카우 material order during reimports", () => {
    const csv = [
      "이름,기본레벨,최대레벨,속성,주재료,부재료,주재료2,부재료2,획득여부,서식지,X항체",
      "데빌메쉬,160,185,메탈,블루메탈 [3],뉴봄버군 [3],-,-,0,-,0",
      "매드카우,168,193,짐승,올드매지션 [3],밀크카우 [3],-,-,x,-,0",
    ].join("\n");
    expect(parseMonsterCsv(csv).map(({ name, main, sub }) => ({ name, main, sub }))).toEqual([
      { name: "데빌메쉬", main: "블루메탈 [2]", sub: "뉴봄버군 [3]" },
      { name: "매드카우", main: "밀크카우 [3]", sub: "올드매지션 [3]" },
    ]);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "레벨", "장단", "서식지", "메인", "서브", "메인2", "서브2", "획득여부", "속성", "기본레벨", "최대레벨", "x항체"],
      ["데빌메쉬", "160 ~ 185", "장코", "-", "블루메탈 [3]", "뉴봄버군 [3]", "", "", "0", "메탈", 160, 185, 0],
      ["매드카우", "168 ~ 193", "장코", "-", "올드매지션 [3]", "밀크카우 [3]", "", "", "x", "짐승", 168, 193, 0],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "어비스");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    expect(parseMonsterExcel(bytes).map(({ name, main, sub }) => ({ name, main, sub }))).toEqual([
      { name: "데빌메쉬", main: "블루메탈 [2]", sub: "뉴봄버군 [3]" },
      { name: "매드카우", main: "밀크카우 [3]", sub: "올드매지션 [3]" },
    ]);
  });
});
