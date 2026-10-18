import mysql from 'mysql2/promise';
import { writeFile } from 'node:fs/promises';

const site = 'https://mixmasterdb-uehrnkpd.manus.space';
const outputPath = '/home/ubuntu/abyss-image-audit.json';
const connection = await mysql.createConnection(process.env.DATABASE_URL);

const loginResponse = await fetch(`${site}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: process.env.ADMIN_SETUP_USERNAME, password: process.env.ADMIN_SETUP_PASSWORD }),
});
if (!loginResponse.ok) throw new Error(`Production audit login failed with ${loginResponse.status}`);
const cookie = loginResponse.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');

try {
  const [rows] = await connection.query("SELECT data FROM monster_data_store WHERE id = 'current' LIMIT 1");
  const raw = rows?.[0]?.data;
  if (typeof raw !== 'string') throw new Error('Monster storage record is unavailable');

  const monsters = JSON.parse(raw);
  const images = monsters
    .filter((monster) => typeof monster?.imageUrl === 'string' && monster.imageUrl.length > 0)
    .map((monster) => {
      const storedUrl = monster.imageUrl;
      const key = storedUrl.startsWith('/manus-storage/') ? storedUrl.slice('/manus-storage/'.length) : new URL(storedUrl, site).searchParams.get('key');
      return { id: monster.id, name: monster.name, storedUrl, key };
    });

  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < images.length) {
      const index = cursor++;
      const image = images[index];
      if (!image.key) {
        results[index] = { ...image, ok: false, status: 0, contentType: '', contentLength: 0, error: 'No valid storage key' };
        continue;
      }
      try {
        const response = await fetch(`${site}/api/monster-image?key=${encodeURIComponent(image.key)}`, { headers: { Cookie: cookie } });
        const contentType = response.headers.get('content-type') || '';
        const contentLength = Number(response.headers.get('content-length') || 0);
        results[index] = {
          ...image,
          ok: response.ok && contentType.startsWith('image/') && contentLength > 0,
          status: response.status,
          contentType,
          contentLength,
        };
      } catch (error) {
        results[index] = { ...image, ok: false, status: 0, contentType: '', contentLength: 0, error: String(error) };
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, worker));
  const failed = results.filter((result) => !result.ok);
  const report = {
    checkedAt: new Date().toISOString(),
    totalMonsters: monsters.length,
    imagesChecked: results.length,
    imagesFailed: failed.length,
    failed,
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, failed: failed.slice(0, 25) }, null, 2));
} finally {
  await connection.end();
}
