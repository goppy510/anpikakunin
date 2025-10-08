import crypto from "crypto";
import { env } from "@/app/lib/env";

const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // AES-GCM recommended IV length

export type EncryptionPayload = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

const getKey = (): Buffer => {
  if (!env.SLACK_TOKEN_ENCRYPTION_KEY) {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY is not set. Please configure a 32-byte base64 string."
    );
  }

  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(env.SLACK_TOKEN_ENCRYPTION_KEY, "base64");
  } catch {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key."
    );
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `SLACK_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes.`
    );
  }

  return keyBuffer;
};

export const encrypt = (plainText: string): EncryptionPayload => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
};

export const decrypt = (payload: EncryptionPayload): string => {
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, payload.iv);
  decipher.setAuthTag(payload.authTag);
  const decrypted = Buffer.concat([
    decipher.update(payload.ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};
