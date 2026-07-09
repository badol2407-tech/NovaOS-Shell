import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * App-layer encryption for secrets-at-rest (e.g. user-supplied GitHub PATs)
 * using AES-256-GCM. The key is derived from SESSION_SECRET via SHA-256 so we
 * don't need a dedicated encryption-key secret. Ciphertext is stored as
 * `iv:authTag:ciphertext`, all hex-encoded, in a single text column.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set — required to encrypt/decrypt stored secrets",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted payload");
  }
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex as string, "hex");
  const authTag = Buffer.from(authTagHex as string, "hex");
  const data = Buffer.from(dataHex as string, "hex");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
