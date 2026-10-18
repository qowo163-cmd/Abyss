import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query("SELECT data FROM monster_data_store WHERE id = 'current' LIMIT 1");
  const monsters = JSON.parse(rows[0].data);
  const first = monsters.find((monster) => typeof monster?.imageUrl === 'string' && monster.imageUrl.startsWith('/manus-storage/monster-images/'));
  if (!first) throw new Error('No stored monster image is registered');
  const key = first.imageUrl.slice('/manus-storage/'.length);
  const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || '').replace(/\/+$/, '');
  const presign = new URL('v1/storage/presign/get', `${forgeUrl}/`);
  presign.searchParams.set('path', key);
  const presignResponse = await fetch(presign, { headers: { Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` } });
  if (!presignResponse.ok) throw new Error(`Presign returned ${presignResponse.status}`);
  const { url } = await presignResponse.json();
  const upstream = await fetch(url, { redirect: 'error' });
  const bytes = Buffer.from(await upstream.arrayBuffer());
  const site = 'https://mixmasterdb-uehrnkpd.manus.space';
  const login = await fetch(`${site}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: process.env.ADMIN_SETUP_USERNAME, password: process.env.ADMIN_SETUP_PASSWORD }),
  });
  if (!login.ok) throw new Error(`Production login returned ${login.status}`);
  const cookie = login.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
  const production = await fetch(`${site}/api/monster-image?key=${encodeURIComponent(key)}`, { headers: { Cookie: cookie } });
  const productionBytes = Buffer.from(await production.arrayBuffer());
  console.log(JSON.stringify({
    monster: { id: first.id, name: first.name },
    key,
    status: upstream.status,
    contentType: upstream.headers.get('content-type'),
    contentLength: upstream.headers.get('content-length'),
    signatureHex: bytes.subarray(0, 16).toString('hex'),
    signatureAscii: bytes.subarray(0, 16).toString('ascii'),
    byteLength: bytes.length,
    production: {
      status: production.status,
      contentType: production.headers.get('content-type'),
      contentLength: production.headers.get('content-length'),
      signatureAscii: productionBytes.subarray(0, 16).toString('ascii'),
      byteLength: productionBytes.length,
    },
  }, null, 2));
} finally {
  await connection.end();
}
