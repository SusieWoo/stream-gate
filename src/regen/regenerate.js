// S4 局部定向重生成（原型）：规则修复策略 + 接口契约校验，失败时回退到父级范围（fixHint 模拟模型重生成）
// 粒度：优先以违规点的最小子树为单位重生成，而不是整个模板节点

function strategies(text, violation) {
  switch (violation.ruleId) {
    case 'R-TPL-001':
      if (!violation.suggestion) return null;
      return text
        .replaceAll(`<${violation.tag}`, `<${violation.suggestion}`)
        .replaceAll(`</${violation.tag}>`, `</${violation.suggestion}>`);
    case 'R-TPL-002':
      if (violation.value !== undefined && violation.suggestion) {
        return text.replace(
          `${violation.attr}="${violation.value}"`,
          `${violation.attr}="${violation.suggestion}"`,
        );
      }
      return null;
    case 'R-TPL-003':
      if (!violation.suggestion) return null;
      return text.replaceAll(`="${violation.handler}"`, `="${violation.suggestion}"`);
    case 'R-JS-301':
      if (!violation.suggestion) return null;
      return text.replace(new RegExp(`\\b${violation.call}\\s*\\(`), `${violation.suggestion}(`);
    case 'R-API-101':
      return fixPlatformApi(text, violation.api);
    case 'R-SEC-402':
      return text.replace(
        /(\b(?:apiToken|token|secret|password|apiKey|api_key)\s*=\s*)['"][^'"]{8,}['"]/,
        '$1import.meta.env.VITE_API_TOKEN',
      );
    case 'R-PERF-501':
      return text.replaceAll(':key="index"', ':key="item.id"');
    default:
      return null; // R-API-102 / R-CC-201 / R-SEC-401 走模型重生成
  }
}

function fixPlatformApi(text, api) {
  if (api === 'window' || api === 'location') {
    const m = text.match(/window\.location\.href\s*=\s*'([^']+)'/);
    if (m) return text.replace(m[0], `uni.navigateTo({ url: '${m[1]}' })`);
    return null;
  }
  if (api === 'localStorage') {
    return text
      .replaceAll('localStorage.setItem', 'uni.setStorageSync')
      .replaceAll('localStorage.getItem', 'uni.getStorageSync');
  }
  if (api === 'alert') return text.replace(/\balert\s*\(/, 'uni.showToast({ title: String(');
  if (api === 'wx') return text.replace(/\bwx\.request\s*\(/, 'axios.request(');
  return null;
}

// 接口契约校验：替换片段必须与已冻结节点的接口一致
function checkContract(node, violation, replacement) {
  if (node.kind === 'template-element') {
    const origEvents = [...node.text.matchAll(/@([\w-]+)=/g)].map((m) => m[1]).sort();
    const replEvents = [...replacement.matchAll(/@([\w-]+)=/g)].map((m) => m[1]).sort();
    const eventsPreserved = JSON.stringify(origEvents) === JSON.stringify(replEvents);
    const origHandlers = [...node.text.matchAll(/@[\w-]+="([^"]+)"/g)].map((m) => m[1]);
    const replHandlers = [...replacement.matchAll(/@[\w-]+="([^"]+)"/g)].map((m) => m[1]);
    // 允许被修复的 handler 改名，其余必须保留
    const othersKept = origHandlers
      .filter((h) => h !== violation.handler)
      .every((h) => replHandlers.includes(h));
    return {
      ok: eventsPreserved && othersKept,
      eventsPreserved,
      othersKept,
      detail: `事件集合 [${origEvents}] → [${replEvents}]`,
    };
  }
  if (node.kind === 'script-stmt') {
    const declRe = /(?:const|let|var|function)\s+([a-zA-Z_$][\w$]*)/g;
    const origDecls = [...node.text.matchAll(declRe)].map((m) => m[1]);
    const declsKept = origDecls.every((d) => new RegExp(`\\b${d}\\b`).test(replacement));
    return { ok: declsKept, declsKept, detail: `声明保留 [${origDecls.join(', ')}]` };
  }
  if (node.kind === 'cc-block') {
    const marker = node.text.match(/\/\/ #ifdef (\S+)/)?.[1];
    const ok = Boolean(marker) && replacement.includes(`#ifdef ${marker}`) && replacement.includes('#endif');
    return { ok, platformMarkerPreserved: ok, detail: `平台标记 ${marker} 保留` };
  }
  return { ok: true };
}

export function regenerate(node, violation, fixHint) {
  // 重生成目标：违规点最小子树优先，取不到时退化为整个节点
  const targetText = violation.subtree ?? node.text;
  const isSubtree = targetText !== node.text;
  const contractNode = isSubtree ? { ...node, text: targetText } : node;

  let replacement = strategies(targetText, violation);
  let level = 1;
  if (replacement == null && fixHint?.replacement != null) {
    replacement = fixHint.replacement;
    level = 2; // 规则策略无法处理，回退到模型按结构化修复指令重生成
  }
  if (replacement == null) {
    return { accepted: false, reason: '无规则修复策略且未获得模型重生成结果' };
  }
  let contract = checkContract(contractNode, violation, replacement);
  if (!contract.ok && level === 1 && fixHint?.replacement != null) {
    replacement = fixHint.replacement;
    level = 2;
    contract = checkContract(contractNode, violation, replacement);
  }
  if (!contract.ok) {
    return { accepted: false, level, contract, reason: '替换片段与已冻结节点接口契约不一致' };
  }
  return {
    accepted: true,
    level,
    replacement,
    newNode: { ...node, text: isSubtree ? node.text.replace(targetText, replacement) : replacement },
    contract,
  };
}
