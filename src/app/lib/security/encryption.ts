import crypto from "crypto";

const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // AES-GCM recommended IV length

export type EncryptionPayload = {
  ciphertext: string; // base64 encoded
  iv: string;         // base64 encoded
  authTag: string;    // base64 encoded
};

const getKey = (): Buffer => {
  const encryptionKey = process.env.SLACK_TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY is not set. Please configure a 32-byte base64 string."
    );
  }

  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(encryptionKey, "base64");
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

/**
 * テキストを暗号化してbase64エンコードされたペイロードを返す
 */
export const encrypt = (plainText: string): EncryptionPayload => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
};

/**
 * base64エンコードされたペイロードを復号化
 */
export const decrypt = (payload: EncryptionPayload): string => {
  const key = getKey();
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};
