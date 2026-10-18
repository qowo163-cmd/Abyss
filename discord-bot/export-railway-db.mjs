import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function fail(message) {
  console.error(`\n오류: ${message}`);
  process.exitCode = 1;
}

function ident(value) {
  return `\`${String(value).replaceAll('`', '``')}\``;
}

function sqlString(value) {
  return `'${String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll('\0', '\\0')
    .replaceAll('\b', '\\b')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
    .replaceAll(String.fromCharCode(26), '\\Z')}'`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return sqlString(value.toISOString().slice(0, 19).replace('T', ' '));
  if (typeof value === 'object') return sqlString(JSON.stringify(value));
  return sqlString(value);
}

function cleanViewDefinition(sql) {
  return String(sql)
    .replace(/\s+DEFINER\s*=\s*`[^`]*`@`[^`]*`/i, '')
    .replace(/\s+DEFINER\s*=\s*'[^']*'@'[^']*'/i, '')
    .replace(/^CREATE\s+ALGORITHM=/i, 'CREATE OR REPLACE ALGORITHM=');
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  fail('DATABASE_URL이 없습니다. export-railway-db.ps1을 통해 실행해 주세요.');
} else {
  let connection;
  try {
    const parsed = new URL(rawUrl);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) throw new Error('MySQL 연결 주소(mysql://...)가 아닙니다.');
    if (!parsed.hostname || !parsed.username || !database) throw new Error('연결 주소에서 호스트/계정/데이터베이스 이름을 읽을 수 없습니다.');

    connection = await mysql.createConnection({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database,
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      connectTimeout: 25000,
      multipleStatements: false,
    });

    await connection.query('SET NAMES utf8mb4');
    await connection.query('SET SESSION time_zone = "+00:00"');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');

    const [objects] = await connection.query('SHOW FULL TABLES');
    const firstKey = objects.length ? Object.keys(objects[0]).find(k => k.startsWith('Tables_in_')) : null;
    const tables = objects.filter(row => row.Table_type === 'BASE TABLE').map(row => row[firstKey]);
    const views = objects.filter(row => row.Table_type === 'VIEW').map(row => row[firstKey]);
    if (!tables.length && !views.length) throw new Error('선택된 데이터베이스에서 테이블이나 뷰를 찾지 못했습니다.');

    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const outputPath = path.resolve(process.cwd(), `Abyss-live-db-${stamp}.sql`);
    const out = fs.createWriteStream(outputPath, { encoding: 'utf8' });
    const write = chunk => new Promise((resolve, reject) => {
      if (out.write(chunk)) resolve();
      else { out.once('drain', resolve); out.once('error', reject); }
    });

    await write(`-- Abyss live database export\n-- Export time (UTC): ${new Date().toISOString()}\n-- Database: ${database}\n-- Includes table definitions, all table rows, and view definitions.\n-- Restore only into a NEW/EMPTY target database or after taking a separate backup.\n\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\nCREATE DATABASE IF NOT EXISTS ${ident(database)} CHARACTER SET utf8mb4;\nUSE ${ident(database)};\n\n`);

    // Drop old views first, then tables. This only writes to the export file; it never changes the source database.
    for (const view of views) await write(`DROP VIEW IF EXISTS ${ident(view)};\n`);
    await write('\n');
    for (const table of tables) {
      await write(`DROP TABLE IF EXISTS ${ident(table)};\n`);
    }
    await write('\n');

    // Preserve schema, columns, indexes, foreign keys and auto-increment values.
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const [createRows] = await connection.query(`SHOW CREATE TABLE ${ident(table)}`);
      const createSql = createRows[0]['Create Table'];
      await write(`-- Structure for table ${table}\n${createSql};\n\n`);
      console.log(`[${i + 1}/${tables.length}] 구조 내보내기: ${table}`);
    }

    // Export table rows in bounded batches to avoid building huge INSERT statements.
    for (let ti = 0; ti < tables.length; ti++) {
      const table = tables[ti];
      const [columnRows] = await connection.query(`SHOW COLUMNS FROM ${ident(table)}`);
      const columns = columnRows.map(r => r.Field);
      const colsSql = columns.map(ident).join(', ');
      const [countRows] = await connection.query(`SELECT COUNT(*) AS n FROM ${ident(table)}`);
      const total = Number(countRows[0].n);
      console.log(`[${ti + 1}/${tables.length}] 데이터 내보내기: ${table} (${total}행)`);
      for (let offset = 0; offset < total; offset += 200) {
        const [rows] = await connection.query(`SELECT * FROM ${ident(table)} LIMIT 200 OFFSET ${offset}`);
        if (!rows.length) continue;
        const values = rows.map(row => `(${columns.map(col => sqlValue(row[col])).join(', ')})`).join(',\n');
        await write(`INSERT INTO ${ident(table)} (${colsSql}) VALUES\n${values};\n`);
      }
      await write('\n');
    }

    // Views are created after table structures/data so their dependencies are present.
    for (const view of views) {
      const [viewRows] = await connection.query(`SHOW CREATE VIEW ${ident(view)}`);
      const viewRow = viewRows[0];
      const viewSql = cleanViewDefinition(viewRow['Create View']);
      await write(`-- View ${view}\n${viewSql};\n\n`);
    }

    await connection.commit();
    await write('SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n');
    await new Promise((resolve, reject) => out.end(err => err ? reject(err) : resolve()));
    console.log(`\n완료! SQL 백업 파일: ${outputPath}`);
    console.log(`테이블: ${tables.length}, 뷰: ${views.length}`);
    console.log('이 파일은 실제 운영 테이블 데이터가 포함된 백업입니다. 다른 사이트에 가져오기 전에 대상 DB를 따로 백업하세요.');
  } catch (error) {
    console.error(`\nDB 내보내기 실패: ${error?.message || String(error)}`);
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    process.exitCode = 1;
  } finally {
    if (connection) {
      try { await connection.end(); } catch {}
    }
  }
}
