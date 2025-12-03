import debug from 'debug';
import dgram, { RemoteInfo, Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { Connection } from './connection';
import { PACKET_TYPE, createDeserializer, createSerializer } from './serializer';
import { SignalStructure, SignalType } from './signalling';
import type { IceServer } from './types';
import { createPacketData, getRandomUint64, prepareSecurePacket, processSecurePacket } from './util';

const { RTCPeerConnection, RTCIceCandidate } = require('@roamhq/wrtc');

const PORT = 7551;
const BROADCAST_ADDRESS = '255.255.255.255';
const SOCKET_CLOSE_TIMEOUT_MS = 100;

const log = debug('atomic-nethernet');

export class Client extends EventEmitter {
  public serverNetworkId: bigint;
  public broadcastAddress: string;
  public networkId: bigint;
  public connectionId: bigint;
  public socket: Socket;
  public serializer: any;
  public deserializer: any;
  public responses: Map<bigint, any>;
  public addresses: Map<bigint, RemoteInfo>;
  public credentials: (string | IceServer)[];
  public signalHandler: (signal: SignalStructure) => void;
  public connection: Connection | null = null;
  public rtcConnection?: any;
  public pingInterval?: NodeJS.Timeout;
  public running = false;

  constructor(networkId: bigint, broadcastAddress = BROADCAST_ADDRESS) {
    super();

    this.serverNetworkId = networkId;
    this.broadcastAddress = broadcastAddress;
    this.networkId = getRandomUint64();
    this.connectionId = getRandomUint64();
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (buffer, rinfo) => {
      this.processPacket(buffer, rinfo);
    });

    this.socket.bind(() => {
      this.socket.setBroadcast(true);
    });

    this.serializer = createSerializer();
    this.deserializer = createDeserializer();

    this.responses = new Map();
    this.addresses = new Map();
    this.credentials = [];
    this.signalHandler = this.sendDiscoveryMessage.bind(this);

    this.sendDiscoveryRequest();

    this.pingInterval = setInterval(() => {
      this.sendDiscoveryRequest();
    }, 2000);
  }

  handleCandidate(signal: SignalStructure) {
    if (!this.rtcConnection) return;
    const candidateInit = typeof signal.data === 'string'
      ? { candidate: signal.data, sdpMid: '0', sdpMLineIndex: 0 }
      : signal.data;
    this.rtcConnection.addIceCandidate(new RTCIceCandidate(candidateInit as any)).catch((err: any) => {
      log('Failed to add remote ICE candidate', err);
    });
  }

  handleAnswer(signal: SignalStructure) {
    if (!this.rtcConnection) return;
    this.rtcConnection.setRemoteDescription({ type: 'answer', sdp: signal.data }).catch((err: any) => {
      log('Failed to apply remote answer', err);
    });
  }

  async createOffer() {
    this.rtcConnection = new (require('@roamhq/wrtc').RTCPeerConnection)({ iceServers: this.credentials as any });

    this.connection = new Connection(this as any, this.connectionId, this.rtcConnection);

    const reliable = this.rtcConnection.createDataChannel('ReliableDataChannel', { ordered: true });
    const unreliable = this.rtcConnection.createDataChannel('UnreliableDataChannel', {
      ordered: false,
      maxRetransmits: 0
    });

    this.connection.setChannels(reliable, unreliable);

    this.rtcConnection.onicecandidate = (event: any) => {
      if (!event.candidate) return;
      this.signalHandler(
        new SignalStructure(
          SignalType.CandidateAdd,
          this.connectionId,
          event.candidate.candidate,
          this.serverNetworkId
        )
      );
    };

    this.rtcConnection.onconnectionstatechange = () => {
      const state = this.rtcConnection?.connectionState;
      log('Client state changed', state);
      if (state === 'connected') this.emit('connected', this.connection);
      if (state === 'closed' || state === 'disconnected' || state === 'failed') {
        this.emit('disconnect', this.connectionId, 'disconnected');
      }
    };

    const offer = await this.rtcConnection.createOffer();
    const pattern = /^o=.*$/m;
    const newOLine = `o=- ${this.networkId} 2 IN IP4 127.0.0.1`;
    const baseSdp = offer.sdp ?? '';
    const sdp = baseSdp.replace(pattern, newOLine);
    const localDescription = { type: offer.type, sdp } as const;

    await this.rtcConnection.setLocalDescription(localDescription);

    log('client ICE local description changed', sdp);
    this.signalHandler(
      new SignalStructure(SignalType.ConnectRequest, this.connectionId, sdp, this.serverNetworkId)
    );
  }

  processPacket(buffer: Buffer, rinfo: RemoteInfo) {
    const parsedPacket = processSecurePacket(buffer, this.deserializer);
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

  handleResponse(packet: any, rinfo: RemoteInfo) {
    const senderId = BigInt(packet.params.sender_id);
    this.addresses.set(senderId, rinfo);
    this.responses.set(senderId, packet.params);
    this.emit('pong', packet.params);
  }

  handleMessage(packet: any) {
    const data = packet.params.data;

    if (data === 'Ping') {
      return;
    }

    const signal = SignalStructure.fromString(data);

    signal.networkId = BigInt(packet.params.sender_id);

    this.handleSignal(signal);
  }

  handleSignal(signal: SignalStructure) {
    switch (signal.type) {
      case SignalType.ConnectResponse:
        this.handleAnswer(signal);
        break;
      case SignalType.CandidateAdd:
        this.handleCandidate(signal);
        break;
      default:
        break;
    }
  }

  sendDiscoveryRequest() {
    const packetData = createPacketData('discovery_request', PACKET_TYPE.DISCOVERY_REQUEST, this.networkId);
    const packetToSend = prepareSecurePacket(this.serializer, packetData);
    this.socket.send(packetToSend, PORT, this.broadcastAddress);
  }

  sendDiscoveryMessage(signal: SignalStructure) {
    const rinfo = this.addresses.get(BigInt(signal.networkId ?? 0));

    if (!rinfo) {
      return;
    }

    const packetData = createPacketData('discovery_message', PACKET_TYPE.DISCOVERY_MESSAGE, this.networkId,
      {
        recipient_id: BigInt(signal.networkId ?? 0),
        data: signal.toString()
      }
    );

    const packetToSend = prepareSecurePacket(this.serializer, packetData);
    this.socket.send(packetToSend, rinfo.port, rinfo.address);
  }

  async connect() {
    this.running = true;
    await this.createOffer();
  }

  send(buffer: Buffer | string | ArrayBuffer | ArrayBufferView) {
    this.connection?.send(buffer);
  }

  ping() {
    this.running = true;
    this.sendDiscoveryRequest();
  }

  close(reason?: string) {
    log('Closing client', reason);
    if (!this.running) return;
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.connection?.close();
    setTimeout(() => this.socket.close(), SOCKET_CLOSE_TIMEOUT_MS);
    this.connection = null;
    this.running = false;
    this.removeAllListeners();
  }
}
