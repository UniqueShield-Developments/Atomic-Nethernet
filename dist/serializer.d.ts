import { FullPacketParser, Serializer as ProtoSerializer } from 'protodef';
export declare const PACKET_TYPE: {
    readonly DISCOVERY_REQUEST: 0;
    readonly DISCOVERY_RESPONSE: 1;
    readonly DISCOVERY_MESSAGE: 2;
};
type PacketTypeKey = keyof typeof PACKET_TYPE;
export type PacketType = (typeof PACKET_TYPE)[PacketTypeKey];
declare function createProtocol(): any;
export declare function createSerializer(): ProtoSerializer;
export declare function createDeserializer(): FullPacketParser;
export { createProtocol };
