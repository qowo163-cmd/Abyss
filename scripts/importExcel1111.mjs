import XLSX from "xlsx";
import fs from "fs";
import mysql from "mysql2/promise";

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

  const dbUrl = process.env.DATABASE_URL || "mysql://root:@localhost:3306/mixmaster";
  const conn = await mysql.createConnection(dbUrl);
  
  await conn.execute("DELETE FROM monsters");
  
  let count = 0;
  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    const name = String(row["이름"] || "").trim();
    if (!name) continue;

    const id = String(name);
    const level = String(row["레벨"] || "");
    const attribute = String(row["속성"] || "");
    const type = String(row["장단"] || "");
    const habitat = String(row["서식지"] || "");
    const acquire = String(row["획득여부"] || "");
    const main = String(row["메인"] || "");
    const sub = String(row["서브"] || "");
    const main2 = row["메인2"] ? String(row["메인2"]) : null;
    const sub2 = row["서브2"] ? String(row["서브2"]) : null;
    const baseLevel = Number(row["기본레벨"] || 1);
    const maxLevel = Number(row["최대레벨"] || 100);
    const xAntibody = Number(row["x항체"] || 0);

    await conn.execute(
      `INSERT INTO monsters (id, name, level, attribute, type, habitat, acquire, main, sub, main2, sub2, base_level, max_level, x_antibody) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, level, attribute, type, habitat, acquire, main, sub, main2, sub2, baseLevel, maxLevel, xAntibody]
    );
    count++;
  }

  console.log(`Successfully imported ${count} monsters into MySQL from 1111.xlsx!`);
  await conn.end();
}

run().catch(console.error);
