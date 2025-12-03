import debug from 'debug';
import dgram, { RemoteInfo, Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { Connection } from './connection';
import { PACKET_TYPE, createDeserializer, createSerializer } from './serializer';
import { SignalStructure, SignalType } from './signalling';
import type { IceServer, ServerOptions } from './types';
import { createPacketData, getRandomUint64, prepareSecurePacket, processSecurePacket } from './util';

const { RTCPeerConnection, RTCIceCandidate } = require('@roamhq/wrtc');

const log = debug('atomic-nethernet');

export class Server extends EventEmitter {
  public options: ServerOptions;
  public networkId: bigint;
  public connections: Map<bigint, Connection>;
  public advertisement?: Buffer;
  public socket!: Socket;
  public serializer: any;
  public deserializer: any;

  constructor(options: ServerOptions = {}) {
    super();
    this.options = options;
    this.networkId = options.networkId ?? getRandomUint64();
    this.connections = new Map();
    this.serializer = createSerializer();
    this.deserializer = createDeserializer();
  }

  handleCandidate(signal: SignalStructure) {
    const conn = this.connections.get(signal.connectionId);

    if (!conn) {
      log('Connection not found', signal.connectionId);
      return;
    }

    const candidateInit = typeof signal.data === 'string'
      ? { candidate: signal.data, sdpMid: '0', sdpMLineIndex: 0 }
      : signal.data;
    conn.rtcConnection.addIceCandidate(new RTCIceCandidate(candidateInit as any)).catch((err: any) => {
      log('Failed to add ICE candidate on server', err);
    });
  }

  async handleOffer(signal: SignalStructure, respond: (signal: SignalStructure) => void, credentials: (string | IceServer)[] = []) {
    const rtcConnection = new RTCPeerConnection({ iceServers: credentials });
    const connection = new Connection(this as any, signal.connectionId, rtcConnection);

    this.connections.set(signal.connectionId, connection);

    log('Received offer', signal.connectionId);

    rtcConnection.onicecandidate = (event: any) => {
      if (!event.candidate) return;
      respond(
        new SignalStructure(
          SignalType.CandidateAdd,
          signal.connectionId,
          event.candidate.candidate,
          signal.networkId
        )
      );
    };

    rtcConnection.ondatachannel = (event: { channel: any; }) => {
      const channel = event.channel;
      log('Received data channel', channel.label);
      if (channel.label === 'ReliableDataChannel') connection.setChannels(channel);
      if (channel.label === 'UnreliableDataChannel') connection.setChannels(null, channel);
    };

    rtcConnection.onconnectionstatechange = () => {
      const state = rtcConnection.connectionState;
      log('Server RTC state changed', state);
      if (state === 'connected') this.emit('openConnection', connection);
      if (state === 'closed' || state === 'disconnected' || state === 'failed') {
        this.emit('closeConnection', signal.connectionId, 'disconnected');
      }
    };

    await rtcConnection.setRemoteDescription({ type: 'offer', sdp: signal.data });
    const answer = await rtcConnection.createAnswer();
    await rtcConnection.setLocalDescription(answer);
    const answerSdp = rtcConnection.localDescription?.sdp ?? answer.sdp ?? '';
    respond(
      new SignalStructure(SignalType.ConnectResponse, signal.connectionId, answerSdp, signal.networkId)
    );
  }

  processPacket(buffer: Buffer, rinfo: RemoteInfo) {
    const parsedPacket = processSecurePacket(buffer, this.deserializer);
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

  setAdvertisement(buffer: Buffer) {
    this.advertisement = buffer;
  }

  handleRequest(rinfo: RemoteInfo) {
    const data = this.advertisement;

    if (!data) {
      throw new Error('Advertisement data not set yet');
    }

    const packetData = createPacketData('discovery_response', PACKET_TYPE.DISCOVERY_RESPONSE, this.networkId,
      {
        data: data.toString('hex')
      }
    );

    const packetToSend = prepareSecurePacket(this.serializer, packetData);
    this.socket.send(packetToSend, rinfo.port, rinfo.address);
  }

  handleMessage(packet: any, rinfo: RemoteInfo) {
    const data = packet.params.data;
    if (data === 'Ping') {
      return;
    }

    const respond = (signal: SignalStructure) => {
      const packetData = createPacketData('discovery_message', PACKET_TYPE.DISCOVERY_MESSAGE, this.networkId,
        {
          recipient_id: BigInt(signal.networkId ?? 0),
          data: signal.toString()
        }
      );

      const packetToSend = prepareSecurePacket(this.serializer, packetData);
      this.socket.send(packetToSend, rinfo.port, rinfo.address);
    };

    const signal = SignalStructure.fromString(data);

    signal.networkId = BigInt(packet.params.sender_id);

    switch (signal.type) {
      case SignalType.ConnectRequest:
        this.handleOffer(signal, respond);
        break;
      case SignalType.CandidateAdd:
        this.handleCandidate(signal);
        break;
      default:
        break;
    }
  }

  async listen() {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (buffer, rinfo) => {
      this.processPacket(buffer, rinfo);
    });

    await new Promise<void>((resolve, reject) => {
      const failFn = (e: Error) => reject(e);
      this.socket.once('error', failFn);
      this.socket.bind(7551, () => {
        this.socket.removeListener('error', failFn);
        resolve();
      });
    });
  }

  close(reason?: string) {
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
