import { Compiler as ProtoCompiler, FullPacketParser, Serializer as ProtoSerializer } from 'protodef';
import protocol from './protocol.json';
import * as compilerTypes from './compilerTypes';

export const PACKET_TYPE = {
  DISCOVERY_REQUEST: 0,
  DISCOVERY_RESPONSE: 1,
  DISCOVERY_MESSAGE: 2
} as const;

type PacketTypeKey = keyof typeof PACKET_TYPE;
export type PacketType = (typeof PACKET_TYPE)[PacketTypeKey];

function createProtocol() {
  // ProtoDef exposes ProtoDefCompiler via the Compiler export
  const { ProtoDefCompiler } = ProtoCompiler as any;
  const compiler = new ProtoDefCompiler();
  compiler.addTypesToCompile((protocol as any).types);
  compiler.addTypes((compilerTypes as any));

  const compiledProto = compiler.compileProtoDefSync();
  return compiledProto;
}

export function createSerializer() {
  const proto = createProtocol();
  return new ProtoSerializer(proto, 'nethernet_packet');
}

export function createDeserializer() {
  const proto = createProtocol();
  return new FullPacketParser(proto, 'nethernet_packet');
}

export { createProtocol };
