import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptEmail(content: string, keyHex: string, outboxId: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  cipher.setAAD(Buffer.from(outboxId));
  const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptEmail(content: string, keyHex: string, outboxId: string) {
  const [version, iv, tag, body, extra] = content.split(".");
  if (version !== "v1" || !iv || !tag || !body || extra) throw new Error("Invalid encrypted email");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex"),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(outboxId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
