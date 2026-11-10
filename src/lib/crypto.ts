// Encriptación de credenciales de terceros (Colppy, etc.) con AES-256-GCM.
// ENCRYPTION_KEY: 32 bytes en base64 →  openssl rand -base64 32
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const k = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY tiene que ser de 32 bytes en base64 (openssl rand -base64 32)");
  return k;
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(enc: string) {
  const [iv, tag, data] = enc.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
