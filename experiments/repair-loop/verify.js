// 验证模型应答：以 agent-repairs.json 作为模型重生成结果回灌门禁，统计 L1/L2 分布与契约校验结果。
// 区别于 demo 的预置 fixHint：本次 L2 替换片段来自真实 LLM 应答。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { check } from '../../src/mcp/gate-service.js';
import { webCases } from '../../fixtures/web-cases.js';
import mpJson from '../../fixtures/mp-cases.json' with { type: 'json' };

const here = fileURLToPath(new URL('.', import.meta.url));
const agentRepairs = JSON.parse(readFileSync(`${here}agent-repairs.json`, 'utf8'));
// 模型请求来自收集阶段（已过滤 L1 可修复项），按 caseId 取该用例真正发给模型的规则
const modelRequests = JSON.parse(readFileSync(`${here}repair-requests.json`, 'utf8'));
const rulesByCase = {};
for (const r of modelRequests) (rulesByCase[r.caseId] ??= []).push(r.ruleId);

const run = { runId: 'agent-repair-run-001', date: '2026-11-11', model: 'trae-agent-llm', cases: [] };
let l1 = 0, l2 = 0, rejected = 0;

const allCases = [
  ...webCases.map((c) => ({ ...c, platform: 'h5' })),
  ...mpJson.cases.map((c) => ({ ...c, platform: 'mp-weixin' })),
];

for (const c of allCases) {
  const l2Rules = rulesByCase[c.id] ?? [];
  const fixHints = {};
  for (const rule of l2Rules) {
    if (agentRepairs[c.id]?.replacement) fixHints[rule] = { replacement: agentRepairs[c.id].replacement };
  }
  const result = check({ code: c.code, platform: c.platform, fixHints });
  const detail = result.violations.map((v) => ({
    ruleId: v.ruleId,
    level: v.regen.level,
    accepted: v.regen.accepted,
    contract: v.regen.contract?.detail ?? null,
    reason: v.regen.reason,
  }));
  for (const d of detail) {
    if (!d.accepted) rejected += 1;
    else if (d.level === 2) l2 += 1;
    else l1 += 1;
  }
  run.cases.push({ caseId: c.id, changed: result.changed, stats: result.stats, detail });
}

run.summary = {
  totalCases: allCases.length,
  interceptions: l1 + l2 + rejected,
  l1RuleRepair: l1,
  l2ModelRepairAccepted: l2,
  contractOrNoFixRejected: rejected,
  modelRequestsSource: 'experiments/repair-loop/repair-requests.json',
  agentAnswersSource: 'experiments/repair-loop/agent-repairs.json',
  caveats: [
    '修复模型为本会话中的 LLM（Trae 内置模型驱动），非独立模型 API；token 与耗时仍为估算口径，未计量',
    '修复请求与 fixtures 同源生成，且应答者参与过用例构造，存在同源偏差，结论仅用于说明链路可行',
    '未命中 L2 的规则修复与既有 run-002/run-004 一致，此处仅新增 L2 环节的真实模型应答数据',
    'WEB-CASE-010 被契约拒绝属设计内保守行为：事件改名不在契约豁免范围（仅豁免处理函数改名），语义正确的替换同样转人工，与 run-002 口径一致',
  ],
};

const outDir = fileURLToPath(new URL('../20261111/', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}agent-repair-run-001.json`, JSON.stringify(run, null, 2));
console.log(JSON.stringify(run.summary, null, 2));
