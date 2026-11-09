// S5 门禁证据链记录器：每轮拦截与重生成落盘到 experiments/
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function dateStr(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

export function createRecorder({ rootDir, runId, targetPlatform }) {
  const cases = [];
  const trace = [];

  function recordCase(entry) {
    cases.push(entry);
  }

  function recordTrace(t) {
    trace.push(t);
  }

  function finish(summary, extra = {}) {
    const dir = join(rootDir, 'experiments', dateStr());
    mkdirSync(dir, { recursive: true });
    const record = {
      runId,
      date: new Date().toISOString(),
      targetPlatform,
      summary,
      cases,
      trace,
      ...extra,
    };
    const file = join(dir, `${runId}.json`);
    writeFileSync(file, JSON.stringify(record, null, 2), 'utf8');

    const summaryFile = join(rootDir, 'experiments', `summary-${dateStr()}.md`);
    if (!existsSync(summaryFile)) {
      appendFileSync(summaryFile, '# 实验记录汇总\n\n', 'utf8');
    }
    appendFileSync(summaryFile, renderSummaryMd(record), 'utf8');
    return { record, file, summaryFile };
  }

  return { recordCase, recordTrace, finish };
}

function renderSummaryMd(record) {
  const { summary } = record;
  const lines = [
    `\n## 运行 ${record.runId}（${record.date}，目标平台 ${record.targetPlatform}）\n`,
    '| 用例 | 预期违规 | 实际命中 | 拦截时点 | 重生成层级 | 契约校验 | token节省比 | 误报 |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const c of record.cases) {
    const rulesFound = [...new Set(c.interceptions.map((i) => i.ruleId))].join(', ') || '—';
    const at = c.interceptions.map((i) => `${i.atChunk}/${c.streamChunks}`).join(', ') || '—';
    const levels = c.interceptions.map((i) => i.regen.level ?? '未修复').join(', ') || '—';
    const contracts = c.interceptions.map((i) => (i.regen.contract?.ok ? '通过' : '拒绝')).join(', ') || '—';
    const ratio = c.tokens.savedRatio == null ? '—' : `${(c.tokens.savedRatio * 100).toFixed(1)}%`;
    lines.push(
      `| ${c.caseId} | ${c.expectViolations.join(', ') || '无'} | ${rulesFound} | ${at} | ${levels} | ${contracts} | ${ratio} | ${c.falsePositives} |`,
    );
  }
  lines.push(
    '',
    `- 合计拦截 ${summary.totalInterceptions} 次；误报 ${summary.falsePositives}；漏报 ${summary.falseNegatives}`,
    `- token 估计（字符/4）：门禁重生成 ${summary.tokens.gateRegen}，全文重生成基线 ${summary.tokens.fullRegen}，节省比 ${(summary.tokens.savedRatio * 100).toFixed(1)}%`,
    `- 证据链文件：${record.runId}.json`,
    '',
    '> 说明：本记录来自预标注用例的模拟流式输出原型，token 为估计值，不代表真实模型计量。',
    '',
  );
  return lines.join('\n');
}
