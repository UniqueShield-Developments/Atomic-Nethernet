import { encrypt, calculateChecksum, decrypt } from './crypto';
import type { PacketType } from './serializer';

export const getRandomUint64 = () => {
  const high = Math.floor(Math.random() * 0xFFFFFFFF);
  const low = Math.floor(Math.random() * 0xFFFFFFFF);

  return (BigInt(high) << 32n) | BigInt(low);
};

export const createPacketData = (packetName: string, packetId: PacketType, senderId: bigint, additionalParams: Record<string, any> = {}) => {
  return {
    name: packetName,
    params: {
      sender_id: senderId,
      reserved: Buffer.alloc(8),
      ...additionalParams
    }
  };
};

export const prepareSecurePacket = (serializer: any, packetData: any) => {
  const buf = serializer.createPacketBuffer(packetData);

  const checksum = calculateChecksum(buf);
  const encryptedData = encrypt(buf);

  return Buffer.concat([checksum, encryptedData]);
};

export const processSecurePacket = (buffer: Buffer, deserializer: any) => {
  if (buffer.length < 32) {
    throw new Error('Packet is too short');
  }

  const decryptedData = decrypt(buffer.slice(32));

  const checksum = calculateChecksum(decryptedData);
  if (Buffer.compare(buffer.slice(0, 32), checksum) !== 0) {
    throw new Error('Checksum mismatch');
  }

  const packet = deserializer.parsePacketBuffer(decryptedData);

  return { name: packet.data.name, params: packet.data.params };
};
