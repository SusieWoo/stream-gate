// 门禁服务：把 S1-S5 封装为与宿主无关的两个能力
//  - check():    对已有代码做一次性门禁（不中断，等价于批量判定）
//  - generate(): 驱动模型的流式输出，边产出边判定，命中违规即中断并续写
import { buildConstraintSet } from '../constraints/index.js';
import { createParser, splitChunks } from '../parser/incremental.js';
import { createJudge } from '../judge/judge.js';
import { regenerate } from '../regen/regenerate.js';
import { severityOf } from '../rules/rules.js';

const MAX_ROUNDS = 4;
const MAX_INTERRUPTS = 50;
const PLATFORMS = ['h5', 'mp-weixin'];

function assertPlatform(platform) {
  if (!PLATFORMS.includes(platform)) {
    throw new Error(`不支持的平台: ${platform}，可选值 ${PLATFORMS.join(' / ')}`);
  }
}

function createSession({ platform, fixHints }) {
  assertPlatform(platform);
  const constraints = buildConstraintSet(platform);
  const parser = createParser();
  const judge = createJudge(constraints);
  const trace = [];
  let seq = 0;

  function record(violation, regen, round, offset = null) {
    seq += 1;
    trace.push({
      seq,
      round,
      offset,
      ruleId: violation.ruleId,
      severity: severityOf(violation.ruleId),
      evidence: violation.evidence,
      regen: {
        level: regen.level ?? null,
        accepted: Boolean(regen.accepted),
        contract: regen.contract ?? null,
        reason: regen.reason ?? null,
        replacementExcerpt: regen.accepted ? regen.replacement.trim().slice(0, 120) : null,
      },
    });
  }

  // 对单个已闭合节点做判定与多轮修复。返回 replacement 表示该节点整体应被替换的文本。
  // reportAll: 契约拒绝后继续展开该节点剩余违规（供 lint 使用），不改变流式门禁语义
  function processNode(node, reportAll = false) {
    let current = node;
    const skipped = new Set();
    const maxRounds = reportAll ? 50 : MAX_ROUNDS;
    for (let round = 0; round < maxRounds; round++) {
      const violations = judge.judge(current).filter((v) => !skipped.has(`${v.ruleId}|${v.evidence}`));
      if (violations.length === 0) {
        return { replacement: round === 0 ? null : current.text };
      }
      const violation = violations[0];
      const regen = regenerate(current, violation, fixHints[violation.ruleId]);
      record(violation, regen, round + 1, (current.offset ?? 0) + (violation.innerOffset ?? 0));
      if (!regen.accepted) {
        if (reportAll) {
          skipped.add(`${violation.ruleId}|${violation.evidence}`);
          continue;
        }
        return {
          needsHuman: true,
          replacement: round === 0 ? null : current.text,
          reason: regen.reason ?? '替换片段未通过校验',
          violation,
        };
      }
      // 已修复的事件处理函数从挂起表移除，避免流结束时重复判定
      if (violation.ruleId === 'R-TPL-003' && violation.handler) {
        judge.ctx.pending = judge.ctx.pending.filter((p) => p.handler !== violation.handler);
      }
      current = regen.newNode;
    }
    return { needsHuman: true, replacement: current.text, reason: '超过重生成轮次上限' };
  }

  return { platform, constraints, parser, judge, trace, processNode, record };
}

function summarize(session, extra) {
  const rules = [...new Set(session.trace.map((t) => t.ruleId))];
  return {
    platform: session.platform,
    framework: session.constraints.framework,
    constraints: {
      apis: session.constraints.matrix.apis.length,
      components: Object.keys(session.constraints.catalog).length,
    },
    stats: {
      interceptions: session.trace.length,
      rules,
      rulesHit: rules.length,
      ...extra,
    },
    violations: session.trace,
  };
}

