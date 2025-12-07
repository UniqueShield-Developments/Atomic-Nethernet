"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.calculateChecksum = calculateChecksum;
const node_crypto_1 = __importDefault(require("node:crypto"));
const appIdBuffer = Buffer.alloc(8);
appIdBuffer.writeBigUInt64LE(BigInt(0xdeadbeef));
const AES_KEY = node_crypto_1.default.createHash('sha256')
    .update(appIdBuffer)
    .digest();
function encrypt(data) {
    const cipher = node_crypto_1.default.createCipheriv('aes-256-ecb', AES_KEY, null);
    return Buffer.concat([cipher.update(data), cipher.final()]);
}
function decrypt(data) {
    const decipher = node_crypto_1.default.createDecipheriv('aes-256-ecb', AES_KEY, null);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}
function calculateChecksum(data) {
    const hmac = node_crypto_1.default.createHmac('sha256', AES_KEY);
    hmac.update(data);
    return hmac.digest();
}
