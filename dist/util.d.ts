import type { PacketType } from './serializer';
export declare const getRandomUint64: () => bigint;
export declare const createPacketData: (packetName: string, packetId: PacketType, senderId: bigint, additionalParams?: Record<string, any>) => {
    name: string;
    params: {
        sender_id: bigint;
        reserved: Buffer<ArrayBuffer>;
    };
};
export declare const prepareSecurePacket: (serializer: any, packetData: any) => Buffer<ArrayBuffer>;
export declare const processSecurePacket: (buffer: Buffer, deserializer: any) => {
    name: any;
    params: any;
};
