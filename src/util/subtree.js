// 从节点文本中提取指定标签的最小完整子树（重生成粒度按子树计）
export function extractSubtree(text, tag) {
  const start = text.indexOf(`<${tag}`);
  if (start === -1) return null;
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>/g;
  re.lastIndex = start;
  const stack = [];
  let m;
  while ((m = re.exec(text))) {
    const [, closing, t, , selfClose] = m;
    if (!closing) {
      if (selfClose === '/') {
        if (stack.length === 0) return text.slice(start, m.index + m[0].length);
      } else stack.push(t);
    } else {
      const idx = stack.lastIndexOf(t);
      if (idx === -1) return null;
      stack.length = idx;
      if (stack.length === 0) return text.slice(start, m.index + m[0].length);
    }
  }
  return null;
}

// 按属性片段定位其所属元素（用于属性级违规的最小子树）
export function extractElementByAttr(text, attrSnippet) {
  const holder = text.indexOf(attrSnippet);
  if (holder === -1) return null;
  for (const m of text.matchAll(/<([a-zA-Z][\w-]*)([^<>]*)>([\s\S]*?)<\/\1>/g)) {
    if (m.index <= holder && holder <= m.index + m[0].length) return m[0];
  }
  const selfClose = text.match(/<([a-zA-Z][\w-]*)([^<>]*)>/);
  return holder !== -1 ? selfClose?.[0] ?? null : null;
}
