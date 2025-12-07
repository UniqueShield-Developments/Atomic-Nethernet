"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalStructure = exports.SignalType = void 0;
var SignalType;
(function (SignalType) {
    SignalType["ConnectRequest"] = "CONNECTREQUEST";
    SignalType["ConnectResponse"] = "CONNECTRESPONSE";
    SignalType["CandidateAdd"] = "CANDIDATEADD";
    SignalType["ConnectError"] = "CONNECTERROR";
})(SignalType || (exports.SignalType = SignalType = {}));
class SignalStructure {
    constructor(type, connectionId, data, networkId) {
        this.type = type;
        this.connectionId = connectionId;
        this.data = data;
        this.networkId = networkId;
    }
    toString() {
        return `${this.type} ${this.connectionId} ${this.data}`;
    }
    static fromString(message) {
        const [type, connectionId, ...data] = message.split(' ');
        return new this(type, BigInt(connectionId), data.join(' '));
    }
}
exports.SignalStructure = SignalStructure;
