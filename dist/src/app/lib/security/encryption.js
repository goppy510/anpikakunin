"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // AES-GCM recommended IV length
const getKey = () => {
    const encryptionKey = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
        throw new Error("SLACK_TOKEN_ENCRYPTION_KEY is not set. Please configure a 32-byte base64 string.");
    }
    let keyBuffer;
    try {
        keyBuffer = Buffer.from(encryptionKey, "base64");
    }
    catch {
        throw new Error("SLACK_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
    }
    if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(`SLACK_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes.`);
    }
    return keyBuffer;
};
/**
 * テキストを暗号化してbase64エンコードされたペイロードを返す
 */
const encrypt = (plainText) => {
    const key = getKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        ciphertext: ciphertext.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    };
};
exports.encrypt = encrypt;
/**
 * base64エンコードされたペイロードを復号化
 */
const decrypt = (payload) => {
    const key = getKey();
    const ciphertext = Buffer.from(payload.ciphertext, "base64");
    const iv = Buffer.from(payload.iv, "base64");
    const authTag = Buffer.from(payload.authTag, "base64");
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
};
exports.decrypt = decrypt;
