// S2 增量解析器：接收流式 chunk，按语法边界产出可解析节点
// 语法边界：完整模板元素（含嵌套）、完整 JS 语句（括号配平且以 ; 收尾）、条件编译块
export function createParser() {
  let buffer = '';
  let offset = 0; // buffer[0] 在全文中的偏移
  let section = null; // 'template' | 'script' | null

  function advance(n) {
    offset += n;
    buffer = buffer.slice(n);
  }

  function push(chunk) {
    buffer += chunk;
    const nodes = [];
    for (;;) {
      const node = tryExtract();
      if (!node) break;
      nodes.push(node);
    }
    return nodes;
  }

  function tryExtract() {
    if (section === null) {
      const m = buffer.match(/^\s*(<template>|<script\s+setup>)/);
      if (!m) return null;
      advance(buffer.indexOf(m[1]) + m[1].length);
      section = m[1].startsWith('<template') ? 'template' : 'script';
      return tryExtract();
    }
    if (section === 'template') {
      const close = buffer.match(/^\s*<\/template>/);
      if (close) {
        advance(close[0].length);
        section = null;
        return tryExtract();
      }
      return extractTemplate();
    }
    const close = buffer.match(/^\s*<\/script>/);
    if (close) {
      advance(close[0].length);
      section = null;
      return tryExtract();
    }
    return extractScript();
  }

  // 模板：找到外层标签完整闭合（栈式扫描，容忍文本内容）
  function extractTemplate() {
    const first = buffer.match(/<([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>/);
    if (!first) return null;
    if (first.index > 0) {
      advance(first.index); // 跳过前导空白/文本
      return tryExtract();
    }
    if (first[3] === '/') {
      const end = first[0].length;
      const node = { kind: 'template-element', text: buffer.slice(0, end), offset };
      advance(end);
      return node;
    }
    const complete = findCompleteElement(buffer);
    if (!complete) return null;
    const node = { kind: 'template-element', text: buffer.slice(0, complete.end), offset };
    advance(complete.end);
    return node;
  }

  function findCompleteElement(buf) {
    const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>/g;
    const stack = [];
    let m;
    while ((m = re.exec(buf))) {
      const [, closing, tag, , selfClose] = m;
      if (!closing && selfClose !== '/') stack.push(tag);
      else if (closing) {
        const idx = stack.lastIndexOf(tag);
        if (idx === -1) return null;
        stack.length = idx;
        if (stack.length === 0) return { end: m.index + m[0].length };
      }
    }
    return null;
  }

  // 脚本：条件编译块 或 括号配平且以 ; 收尾的语句
  function extractScript() {
    if (/^\s*\/\/ #ifdef/.test(buffer)) {
      const end = buffer.match(/\/\/ #endif[^\n]*\n?/);
      if (!end) return null;
      const stop = end.index + end[0].length;
      const node = { kind: 'cc-block', text: buffer.slice(0, stop), offset };
      advance(stop);
      return node;
    }
    let i = buffer.indexOf('\n');
    while (i !== -1) {
      const candidate = buffer.slice(0, i + 1);
      if (isCompleteStatement(candidate)) {
        const node = { kind: 'script-stmt', text: candidate, offset };
        advance(i + 1);
        return node;
      }
      i = buffer.indexOf('\n', i + 1);
    }
    return null;
  }

  function isCompleteStatement(text) {
    const trimmed = text.trim();
    if (!trimmed) return true; // 空行直接产出
    if (trimmed.startsWith('//')) return true; // 普通注释行
    if (!bracketBalanced(text)) return false;
    return /[;}]$/.test(trimmed);
  }

  function bracketBalanced(text) {
    let curly = 0, paren = 0, square = 0;
    for (const ch of text) {
      if (ch === '{') curly++;
      else if (ch === '}') curly--;
      else if (ch === '(') paren++;
      else if (ch === ')') paren--;
      else if (ch === '[') square++;
      else if (ch === ']') square--;
      if (curly < 0 || paren < 0 || square < 0) return false;
    }
    return curly === 0 && paren === 0 && square === 0;
  }

  return { push, get section() { return section; } };
}

// 把整段代码按行数切成流式 chunk，模拟 token 流
export function splitChunks(code, linesPerChunk = 2) {
  const lines = code.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    let text = lines.slice(i, i + linesPerChunk).join('\n');
    if (i + linesPerChunk < lines.length) text += '\n';
    chunks.push(text);
  }
  return chunks;
}
