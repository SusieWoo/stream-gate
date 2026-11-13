#!/usr/bin/env node
// stream-gate CLI：对工程内 .vue 文件批量运行门禁
// 用法：stream-gate check [路径...] [--platform h5|mp-weixin] [--fix] [--json] [--quiet]
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

import { check, PLATFORMS } from '../src/mcp/gate-service.js';

const HELP = `stream-gate - AI 生成前端代码的实时质量门禁

用法:
  stream-gate check <路径...> [选项]

选项:
  -p, --platform <h5|mp-weixin>  目标平台，默认 h5
  -f, --fix                      将修复结果写回文件
  -j, --json                     输出 JSON
  -q, --quiet                    仅输出汇总
  -h, --help                     帮助
  -v, --version                  版本

示例:
  stream-gate check ./src
  stream-gate check ./src/views --platform mp-weixin --fix`;

function parseArgs(argv) {
  const opts = { cmd: argv[0], paths: [], platform: 'h5', fix: false, json: false, quiet: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--platform' || a === '-p') opts.platform = argv[++i];
    else if (a === '--fix' || a === '-f') opts.fix = true;
    else if (a === '--json' || a === '-j') opts.json = true;
    else if (a === '--quiet' || a === '-q') opts.quiet = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a.startsWith('-')) throw new Error(`未知选项 ${a}`);
    else opts.paths.push(a);
  }
  return opts;
}

function collectVueFiles(target, out = []) {
  const stat = statSync(target);
  if (stat.isFile()) {
    if (extname(target) === '.vue') out.push(target);
    return out;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    collectVueFiles(join(target, entry.name), out);
  }
  return out;
}

function displayPath(file) {
  const rel = relative(process.cwd(), file);
  return rel.startsWith('..') ? file : rel;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.cmd) {
    console.log(HELP);
    process.exit(opts.cmd ? 0 : 1);
  }
  if (opts.version) {
    console.log('stream-gate 0.1.0');
    return;
  }
  if (opts.cmd !== 'check') {
    console.error(`未知命令 ${opts.cmd}\n`);
    console.log(HELP);
    process.exit(1);
  }
  if (!PLATFORMS.includes(opts.platform)) {
    console.error(`不支持的平台 ${opts.platform}，可选值 ${PLATFORMS.join(' / ')}`);
    process.exit(2);
  }
  if (opts.paths.length === 0) opts.paths.push('.');

  const files = [];
  for (const p of opts.paths) collectVueFiles(p, files);
  if (files.length === 0) {
    console.error('未找到 .vue 文件');
    process.exit(2);
  }

  const report = [];
  let totalViolations = 0;
  let totalManual = 0;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    let result;
    try {
      result = check({ code: source, platform: opts.platform, reportAll: true });
    } catch (err) {
      report.push({ file, error: err.message });
      continue;
    }
    const manual = result.violations.filter((v) => !v.regen.accepted);
    totalViolations += result.violations.length;
    totalManual += manual.length;
    if (opts.fix && result.changed) writeFileSync(file, result.code);
    report.push({
      file,
      violations: result.violations,
      stats: result.stats,
      fixed: opts.fix && result.changed,
      manual: manual.length,
    });
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report) {
      if (r.error) {
        console.error(`${r.file}: 读取失败 ${r.error}`);
        continue;
      }
      if (!opts.quiet && r.violations.length > 0) {
        const dist = r.violations.reduce((m, v) => ({ ...m, [v.severity]: (m[v.severity] ?? 0) + 1 }), {});
        console.log(`\n${displayPath(r.file)}  ${r.violations.length} 项  高 ${dist.高 ?? 0} / 中 ${dist.中 ?? 0} / 低 ${dist.低 ?? 0}`);
        for (const v of r.violations) {
          const where = v.loc ? `${String(v.loc.line).padStart(4)}:${v.loc.column}` : '   -:-';
          const mark = v.regen.accepted ? '已修复' : '待人工';
          console.log(`  ${where}  ${v.ruleId}  ${mark}  ${v.evidence}`);
        }
      } else if (!opts.quiet && r.fixed) {
        console.log(`${displayPath(r.file)}  已修复`);
      }
    }
    console.log(`\n共 ${files.length} 个文件，${totalViolations} 项违规，其中待人工 ${totalManual} 项${opts.fix ? '（已写回）' : ''}`);
  }

  process.exit(totalManual > 0 ? 1 : 0);
}

main();
