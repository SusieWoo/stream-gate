// 收集真实修复请求：空 hints 跑门禁，把规则策略无法修复的违规导出为结构化修复请求。
// 请求形如真实部署时发给模型的结构化指令：违规子树 + 规则标识与证据 + 契约要求。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildConstraintSet } from '../../src/constraints/index.js';
import { createParser, splitChunks } from '../../src/parser/incremental.js';
import { createJudge } from '../../src/judge/judge.js';
import { regenerate } from '../../src/regen/regenerate.js';
import { webCases } from '../../fixtures/web-cases.js';
import mpCasesJson from '../../fixtures/mp-cases.json' with { type: 'json' };

const requests = [];

function collect({ id, platform, code }) {
  const parser = createParser();
  const judge = createJudge(buildConstraintSet(platform));

  // 只有规则策略无法修复的违规才会作为修复请求发给模型（与真实部署一致）
  const handle = (violation, node) => {
    if (regenerate(node, violation, null).accepted) return;
    requests.push({
      caseId: id,
      platform,
      ruleId: violation.ruleId,
      nodeKind: node.kind,
      evidence: violation.evidence,
      contractRequirement:
        node.kind === 'template-element'
          ? '保留节点上全部事件绑定与除违规处理函数外的其余处理函数'
          : node.kind === 'cc-block'
            ? '保留原条件编译平台标记与 #endif 结束标记'
            : '保留语句中全部变量与函数声明',
      targetText: violation.subtree ?? node.text,
    });
  };

  for (const chunk of splitChunks(code, 2)) {
    for (const node of parser.push(chunk)) {
      for (const violation of judge.judge(node)) handle(violation, node);
    }
  }
  for (const violation of judge.finalize()) {
    handle(violation, violation.node ?? { kind: 'template-element', text: violation.handler ?? '' });
  }
}

for (const c of webCases) collect({ id: c.id, platform: 'h5', code: c.code });
for (const c of mpCasesJson.cases) collect({ id: c.id, platform: 'mp-weixin', code: c.code });

const outDir = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}repair-requests.json`, JSON.stringify(requests, null, 2));
console.log(`共 ${requests.length} 条修复请求`);
for (const r of requests) console.log(`${r.caseId}  ${r.ruleId}  [${r.nodeKind}]`);
