"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKET_TYPE = void 0;
exports.createSerializer = createSerializer;
exports.createDeserializer = createDeserializer;
exports.createProtocol = createProtocol;
const protodef_1 = require("protodef");
const protocol_json_1 = __importDefault(require("./protocol.json"));
const compilerTypes = __importStar(require("./compilerTypes"));
exports.PACKET_TYPE = {
    DISCOVERY_REQUEST: 0,
    DISCOVERY_RESPONSE: 1,
    DISCOVERY_MESSAGE: 2
};
function createProtocol() {
    // ProtoDef exposes ProtoDefCompiler via the Compiler export
    const { ProtoDefCompiler } = protodef_1.Compiler;
    const compiler = new ProtoDefCompiler();
    compiler.addTypesToCompile(protocol_json_1.default.types);
    compiler.addTypes(compilerTypes);
    const compiledProto = compiler.compileProtoDefSync();
    return compiledProto;
}
function createSerializer() {
    const proto = createProtocol();
    return new protodef_1.Serializer(proto, 'nethernet_packet');
}
function createDeserializer() {
    const proto = createProtocol();
    return new protodef_1.FullPacketParser(proto, 'nethernet_packet');
}
