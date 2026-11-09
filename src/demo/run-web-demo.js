// H5 浏览器场景：AI 生成代码实时质量门禁 demo
// 流程：S1 约束注入 → S2 流式增量解析 → S3 实时判定（中断）→ S4 子树级重生成（契约校验）→ S5 证据落盘
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webCases } from '../../fixtures/web-cases.js';
import { buildConstraintSet } from '../constraints/index.js';
import { createParser, splitChunks } from '../parser/incremental.js';
import { createJudge } from '../judge/judge.js';
import { regenerate } from '../regen/regenerate.js';
import { createRecorder } from '../evidence/recorder.js';
import { severityOf } from '../rules/rules.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const constraints = buildConstraintSet('h5');
const RUN_ID = process.argv[2] ?? 'web-gate-run-001';

// 中文按 1 字 1 token、ASCII 按 4 字符 1 token 估算，避免纯字符除法低估
const estTokens = (text = '') => {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  return Math.ceil(cjk + (text.length - cjk) / 4);
};

// 与流式生成耗时无关的门禁固定开销（构造修复指令、契约校验）
const REGEN_OVERHEAD_MS = 120;
const MS_PER_TOKEN = 1.8;

const recorder = createRecorder({ rootDir, runId: RUN_ID, targetPlatform: constraints.targetPlatform });

function runCase(c) {
  const parser = createParser();
  const judge = createJudge(constraints);
  const chunks = splitChunks(c.code, 2);
  const interceptions = [];
  let finalCode = '';
  let fed = 0;

  function handle(v, node, atChunk) {
    const hint = c.fixHint?.[v.ruleId];
    const regen = regenerate(node, v, hint);
    const targetText = v.subtree ?? node.text;
    const promptChars = targetText.length + v.evidence.length + 200;
    const entry = {
      seq: interceptions.length + 1,
      atChunk,
      ruleId: v.ruleId,
      severity: severityOf(v.ruleId),
      evidence: v.evidence,
      regen: {
        level: regen.level ?? null,
        accepted: regen.accepted,
        contract: regen.contract ?? null,
        reason: regen.reason ?? null,
        replacementExcerpt: regen.accepted ? regen.replacement.trim().slice(0, 120) : null,
      },
      tokens: {
        prompt: estTokens(String(promptChars)),
        response: regen.accepted ? estTokens(regen.replacement) : 0,
      },
    };
    interceptions.push(entry);
    return regen;
  }

  function processNode(node) {
    let current = node;
    for (let round = 0; round < 4; round++) {
      const violations = judge.judge(current);
      if (violations.length === 0) {
        if (current !== node) finalCode = finalCode.replace(node.text, current.text);
        return;
      }
      const v = violations[0];
      const regen = handle(v, current, fed);
      if (!regen.accepted) return;
      // 已修复的事件处理函数从挂起表中移除，避免流结束时重复判定
      if (v.ruleId === 'R-TPL-003' && v.handler) {
        judge.ctx.pending = judge.ctx.pending.filter((p) => p.handler !== v.handler);
      }
      current = regen.newNode;
      // 直接写回，保证后续节点偏移与最终代码一致
      finalCode = finalCode.replace(node.text, current.text);
      node = current;
    }
    interceptions[interceptions.length - 1].unresolvedAfterRounds = true;
  }

  for (const chunk of chunks) {
    fed++;
    finalCode += chunk;
    for (const node of parser.push(chunk)) processNode(node);
  }
  // 流结束：结算挂起项（模板先于脚本到达时的事件处理函数）
  for (const v of judge.finalize()) {
    const regen = handle(v, v.node, fed);
    if (regen.accepted) finalCode = finalCode.replace(v.node.text, regen.newNode.text);
  }

  const found = new Set(interceptions.map((i) => i.ruleId));
  const expected = new Set(c.expectViolations);
  const falsePositives = [...found].filter((r) => !expected.has(r)).length;
  const falseNegatives = [...expected].filter((r) => !found.has(r)).length;

  const gateTokens = interceptions.reduce((s, i) => s + i.tokens.prompt + i.tokens.response, 0);
  // 基线口径：该用例发现缺陷后整文件重生成一次（prompt 全文 + response 全文）
  const baselineTokens = interceptions.length
    ? 2 * estTokens(c.code) + estTokens('结构化修复指令')
    : 0;
  const gateMs = Math.round(gateTokens * MS_PER_TOKEN + interceptions.length * REGEN_OVERHEAD_MS);
  const baselineMs = Math.round(baselineTokens * MS_PER_TOKEN + interceptions.length * REGEN_OVERHEAD_MS);

  const entry = {
    caseId: c.id,
    task: c.task,
    codeLines: c.code.trim().split('\n').length,
    streamChunks: chunks.length,
    expectViolations: c.expectViolations,
    interceptions,
    falsePositives,
    falseNegatives,
    tokens: {
      original: estTokens(c.code),
      gateRegen: gateTokens,
      fullRegen: baselineTokens,
      savedRatio: baselineTokens > 0 ? 1 - gateTokens / baselineTokens : null,
    },
    latency: { gateMs, baselineMs },
  };
  recorder.recordCase(entry);
  judge.ctx.trace.forEach((t) => recorder.recordTrace({ caseId: c.id, ...t }));
  return entry;
}

