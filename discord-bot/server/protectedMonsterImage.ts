import { storageGet } from "./storage.js";
import { isRegisteredMonsterImageKey, type MonsterImageRecord } from "./monsterImageUrls.js";

export const PROTECTED_MONSTER_IMAGE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  Vary: "Cookie",
  "Content-Disposition": "inline; filename=protected-hench.webp",
  "Content-Security-Policy": "default-src 'none'; sandbox",
} as const;

export const MAX_PROTECTED_MONSTER_IMAGE_BYTES = 6 * 1024 * 1024;

export type ProtectedMonsterImage = { bytes: Buffer; contentType: string };

function hasWebpSignature(bytes: Buffer): boolean {
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

/** 승인 회원이 참조 중인 WebP 이미지만 서버를 통해 전달하고 저장소 서명 URL은 공개하지 않습니다. */
export async function readProtectedMonsterImage(monsters: MonsterImageRecord[], key: string): Promise<ProtectedMonsterImage | null> {
  if (!isRegisteredMonsterImageKey(monsters, key)) return null;

  const signedUrl = await storageGet(key);
  const upstream = await fetch(signedUrl, { redirect: "error" });
  if (!upstream.ok) throw new Error(`Protected image upstream returned ${upstream.status}`);

  const declaredContentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || "";
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PROTECTED_MONSTER_IMAGE_BYTES) throw new Error("Protected monster image has an unexpected size");

  const isDeclaredWebp = declaredContentType === "image/webp" || declaredContentType === "image/x-webp";
  const isGenericBinary = declaredContentType === "application/octet-stream" || declaredContentType === "binary/octet-stream" || !declaredContentType;
  if (!isDeclaredWebp && !(isGenericBinary && hasWebpSignature(bytes))) {
    throw new Error("Protected monster image has an unexpected content type");
  }

  return { bytes, contentType: "image/webp" };
}
