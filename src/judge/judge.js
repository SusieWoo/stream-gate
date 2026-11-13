// S3 实时判定器：对 parser 产出的节点按规则集判定
import { buildConstraintSet } from '../constraints/index.js';
import { extractSubtree } from '../util/subtree.js';

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'function', 'catch', 'new', 'typeof', 'async', 'await', 'class']);

export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function closest(name, candidates) {
  let best = null, dist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < dist) { dist = d; best = c; }
  }
  return dist <= 2 ? { name: best, distance: dist } : null;
}

export function createJudge(constraints = buildConstraintSet()) {
  const ctx = {
    constraints,
    declared: new Set([
      'uni', 'console', 'defineProps', 'defineEmits', 'props', 'emit',
      ...(constraints.globals ?? []),
    ]),
    matrix: new Map(constraints.matrix.apis.map((a) => [a.api, a])),
    catalogNames: Object.keys(constraints.catalog),
    pending: [], // 证据不足挂起：模板先于脚本到达时，事件处理函数声明未知
    trace: [], // 条件编译切片等非违规轨迹
  };

  function judge(node) {
    let violations = [];
    if (node.kind === 'template-element') violations = judgeTemplate(node, ctx);
    else if (node.kind === 'script-stmt') violations = judgeScript(node, ctx);
    else if (node.kind === 'cc-block') violations = judgeCc(node, ctx);
    // 平台专属规则（如 H5 的安全/性能规则）
    const hooks = node.kind === 'template-element'
      ? ctx.constraints.extraChecks?.template
      : node.kind === 'script-stmt' ? ctx.constraints.extraChecks?.script : null;
    for (const fn of hooks ?? []) violations = violations.concat(fn(node, ctx));
    return violations;
  }

  // 流结束时结算挂起项：声明到达则解除，仍未声明判违规
  function finalize() {
    const violations = [];
    for (const p of ctx.pending) {
      if (ctx.declared.has(p.handler)) {
        ctx.trace.push({ type: 'pending-resolved', handler: p.handler, note: '声明随后到达，挂起判定解除' });
        continue;
      }
      const near = closest(p.handler, [...ctx.declared]);
      violations.push({
        ruleId: 'R-TPL-003', node: p.node, tag: p.tag, handler: p.handler,
        innerOffset: p.innerOffset,
        suggestion: near?.name,
        subtree: extractSubtree(p.node.text, p.tag),
        evidence: `事件处理函数 ${p.handler} 直至流结束未在脚本中声明` + (near ? `，最相近已声明项 ${near.name}` : ''),
      });
    }
    ctx.pending = [];
    return violations;
  }

  return { judge, finalize, ctx };
}

function parseTags(text) {
  const re = /<([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)\/?>/g;
  const tags = [];
  let m;
  while ((m = re.exec(text))) {
    tags.push({
      tag: m[1],
      attrs: parseAttrs(m[2] || ''),
      index: m.index,
      attrsBase: m.index + 1 + m[1].length,
    });
  }
  return tags;
}

function parseAttrs(attrText) {
  const re = /([:@a-zA-Z_][\w:.-]*)(?:\s*=\s*"([^"]*)")?/g;
  const attrs = [];
  let m;
  while ((m = re.exec(attrText))) attrs.push({ name: m[1], value: m[2], index: m.index });
  return attrs;
}

