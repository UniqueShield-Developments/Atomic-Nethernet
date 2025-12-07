export declare enum SignalType {
    ConnectRequest = "CONNECTREQUEST",
    ConnectResponse = "CONNECTRESPONSE",
    CandidateAdd = "CANDIDATEADD",
    ConnectError = "CONNECTERROR"
}
export declare class SignalStructure {
    type: SignalType;
    connectionId: bigint;
    data: string;
    networkId?: any;
    constructor(type: SignalType, connectionId: bigint, data: string, networkId?: bigint);
    toString(): string;
    static fromString(message: string): SignalStructure;
}
