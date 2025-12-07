declare module 'wrtc' {
  export interface RTCIceCandidateInit {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  }

  export class RTCIceCandidate {
    constructor(init: RTCIceCandidateInit);
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
  }

  export interface RTCDataChannel {
    label: string;
    readyState: string;
    binaryType: string;
    onmessage: ((event: { data: any }) => void) | null;
    onopen: (() => void) | null;
    close(): void;
    send(data: any): void;
  }

  export interface RTCSessionDescriptionInit {
    type: 'offer' | 'answer';
    sdp?: string;
  }

  export interface RTCPeerConnectionIceEvent {
    candidate: RTCIceCandidate | null;
  }

  export interface RTCPeerConnection {
    connectionState: string;
    localDescription: RTCSessionDescriptionInit | null;
    onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
    onconnectionstatechange: (() => void) | null;
    ondatachannel: ((event: { channel: RTCDataChannel }) => void) | null;
    createDataChannel(label: string, options?: any): RTCDataChannel;
    createOffer(): Promise<RTCSessionDescriptionInit>;
    createAnswer(): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidate | RTCIceCandidateInit): Promise<void>;
    close(): void;
  }
}
