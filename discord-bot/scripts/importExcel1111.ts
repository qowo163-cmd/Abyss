import XLSX from "xlsx";
import { getDb } from "../server/db";
import { monstersTable } from "../drizzle/schema";

async function run() {
  const buf = fs.readFileSync("/home/ubuntu/upload/1111.xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets["어비스"];
  if (!ws) {
    console.error("Sheet '어비스' not found in 1111.xlsx");
    return;
  }
  const json = XLSX.utils.sheet_to_json(ws);
  console.log("Parsed JSON count from 어비스:", json.length);

  const db = getDb();
  if (!db) {
    console.error("DB not connected");
    return;
  }

  const items = json.map((row: any, idx: number) => ({
    id: String(row["이름"] || `m_${idx+1}`),
    name: String(row["이름"] || `몬스터${idx+1}`),
    level: String(row["레벨"] || ""),
    attribute: String(row["속성"] || ""),
    type: String(row["장단"] || ""),
    habitat: String(row["서식지"] || ""),
    acquire: String(row["획득여부"] || ""),
    main: String(row["메인"] || ""),
    sub: String(row["서브"] || ""),
    main2: row["메인2"] ? String(row["메인2"]) : null,
    sub2: row["sub2"] ? String(row["sub2"]) : (row["서브2"] ? String(row["서브2"]) : null),
    baseLevel: Number(row["기본레벨"] || 1),
    maxLevel: Number(row["최대레벨"] || 100),
    xAntibody: Number(row["x항체"] || 0),
    imageUrl: null,
  })).filter(m => m.name && m.name !== "undefined");

  console.log("Valid items to save:", items.length);
  if (items.length > 0) {
    await db.delete(monstersTable);
    for (let i = 0; i < items.length; i += 50) {
      const chunk = items.slice(i, i + 50);
      await db.insert(monstersTable).values(chunk);
    }
    console.log("Successfully updated MySQL monsters table with 1111.xlsx data!");
  }
}

import fs from "fs";
run().catch(console.error);
