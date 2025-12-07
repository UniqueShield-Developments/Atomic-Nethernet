"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SizeOf = exports.Write = exports.Read = void 0;
// ProtoDef custom read/write/sizeof helpers for encapsulated payloads
_a = [{}, {}, {}], exports.Read = _a[0], exports.Write = _a[1], exports.SizeOf = _a[2];
exports.Read.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
        return compiler.wrapCode(`
  const payloadSize = ${compiler.callType(lengthType, 'offset')}
  const { value, size } = ctx.${type}(buffer, offset + payloadSize.size)
  return { value, size: size + payloadSize.size }
`.trim());
    }];
exports.Write.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
        return compiler.wrapCode(`
  const buf = Buffer.allocUnsafe(buffer.length - offset)
  const payloadSize = (ctx.${type})(value, buf, 0)
  let size = (ctx.${lengthType})(payloadSize, buffer, offset)
  size += buf.copy(buffer, size, 0, payloadSize)

  return size
`.trim());
    }];
exports.SizeOf.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
        return compiler.wrapCode(`
    const payloadSize = (ctx.${type})(value)
    return (ctx.${lengthType})(payloadSize) + payloadSize
`.trim());
    }];
