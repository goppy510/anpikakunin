import { encrypt, decrypt } from "../src/app/lib/security/encryption";

const testToken = "xoxb-test-slack-bot-token-12345678";

console.log("🔐 Testing encryption/decryption with TEXT storage...\n");

// Test encryption
console.log("Original token:", testToken);
const encrypted = encrypt(testToken);

console.log("\nEncrypted payload:");
console.log("  ciphertext:", encrypted.ciphertext);
console.log("  iv:", encrypted.iv);
console.log("  authTag:", encrypted.authTag);

// Verify all values are base64 strings
console.log("\nVerifying base64 format:");
console.log("  ciphertext is string:", typeof encrypted.ciphertext === "string");
console.log("  iv is string:", typeof encrypted.iv === "string");
console.log("  authTag is string:", typeof encrypted.authTag === "string");

// Test decryption
const decrypted = decrypt(encrypted);
console.log("\nDecrypted token:", decrypted);

// Verify match
const matches = testToken === decrypted;
console.log("\n✅ Match:", matches);

if (!matches) {
  console.error("❌ FAIL: Decrypted token doesn't match original!");
  process.exit(1);
}

console.log("\n✅ SUCCESS: Encryption/decryption working correctly with TEXT storage");
