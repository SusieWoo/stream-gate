// H5 浏览器端专属规则（安全 / 性能），通过 extraChecks 挂到通用判定器上
import { extractElementByAttr } from '../util/subtree.js';

// R-SEC-401：v-html 直接渲染未净化内容（DOM XSS）
function checkVHtml(node) {
  const attr = node.text.match(/v-html\s*=\s*"([^"]*)"/);
  if (!attr) return [];
  const value = attr[1];
  if (/sanitize|DOMPurify|purify/i.test(value)) return [];
  return [{
    ruleId: 'R-SEC-401',
    severity: '高',
    innerOffset: attr.index,
    subtree: extractElementByAttr(node.text, 'v-html'),
    evidence: `v-html 直接渲染 ${value}，来源未经净化，存在 DOM XSS 风险；须经 sanitize 或改用文本插值`,
  }];
}

// R-PERF-501：列表 key 使用数组下标，导致复用错乱
function checkForKeyIndex(node) {
  const m = node.text.match(/:key\s*=\s*"index"/);
  if (!m) return [];
  return [{
    ruleId: 'R-PERF-501',
    severity: '低',
    innerOffset: m.index,
    subtree: extractElementByAttr(node.text, ':key="index"'),
    evidence: ':key="index" 以数组下标作列表 key，增删排序时节点复用错乱，应使用业务唯一标识',
  }];
}

// R-SEC-402：硬编码密钥 / token
function checkHardcodedSecret(node) {
  const m = node.text.match(/\b(apiToken|token|secret|password|apiKey|api_key)\s*=\s*['"]([^'"]{8,})['"]/);
  if (!m) return [];
  const masked = `${m[2].slice(0, 4)}****${m[2].slice(-2)}`;
  return [{
    ruleId: 'R-SEC-402',
    severity: '高',
    innerOffset: m.index,
    evidence: `变量 ${m[1]} 硬编码密钥（${masked}），须改为环境变量注入`,
  }];
}

export function createWebExtraChecks() {
  return {
    template: [checkVHtml, checkForKeyIndex],
    script: [checkHardcodedSecret],
  };
}