// 一次性门禁：不驱动模型，按行切分后逐节点判定与修复
export function check({ code, platform = 'h5', fixHints = {}, linesPerChunk = 2, reportAll = false }) {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new Error('code 不能为空');
  }
  const session = createSession({ platform, fixHints });
  let finalCode = '';

  for (const chunk of splitChunks(code, linesPerChunk)) {
    finalCode += chunk;
    for (const node of session.parser.push(chunk)) {
      const result = session.processNode(node, reportAll);
      if (result.replacement !== null) {
        finalCode = finalCode.replace(node.text, result.replacement);
      }
    }
  }

  // 流结束结算挂起项（模板先于脚本到达的事件处理函数）
  for (const violation of session.judge.finalize()) {
    const regen = regenerate(violation.node, violation, fixHints[violation.ruleId]);
    session.record(violation, regen, 1, (violation.node?.offset ?? 0) + (violation.innerOffset ?? 0));
    if (regen.accepted) {
      finalCode = finalCode.replace(violation.node.text, regen.newNode.text);
    }
  }

  const summary = summarize(session, { mode: 'check', chunks: splitChunks(code, linesPerChunk).length });
  summary.violations = summary.violations.map((v) => ({ ...v, loc: locate(code, v.offset) }));
  return {
    code: finalCode,
    changed: finalCode !== code,
    ...summary,
  };
}

// 字符偏移 → 1 基行列，供 ESLint/CLI 定位
function locate(code, offset) {
  if (typeof offset !== 'number' || offset < 0) return null;
  const before = code.slice(0, offset);
  const lastBreak = before.lastIndexOf('\n');
  return { line: before.split('\n').length, column: offset - lastBreak };
}

// 流式门禁：驱动提供者产出，命中即中断，从违规节点末尾续写
export async function generate({ provider, platform = 'h5', fixHints = {}, task = '' }) {
  if (!provider || typeof provider.stream !== 'function') {
    throw new Error('provider 必须实现 stream/position/done 接口');
  }
  const session = createSession({ platform, fixHints });
  let raw = ''; // 已接收的原始文本，不施加替换
  let output = ''; // 已确定的最终文本
  let consumed = 0; // raw 中已并入 output 的长度
  let chunks = 0;
  let interrupts = 0;
  let stopped = null;

  while (!provider.done) {
    let interrupt = false;
    for await (const chunk of provider.stream()) {
      chunks += 1;
      raw += chunk;

      for (const node of session.parser.push(chunk)) {
        const from = Math.max(consumed, node.offset);
        const index = raw.indexOf(node.text, from);
        const start = index >= 0 ? index : from;
        const end = start + node.text.length;
        const result = session.processNode(node);

        if (result.needsHuman && result.replacement === null) {
          // 契约拒绝：保留节点原文，停止生成并交人工
          output += raw.slice(consumed, end);
          consumed = end;
          stopped = { reason: result.reason, ruleId: result.violation?.ruleId ?? null, offset: end };
          break;
        }

        if (result.replacement !== null) {
          output += raw.slice(consumed, start) + result.replacement;
          consumed = end;
          interrupt = true;
        }
      }

      if (stopped) break;
      if (interrupt) {
        // 中断发生在片段边界：本片段已完整解析，停止向提供者索取后续
        interrupts += 1;
        break;
      }
      if (interrupts > MAX_INTERRUPTS) {
        throw new Error(`中断次数超过上限 ${MAX_INTERRUPTS}`);
      }
    }

    if (stopped) break;
  }

  output += raw.slice(consumed);

  if (!stopped) {
    for (const violation of session.judge.finalize()) {
      const regen = regenerate(violation.node, violation, fixHints[violation.ruleId]);
      session.record(violation, regen, 1);
      if (regen.accepted) {
        output = output.replace(violation.node.text, regen.newNode.text);
      }
    }
  }

  return {
    code: output,
    task,
    stopped: Boolean(stopped),
    stoppedAt: stopped,
    ...summarize(session, { mode: 'generate', chunks, interrupts }),
  };
}

export { PLATFORMS };