function judgeTemplate(node, ctx) {
  const violations = [];
  const tags = parseTags(node.text);
  for (const { tag, attrs, index, attrsBase } of tags) {
    // R-TPL-001 标签存在性
    if (!ctx.constraints.nativeTags.includes(tag) && !ctx.catalogNames.includes(tag)) {
      const near = closest(tag, ctx.catalogNames);
      violations.push({
        ruleId: 'R-TPL-001',
        tag,
        innerOffset: index,
        suggestion: near?.name,
        subtree: extractSubtree(node.text, tag),
        evidence: `标签 ${tag} 不在组件清单内` + (near ? `，最相近合法项 ${near.name}（编辑距离 ${near.distance}）` : ''),
      });
      continue; // 未知标签不做属性校验
    }
    const spec = ctx.constraints.catalog[tag];
    if (!spec) continue; // 原生标签跳过属性/事件校验
    for (const attr of attrs) {
      // 属性名统一转驼峰：label-width → labelWidth、model-value → modelValue
      const bare = attr.name.replace(/^:/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (attr.name.startsWith('v-') || ['class', 'style', 'key'].includes(bare)) continue;
      // R-TPL-003 事件绑定目标：声明证据不足时挂起，流结束统一结算
      if (attr.name.startsWith('@')) {
        const event = attr.name.slice(1);
        if (!spec.events.includes(event)) {
          violations.push({
            ruleId: 'R-TPL-002', tag, attr: `@${event}`,
            innerOffset: attrsBase + attr.index,
            subtree: extractSubtree(node.text, tag),
            evidence: `组件 ${tag} 不支持事件 ${event}，合法事件：${spec.events.join(', ') || '（无）'}`,
          });
        } else if (attr.value && /^[a-zA-Z_$][\w$]*$/.test(attr.value) && !ctx.declared.has(attr.value)) {
          ctx.pending.push({ node, tag, handler: attr.value, innerOffset: attrsBase + attr.index });
        }
        continue;
      }
      // R-TPL-002 属性与取值
      const prop = spec.props[bare];
      if (!prop) {
        violations.push({
          ruleId: 'R-TPL-002', tag, attr: bare,
          innerOffset: attrsBase + attr.index,
          subtree: extractSubtree(node.text, tag),
          evidence: `组件 ${tag} 不支持属性 ${bare}，合法属性：${Object.keys(spec.props).join(', ')}`,
        });
      } else if (prop.enum && attr.value && !attr.name.startsWith(':') && !prop.enum.includes(attr.value)) {
        violations.push({
          ruleId: 'R-TPL-002', tag, attr: bare, value: attr.value, suggestion: prop.enum[prop.enum.length - 1],
          innerOffset: attrsBase + attr.index,
          subtree: extractSubtree(node.text, tag),
          evidence: `属性 ${bare} 取值 ${attr.value} 不在枚举 [${prop.enum.join(', ')}] 内`,
        });
      }
    }
  }
  return violations;
}

function judgeScript(node, ctx) {
  const text = node.text;
  const violations = [];
  // 先收集本语句中的声明
  const declRe = /(?:const|let|var|function)\s+([a-zA-Z_$][\w$]*)/g;
  let m;
  while ((m = declRe.exec(text))) ctx.declared.add(m[1]);

  // R-API-101 平台禁用 API
  for (const [api, info] of ctx.matrix) {
    if (info.supported) continue;
    if (api.startsWith('uni.')) continue;
    const re = new RegExp(`\\b${api}\\b`);
    const apiHit = re.exec(text);
    if (apiHit) {
      violations.push({
        ruleId: 'R-API-101', api,
        innerOffset: apiHit.index,
        evidence: `${api} 在目标平台不可用：${info.reason}` + (info.alternative ? `，可替换为 ${info.alternative}` : ''),
      });
    }
  }
  // R-API-102 uni.* 白名单
  const uniRe = /\buni\.(\w+)/g;
  while ((m = uniRe.exec(text))) {
    const full = `uni.${m[1]}`;
    const info = ctx.matrix.get(full);
    if (!info || !info.supported) {
      violations.push({ ruleId: 'R-API-102', api: full, innerOffset: m.index, evidence: `${full} 不在目标平台 API 白名单内` });
    }
  }
  // R-JS-301 调用目标必须已声明
  const callRe = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
  while ((m = callRe.exec(text))) {
    const name = m[1];
    if (KEYWORDS.has(name)) continue;
    if (m.index > 0 && text[m.index - 1] === '.') continue; // 方法调用
    if (ctx.declared.has(name)) continue;
    const near = closest(name, [...ctx.declared]);
    violations.push({
      ruleId: 'R-JS-301', call: name,
      innerOffset: m.index,
      suggestion: near?.name,
      evidence: `调用的函数 ${name} 未声明` + (near ? `，最相近已声明项 ${near.name}` : ''),
    });
  }
  return violations;
}

function judgeCc(node, ctx) {
  const m = node.text.match(/\/\/ #ifdef (\S+)\n([\s\S]*?)\/\/ #endif/);
  if (!m) return [];
  const platforms = m[1].toLowerCase().split('|');
  const target = ctx.constraints.targetPlatform;
  if (!platforms.includes(target)) {
    ctx.trace.push({ type: 'cc-sliced', platform: platforms.join('|'), note: `目标平台 ${target} 切片后该块不生效，未判定` });
    return [];
  }
  const content = m[2]
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('//'))
    .join('\n')
    .trim();
  if (!content) {
    return [{
      ruleId: 'R-CC-201',
      evidence: `条件编译块 #ifdef ${m[1]} 在目标平台 ${target} 切片后为空（仅注释或无内容）`,
    }];
  }
  // 块内内容按脚本语句规则判定
  return judgeScript({ kind: 'script-stmt', text: content }, ctx);
}