const results = webCases.map(runCase);

const byRule = {};
const bySeverity = {};
const regenLevels = {};
for (const r of results) {
  for (const i of r.interceptions) {
    byRule[i.ruleId] = (byRule[i.ruleId] || 0) + 1;
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
    const key = i.regen.accepted ? `L${i.regen.level}` : 'L0-未修复';
    regenLevels[key] = (regenLevels[key] || 0) + 1;
  }
}

const summary = {
  totalCases: results.length,
  totalLines: results.reduce((s, r) => s + r.codeLines, 0),
  casesWithInterceptions: results.filter((r) => r.interceptions.length > 0).length,
  totalInterceptions: results.reduce((s, r) => s + r.interceptions.length, 0),
  byRule,
  bySeverity,
  regenLevels,
  contractRejections: results.reduce(
    (s, r) => s + r.interceptions.filter((i) => !i.regen.accepted && i.regen.contract).length, 0),
  falsePositives: results.reduce((s, r) => s + r.falsePositives, 0),
  falseNegatives: results.reduce((s, r) => s + r.falseNegatives, 0),
  tokens: {
    gateRegen: results.reduce((s, r) => s + r.tokens.gateRegen, 0),
    fullRegen: results.reduce((s, r) => s + r.tokens.fullRegen, 0),
  },
  latency: {
    gateMs: results.reduce((s, r) => s + r.latency.gateMs, 0),
    baselineMs: results.reduce((s, r) => s + r.latency.baselineMs, 0),
  },
};
summary.tokens.savedRatio = summary.tokens.fullRegen > 0
  ? 1 - summary.tokens.gateRegen / summary.tokens.fullRegen : null;
summary.latency.savedRatio = summary.latency.baselineMs > 0
  ? 1 - summary.latency.gateMs / summary.latency.baselineMs : null;

const { file, summaryFile } = recorder.finish(summary, {
  constraintSummary: {
    matrixApis: constraints.matrix.apis.length,
    catalogComponents: Object.keys(constraints.catalog).length,
    extraRuleHooks: (constraints.extraChecks?.template?.length ?? 0) + (constraints.extraChecks?.script?.length ?? 0),
    framework: constraints.framework,
  },
  notes: '预标注用例的模拟流式输出原型实验；耗时为 token×1.8ms 的估算值，非真实墙钟时间；fixHint 为预置模型重生成结果。',
});

console.log('用例结果：');
for (const r of results) {
  const hit = r.interceptions.map((i) => `${i.ruleId}@${i.atChunk}/${r.streamChunks}`).join(' ') || '无拦截';
  const flag = r.falsePositives || r.falseNegatives ? `  误报=${r.falsePositives} 漏报=${r.falseNegatives}` : '';
  console.log(`  ${r.caseId} (${r.codeLines}行): ${hit}${flag}`);
}
console.log(`\n合计 ${summary.totalCases} 个用例 / ${summary.totalLines} 行代码，拦截 ${summary.totalInterceptions} 次`);
console.log(`按规则：${JSON.stringify(summary.byRule)}`);
console.log(`按严重级：${JSON.stringify(summary.bySeverity)}，重生成层级：${JSON.stringify(summary.regenLevels)}`);
console.log(`契约校验拒绝 ${summary.contractRejections} 次，误报 ${summary.falsePositives}，漏报 ${summary.falseNegatives}`);
console.log(`token：门禁 ${summary.tokens.gateRegen} vs 全文基线 ${summary.tokens.fullRegen}，节省 ${(summary.tokens.savedRatio * 100).toFixed(1)}%`);
console.log(`耗时估算：门禁 ${summary.latency.gateMs}ms vs 基线 ${summary.latency.baselineMs}ms，节省 ${(summary.latency.savedRatio * 100).toFixed(1)}%`);
console.log(`\n证据链：${file}\n汇总：${summaryFile}`);
