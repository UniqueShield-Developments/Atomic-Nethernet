import { RemoteInfo, Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { Connection } from './connection';
import { SignalStructure } from './signalling';
import type { IceServer, ServerOptions } from './types';
export declare class Server extends EventEmitter {
    options: ServerOptions;
    networkId: bigint;
    connections: Map<bigint, Connection>;
    advertisement?: Buffer;
    socket: Socket;
    serializer: any;
    deserializer: any;
    constructor(options?: ServerOptions);
    handleCandidate(signal: SignalStructure): void;
    handleOffer(signal: SignalStructure, respond: (signal: SignalStructure) => void, credentials?: (string | IceServer)[]): Promise<void>;
    processPacket(buffer: Buffer, rinfo: RemoteInfo): void;
    setAdvertisement(buffer: Buffer): void;
    handleRequest(rinfo: RemoteInfo): void;
    handleMessage(packet: any, rinfo: RemoteInfo): void;
    listen(): Promise<void>;
    close(reason?: string): void;
}
