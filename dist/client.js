"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const debug_1 = __importDefault(require("debug"));
const node_dgram_1 = __importDefault(require("node:dgram"));
const node_events_1 = require("node:events");
const connection_1 = require("./connection");
const serializer_1 = require("./serializer");
const signalling_1 = require("./signalling");
const util_1 = require("./util");
const { RTCPeerConnection, RTCIceCandidate } = require('wrtc');
const PORT = 7551;
const BROADCAST_ADDRESS = '255.255.255.255';
const SOCKET_CLOSE_TIMEOUT_MS = 100;
const log = (0, debug_1.default)('atomic-nethernet');
class Client extends node_events_1.EventEmitter {
    constructor(networkId, broadcastAddress = BROADCAST_ADDRESS) {
        super();
        this.connection = null;
        this.running = false;
        this.serverNetworkId = networkId;
        this.broadcastAddress = broadcastAddress;
        this.networkId = (0, util_1.getRandomUint64)();
        this.connectionId = (0, util_1.getRandomUint64)();
        this.socket = node_dgram_1.default.createSocket('udp4');
        this.socket.on('message', (buffer, rinfo) => {
            this.processPacket(buffer, rinfo);
        });
        this.socket.bind(() => {
            this.socket.setBroadcast(true);
        });
        this.serializer = (0, serializer_1.createSerializer)();
        this.deserializer = (0, serializer_1.createDeserializer)();
        this.responses = new Map();
        this.addresses = new Map();
        this.credentials = [];
        this.signalHandler = this.sendDiscoveryMessage.bind(this);
        this.sendDiscoveryRequest();
        this.pingInterval = setInterval(() => {
            this.sendDiscoveryRequest();
        }, 2000);
    }
    handleCandidate(signal) {
        if (!this.rtcConnection)
            return;
        const candidateInit = typeof signal.data === 'string'
            ? { candidate: signal.data, sdpMid: '0', sdpMLineIndex: 0 }
            : signal.data;
        this.rtcConnection.addIceCandidate(new RTCIceCandidate(candidateInit)).catch((err) => {
            log('Failed to add remote ICE candidate', err);
        });
    }
    handleAnswer(signal) {
        if (!this.rtcConnection)
            return;
        this.rtcConnection.setRemoteDescription({ type: 'answer', sdp: signal.data }).catch((err) => {
            log('Failed to apply remote answer', err);
        });
    }
    async createOffer() {
        this.rtcConnection = new (require('wrtc').RTCPeerConnection)({ iceServers: this.credentials });
        this.connection = new connection_1.Connection(this, this.connectionId, this.rtcConnection);
        const reliable = this.rtcConnection.createDataChannel('ReliableDataChannel', { ordered: true });
        const unreliable = this.rtcConnection.createDataChannel('UnreliableDataChannel', {
            ordered: false,
            maxRetransmits: 0
        });
        this.connection.setChannels(reliable, unreliable);
        this.rtcConnection.onicecandidate = (event) => {
            if (!event.candidate)
                return;
            this.signalHandler(new signalling_1.SignalStructure(signalling_1.SignalType.CandidateAdd, this.connectionId, event.candidate.candidate, this.serverNetworkId));
        };
        this.rtcConnection.onconnectionstatechange = () => {
            const state = this.rtcConnection?.connectionState;
            log('Client state changed', state);
            if (state === 'connected')
                this.emit('connected', this.connection);
            if (state === 'closed' || state === 'disconnected' || state === 'failed') {
                this.emit('disconnect', this.connectionId, 'disconnected');
            }
        };
        const offer = await this.rtcConnection.createOffer();
        const pattern = /^o=.*$/m;
        const newOLine = `o=- ${this.networkId} 2 IN IP4 127.0.0.1`;
        const baseSdp = offer.sdp ?? '';
        const sdp = baseSdp.replace(pattern, newOLine);
        const localDescription = { type: offer.type, sdp };
        await this.rtcConnection.setLocalDescription(localDescription);
        log('client ICE local description changed', sdp);
        this.signalHandler(new signalling_1.SignalStructure(signalling_1.SignalType.ConnectRequest, this.connectionId, sdp, this.serverNetworkId));
    }
    processPacket(buffer, rinfo) {
        const parsedPacket = (0, util_1.processSecurePacket)(buffer, this.deserializer);
        log('Received packet', parsedPacket);
        switch (parsedPacket.name) {
            case 'discovery_request':
                break;
            case 'discovery_response':
                this.handleResponse(parsedPacket, rinfo);
                break;
            case 'discovery_message':
                this.handleMessage(parsedPacket);
                break;
            default:
                throw new Error('Unknown packet type');
        }
    }
    handleResponse(packet, rinfo) {
        const senderId = BigInt(packet.params.sender_id);
        this.addresses.set(senderId, rinfo);
        this.responses.set(senderId, packet.params);
        this.emit('pong', packet.params);
    }
    handleMessage(packet) {
        const data = packet.params.data;
        if (data === 'Ping') {
            return;
        }
        const signal = signalling_1.SignalStructure.fromString(data);
        signal.networkId = BigInt(packet.params.sender_id);
        this.handleSignal(signal);
    }
    handleSignal(signal) {
        switch (signal.type) {
            case signalling_1.SignalType.ConnectResponse:
                this.handleAnswer(signal);
                break;
            case signalling_1.SignalType.CandidateAdd:
                this.handleCandidate(signal);
                break;
            default:
                break;
        }
    }
    sendDiscoveryRequest() {
        const packetData = (0, util_1.createPacketData)('discovery_request', serializer_1.PACKET_TYPE.DISCOVERY_REQUEST, this.networkId);
        const packetToSend = (0, util_1.prepareSecurePacket)(this.serializer, packetData);
        this.socket.send(packetToSend, PORT, this.broadcastAddress);
    }
    sendDiscoveryMessage(signal) {
        const rinfo = this.addresses.get(BigInt(signal.networkId ?? 0));
        if (!rinfo) {
            return;
        }
        const packetData = (0, util_1.createPacketData)('discovery_message', serializer_1.PACKET_TYPE.DISCOVERY_MESSAGE, this.networkId, {
            recipient_id: BigInt(signal.networkId ?? 0),
            data: signal.toString()
        });
        const packetToSend = (0, util_1.prepareSecurePacket)(this.serializer, packetData);
        this.socket.send(packetToSend, rinfo.port, rinfo.address);
    }
    async connect() {
        this.running = true;
        await this.createOffer();
    }
    send(buffer) {
        this.connection?.send(buffer);
    }
    ping() {
        this.running = true;
        this.sendDiscoveryRequest();
    }
    close(reason) {
        log('Closing client', reason);
        if (!this.running)
            return;
        if (this.pingInterval)
            clearInterval(this.pingInterval);
        this.connection?.close();
        setTimeout(() => this.socket.close(), SOCKET_CLOSE_TIMEOUT_MS);
        this.connection = null;
        this.running = false;
        this.removeAllListeners();
    }
}
exports.Client = Client;
