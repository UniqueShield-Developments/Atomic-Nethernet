import type { RemoteInfo, Socket } from 'node:dgram';
import type EventEmitter from 'node:events';
type RTCDataChannel = any;
type RTCPeerConnection = any;
type Connection = any;
export interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
    credentialType?: 'password' | 'oauth';
}
export interface ResponsePacket {
    binary: number[];
    buffer: Buffer;
    writeIndex: number;
    readIndex: number;
    id: number;
    packetLength: number;
    senderId: bigint;
    data: Buffer;
}
export interface ServerOptions {
    networkId?: bigint;
}
export interface ServerEvents {
    openConnection: (connection: Connection) => void;
    closeConnection: (connectionId: bigint, reason: string) => void;
    encapsulated: (data: Buffer, connectionId: bigint) => void;
    close: (reason?: string) => void;
}
export interface ClientEvents {
    connected: (connection: Connection) => void;
    disconnect: (connectionId: bigint, reason: string) => void;
    encapsulated: (data: Buffer, connectionId: bigint) => void;
    pong: (packet: any) => void;
}
export interface ClientLike extends EventEmitter {
    networkId: bigint;
    connectionId: bigint;
    socket: Socket;
    serializer: any;
    deserializer: any;
    responses: Map<bigint, any>;
    addresses: Map<bigint, RemoteInfo>;
    credentials: (string | IceServer)[];
    signalHandler: (signal: any) => void;
    connection?: Connection;
    rtcConnection?: RTCPeerConnection;
    pingInterval?: NodeJS.Timeout;
    running: boolean;
    send(buffer: Buffer): void;
    close(reason?: string): void;
}
export interface ChannelPair {
    reliable?: RTCDataChannel | null;
    unreliable?: RTCDataChannel | null;
}
export {};
