import crypto from "node:crypto";

function getForgeConfig() {
  const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Built-in storage is not configured");
  }
  return { forgeUrl, forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!presignResp.ok) {
    const message = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${message}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload failed (${uploadResp.status})`);
  }

  return { key, url: storageUrl(key) };
}

export async function storageGet(key: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", normalizeKey(key));
  const response = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage presign failed (${response.status}): ${message}`);
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("Forge returned empty storage URL");
  return payload.url;
}

export function storageUrl(key: string): string {
  return `/api/monster-image?key=${encodeURIComponent(normalizeKey(key))}`;
}
