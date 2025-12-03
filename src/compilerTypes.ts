// ProtoDef custom read/write/sizeof helpers for encapsulated payloads
export const [Read, Write, SizeOf]: any[] = [{}, {}, {}];

Read.encapsulated = ['parametrizable', (compiler: any, { lengthType, type }: any) => {
  return compiler.wrapCode(`
  const payloadSize = ${compiler.callType(lengthType, 'offset')}
  const { value, size } = ctx.${type}(buffer, offset + payloadSize.size)
  return { value, size: size + payloadSize.size }
`.trim());
}];

Write.encapsulated = ['parametrizable', (compiler: any, { lengthType, type }: any) => {
  return compiler.wrapCode(`
  const buf = Buffer.allocUnsafe(buffer.length - offset)
  const payloadSize = (ctx.${type})(value, buf, 0)
  let size = (ctx.${lengthType})(payloadSize, buffer, offset)
  size += buf.copy(buffer, size, 0, payloadSize)

  return size
`.trim());
}];

SizeOf.encapsulated = ['parametrizable', (compiler: any, { lengthType, type }: any) => {
  return compiler.wrapCode(`
    const payloadSize = (ctx.${type})(value)
    return (ctx.${lengthType})(payloadSize) + payloadSize
`.trim());
}];
