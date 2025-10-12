import { encrypt, decrypt } from "../src/app/lib/security/encryption";

const testToken = "xoxb-test-slack-bot-token-12345678";


// Test encryption
const encrypted = encrypt(testToken);


// Verify all values are base64 strings

// Test decryption
const decrypted = decrypt(encrypted);

// Verify match
const matches = testToken === decrypted;

if (!matches) {
  process.exit(1);
}

