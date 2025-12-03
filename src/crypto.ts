import crypto from 'node:crypto';

const appIdBuffer = Buffer.alloc(8);
appIdBuffer.writeBigUInt64LE(BigInt(0xdeadbeef));

const AES_KEY = crypto.createHash('sha256')
  .update(appIdBuffer)
  .digest();

export function encrypt(data: Buffer) {
  const cipher = crypto.createCipheriv('aes-256-ecb', AES_KEY, null);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export function decrypt(data: Buffer) {
  const decipher = crypto.createDecipheriv('aes-256-ecb', AES_KEY, null);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function calculateChecksum(data: Buffer) {
  const hmac = crypto.createHmac('sha256', AES_KEY);
  hmac.update(data);
  return hmac.digest();
}
