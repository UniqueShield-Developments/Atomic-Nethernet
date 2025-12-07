"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSecurePacket = exports.prepareSecurePacket = exports.createPacketData = exports.getRandomUint64 = void 0;
const crypto_1 = require("./crypto");
const getRandomUint64 = () => {
    const high = Math.floor(Math.random() * 0xFFFFFFFF);
    const low = Math.floor(Math.random() * 0xFFFFFFFF);
    return (BigInt(high) << 32n) | BigInt(low);
};
exports.getRandomUint64 = getRandomUint64;
const createPacketData = (packetName, packetId, senderId, additionalParams = {}) => {
    return {
        name: packetName,
        params: {
            sender_id: senderId,
            reserved: Buffer.alloc(8),
            ...additionalParams
        }
    };
};
exports.createPacketData = createPacketData;
const prepareSecurePacket = (serializer, packetData) => {
    const buf = serializer.createPacketBuffer(packetData);
    const checksum = (0, crypto_1.calculateChecksum)(buf);
    const encryptedData = (0, crypto_1.encrypt)(buf);
    return Buffer.concat([checksum, encryptedData]);
};
exports.prepareSecurePacket = prepareSecurePacket;
const processSecurePacket = (buffer, deserializer) => {
    if (buffer.length < 32) {
        throw new Error('Packet is too short');
    }
    const decryptedData = (0, crypto_1.decrypt)(buffer.slice(32));
    const checksum = (0, crypto_1.calculateChecksum)(decryptedData);
    if (Buffer.compare(buffer.slice(0, 32), checksum) !== 0) {
        throw new Error('Checksum mismatch');
    }
    const packet = deserializer.parsePacketBuffer(decryptedData);
    return { name: packet.data.name, params: packet.data.params };
};
exports.processSecurePacket = processSecurePacket;
