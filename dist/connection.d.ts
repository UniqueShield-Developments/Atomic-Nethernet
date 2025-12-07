import type { ClientLike } from './types';
export declare class Connection {
    nethernet: ClientLike;
    address: bigint;
    rtcConnection: any;
    reliable: any;
    unreliable: any;
    promisedSegments: number;
    buf: Buffer | null;
    sendQueue: Buffer[];
    constructor(nethernet: ClientLike, address: bigint, rtcConnection: any);
    setChannels(reliable?: any | null, unreliable?: any | null): void;
    handleMessage(data: Buffer | string | ArrayBuffer | ArrayBufferView): void;
    send(data: Buffer | string | ArrayBuffer | ArrayBufferView): number;
    sendNow(data: Buffer): number;
    flushQueue(): void;
    close(): void;
}
