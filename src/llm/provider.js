// 模型输出提供者接口。门禁在命中违规时停止向提供者索取后续片段，修复后继续调用 stream() 续写。
// 真实模型接入时，实现同样的 { stream, position, done } 即可，门禁逻辑无需改动。
//  - stream(): async generator，逐块产出文本；再次调用时从 position 续写
//  - position: 当前已产出到的原文本偏移
//  - done: 是否已产出完毕
export function createStubProvider(code, { chunkSize = 120, delayMs = 0 } = {}) {
  let pos = 0;
  return {
    async *stream() {
      while (pos < code.length) {
        const piece = code.slice(pos, pos + chunkSize);
        pos += piece.length;
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        yield piece;
      }
    },
    get position() {
      return pos;
    },
    get done() {
      return pos >= code.length;
    },
  };
}
