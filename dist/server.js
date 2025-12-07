"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const debug_1 = __importDefault(require("debug"));
const node_dgram_1 = __importDefault(require("node:dgram"));
const node_events_1 = require("node:events");
const connection_1 = require("./connection");
const serializer_1 = require("./serializer");
const signalling_1 = require("./signalling");
const util_1 = require("./util");
const { RTCPeerConnection, RTCIceCandidate } = require('wrtc');
const log = (0, debug_1.default)('atomic-nethernet');
class Server extends node_events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.networkId = options.networkId ?? (0, util_1.getRandomUint64)();
        this.connections = new Map();
        this.serializer = (0, serializer_1.createSerializer)();
        this.deserializer = (0, serializer_1.createDeserializer)();
    }
    handleCandidate(signal) {
        const conn = this.connections.get(signal.connectionId);
        if (!conn) {
            log('Connection not found', signal.connectionId);
            return;
        }
        const candidateInit = typeof signal.data === 'string'
            ? { candidate: signal.data, sdpMid: '0', sdpMLineIndex: 0 }
            : signal.data;
        conn.rtcConnection.addIceCandidate(new RTCIceCandidate(candidateInit)).catch((err) => {
            log('Failed to add ICE candidate on server', err);
        });
    }
    async handleOffer(signal, respond, credentials = []) {
        const rtcConnection = new RTCPeerConnection({ iceServers: credentials });
        const connection = new connection_1.Connection(this, signal.connectionId, rtcConnection);
        this.connections.set(signal.connectionId, connection);
        log('Received offer', signal.connectionId);
        rtcConnection.onicecandidate = (event) => {
            if (!event.candidate)
                return;
            respond(new signalling_1.SignalStructure(signalling_1.SignalType.CandidateAdd, signal.connectionId, event.candidate.candidate, signal.networkId));
        };
        rtcConnection.ondatachannel = (event) => {
            const channel = event.channel;
            log('Received data channel', channel.label);
            if (channel.label === 'ReliableDataChannel')
                connection.setChannels(channel);
            if (channel.label === 'UnreliableDataChannel')
                connection.setChannels(null, channel);
        };
        rtcConnection.onconnectionstatechange = () => {
            const state = rtcConnection.connectionState;
            log('Server RTC state changed', state);
            if (state === 'connected')
                this.emit('openConnection', connection);
            if (state === 'closed' || state === 'disconnected' || state === 'failed') {
                this.emit('closeConnection', signal.connectionId, 'disconnected');
            }
        };
        await rtcConnection.setRemoteDescription({ type: 'offer', sdp: signal.data });
        const answer = await rtcConnection.createAnswer();
        await rtcConnection.setLocalDescription(answer);
        const answerSdp = rtcConnection.localDescription?.sdp ?? answer.sdp ?? '';
        respond(new signalling_1.SignalStructure(signalling_1.SignalType.ConnectResponse, signal.connectionId, answerSdp, signal.networkId));
    }
    processPacket(buffer, rinfo) {
        const parsedPacket = (0, util_1.processSecurePacket)(buffer, this.deserializer);
        log('Received packet', parsedPacket);
        switch (parsedPacket.name) {
            case 'discovery_request':
                this.handleRequest(rinfo);
                break;
            case 'discovery_response':
                break;
            case 'discovery_message':
                this.handleMessage(parsedPacket, rinfo);
                break;
            default:
                throw new Error('Unknown packet type');
        }
    }
    setAdvertisement(buffer) {
        this.advertisement = buffer;
    }
    handleRequest(rinfo) {
        const data = this.advertisement;
        if (!data) {
            throw new Error('Advertisement data not set yet');
        }
        const packetData = (0, util_1.createPacketData)('discovery_response', serializer_1.PACKET_TYPE.DISCOVERY_RESPONSE, this.networkId, {
            data: data.toString('hex')
        });
        const packetToSend = (0, util_1.prepareSecurePacket)(this.serializer, packetData);
        this.socket.send(packetToSend, rinfo.port, rinfo.address);
    }
    handleMessage(packet, rinfo) {
        const data = packet.params.data;
        if (data === 'Ping') {
            return;
        }
        const respond = (signal) => {
            const packetData = (0, util_1.createPacketData)('discovery_message', serializer_1.PACKET_TYPE.DISCOVERY_MESSAGE, this.networkId, {
                recipient_id: BigInt(signal.networkId ?? 0),
                data: signal.toString()
            });
            const packetToSend = (0, util_1.prepareSecurePacket)(this.serializer, packetData);
            this.socket.send(packetToSend, rinfo.port, rinfo.address);
        };
        const signal = signalling_1.SignalStructure.fromString(data);
        signal.networkId = BigInt(packet.params.sender_id);
        switch (signal.type) {
            case signalling_1.SignalType.ConnectRequest:
                this.handleOffer(signal, respond);
                break;
            case signalling_1.SignalType.CandidateAdd:
                this.handleCandidate(signal);
                break;
            default:
                break;
        }
    }
    async listen() {
        this.socket = node_dgram_1.default.createSocket('udp4');
        this.socket.on('message', (buffer, rinfo) => {
            this.processPacket(buffer, rinfo);
        });
        await new Promise((resolve, reject) => {
            const failFn = (e) => reject(e);
            this.socket.once('error', failFn);
            this.socket.bind(7551, () => {
                this.socket.removeListener('error', failFn);
                resolve();
            });
        });
    }
    close(reason) {
        log('Closing server', reason);
        for (const conn of this.connections.values()) {
            conn.close();
        }
        this.socket.close(() => {
            this.emit('close', reason);
            this.removeAllListeners();
        });
    }
}
exports.Server = Server;
