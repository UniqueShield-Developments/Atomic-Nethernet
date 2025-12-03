export enum SignalType {
  ConnectRequest = 'CONNECTREQUEST',
  ConnectResponse = 'CONNECTRESPONSE',
  CandidateAdd = 'CANDIDATEADD',
  ConnectError = 'CONNECTERROR'
}

export class SignalStructure {
  public type: SignalType;
  public connectionId: bigint;
  public data: string;
  public networkId?: bigint;

  constructor(type: SignalType, connectionId: bigint, data: string, networkId?: bigint) {
    this.type = type;
    this.connectionId = connectionId;
    this.data = data;
    this.networkId = networkId;
  }

  toString() {
    return `${this.type} ${this.connectionId} ${this.data}`;
  }

  static fromString(message: string) {
    const [type, connectionId, ...data] = message.split(' ');
    return new this(type as SignalType, BigInt(connectionId), data.join(' '));
  }
}
