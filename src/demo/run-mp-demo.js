// 微信小程序场景：AI 生成代码实时质量门禁 demo
// 流程：S1 约束注入 → S2 流式增量解析 → S3 实时判定（中断）→ S4 局部重生成（契约校验）→ S5 证据落盘
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildConstraintSet } from '../constraints/index.js';
import { createParser, splitChunks } from '../parser/incremental.js';
import { createJudge } from '../judge/judge.js';
import { regenerate } from '../regen/regenerate.js';
import { createRecorder } from '../evidence/recorder.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtures = JSON.parse(readFileSync(join(rootDir, 'fixtures', 'mp-cases.json'), 'utf8'));

const constraints = buildConstraintSet();
const recorder = createRecorder({
  rootDir,
  runId: 'mp-gate-run-004',
  targetPlatform: constraints.targetPlatform,
});

const estTokens = (text) => Math.ceil((text || '').length / 4);

function runCase(c) {
  const parser = createParser();
  const judge = createJudge(constraints);
  const chunks = splitChunks(c.code, 2);
  const interceptions = [];
  let finalCode = '';
  let fed = 0;

  const handleViolation = (v, node, atChunk) => {
    const hint = c.fixHint?.[v.ruleId];
    const regen = regenerate(node, v, hint);
    const subtreeText = v.subtree ?? node.text;
    const promptChars = subtreeText.length + v.evidence.length + 200; // 200: 结构化修复指令开销估计
    const entry = {
      seq: interceptions.length + 1,
      atChunk,
      ruleId: v.ruleId,
      nodeExcerpt: node.text.trim().slice(0, 120),
      evidence: v.evidence,
      regen: {
        level: regen.level ?? null,
        accepted: regen.accepted,
        contract: regen.contract ?? null,
        reason: regen.reason ?? null,
        replacementExcerpt: regen.accepted ? regen.replacement.trim().slice(0, 120) : null,
      },
      tokens: {
        prompt: estTokens({ length: promptChars }),
        response: regen.accepted ? estTokens(regen.replacement) : 0,
      },
    };
    interceptions.push(entry);
    if (!regen.accepted) return;
    const reViolations = judge.judge(regen.newNode);
    if (reViolations.length > 0) {
      entry.regen.newViolations = reViolations.map((x) => x.ruleId);
      return;
    }
    finalCode = finalCode.replace(node.text, regen.newNode.text);
  };

  for (const chunk of chunks) {
    fed++;
    finalCode += chunk;
    const nodes = parser.push(chunk);
    for (const node of nodes) {
      let current = node;
      for (let round = 0; round < 3; round++) {
        const violations = judge.judge(current);
        if (violations.length === 0) {
          if (round > 0) finalCode = finalCode.replace(node.text, current.text);
          break;
        }
        handleViolation(violations[0], current, fed);
        break;
      }
    }
  }

  // 流结束：结算挂起的事件处理函数判定
  for (const v of judge.finalize()) {
    handleViolation(v, v.node, fed);
  }

  // 预标注对照：误报/漏报
  const found = new Set(interceptions.map((i) => i.ruleId));
  const expected = new Set(c.expectViolations);
  const falsePositives = [...found].filter((r) => !expected.has(r)).length;
  const falseNegatives = [...expected].filter((r) => !found.has(r)).length;

  const gateRegen = interceptions.reduce((sum, i) => sum + i.tokens.prompt + i.tokens.response, 0);
  // 基线口径：全文重生成 = prompt(全文+指令200字符) + response(全文)
  const fullRegen = interceptions.length * (2 * estTokens(c.code) + estTokens({ length: 200 }));

  const entry = {
    caseId: c.id,
    task: c.task,
    streamChunks: chunks.length,
    expectViolations: c.expectViolations,
    interceptions,
    falsePositives,
    falseNegatives,
    finalCodeViolations: finalCode === c.code ? null : '重判定见 interceptions',
    tokens: {
      original: estTokens(c.code),
      gateRegen,
      fullRegen,
      savedRatio: fullRegen > 0 ? 1 - gateRegen / fullRegen : null,
    },
  };
  recorder.recordCase(entry);
  judge.ctx.trace.forEach((t) => recorder.recordTrace({ caseId: c.id, ...t }));
  return entry;
}

const results = fixtures.cases.map(runCase);

const summary = {
  totalCases: results.length,
  casesWithInterceptions: results.filter((r) => r.interceptions.length > 0).length,
  totalInterceptions: results.reduce((s, r) => s + r.interceptions.length, 0),
  byRule: results.reduce((acc, r) => {
    r.interceptions.forEach((i) => { acc[i.ruleId] = (acc[i.ruleId] || 0) + 1; });
    return acc;
  }, {}),
  regenLevels: results.reduce((acc, r) => {
    r.interceptions.forEach((i) => { acc[`L${i.regen.level ?? '未修复'}`] = (acc[`L${i.regen.level ?? '未修复'}`] || 0) + 1; });
    return acc;
  }, {}),
  falsePositives: results.reduce((s, r) => s + r.falsePositives, 0),
  falseNegatives: results.reduce((s, r) => s + r.falseNegatives, 0),
  tokens: {
    gateRegen: results.reduce((s, r) => s + r.tokens.gateRegen, 0),
    fullRegen: results.reduce((s, r) => s + r.tokens.fullRegen, 0),
  },
};
summary.tokens.savedRatio = summary.tokens.fullRegen > 0
  ? 1 - summary.tokens.gateRegen / summary.tokens.fullRegen
  : null;

const { file, summaryFile } = recorder.finish(summary, {
  constraintSummary: {
    matrixApis: constraints.matrix.apis.length,
    catalogComponents: Object.keys(constraints.catalog).length,
    framework: constraints.framework,
  },
  notes: '预标注用例的模拟流式输出原型实验；token 为字符/4 估计值；R-CC-201 的修复片段为预置模型重生成结果。',
});

console.log('用例结果：');
for (const r of results) {
  const hit = r.interceptions.map((i) => `${i.ruleId}@chunk${i.atChunk}`).join(' ') || '无拦截';
  console.log(`  ${r.caseId}: ${hit}  误报=${r.falsePositives} 漏报=${r.falseNegatives}`);
}
console.log(`\n合计拦截 ${summary.totalInterceptions} 次，按规则：${JSON.stringify(summary.byRule)}`);
console.log(`重生成层级：${JSON.stringify(summary.regenLevels)}，误报 ${summary.falsePositives}，漏报 ${summary.falseNegatives}`);
console.log(`token 估计：门禁 ${summary.tokens.gateRegen} vs 全文基线 ${summary.tokens.fullRegen}，节省 ${(summary.tokens.savedRatio * 100).toFixed(1)}%`);
console.log(`\n证据链：${file}\n汇总：${summaryFile}`);
