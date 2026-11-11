#!/usr/bin/env node
// MCP 服务入口：stdio 传输，暴露 gate_check 与 gate_generate 两个工具
// 注意：stdout 只输出 JSON-RPC，日志一律走 stderr
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { check, generate, PLATFORMS } from './gate-service.js';
import { createStubProvider } from '../llm/provider.js';

const PLATFORM_SCHEMA = { type: 'string', enum: PLATFORMS, default: 'h5', description: '目标运行平台' };
const FIX_HINTS_SCHEMA = {
  type: 'object',
  description: '规则标识到修复提示的映射，用于模拟模型重生成结果；缺省时只走规则修复策略',
  additionalProperties: true,
};

const TOOLS = [
  {
    name: 'gate_check',
    description:
      '对一段前端代码执行门禁：按语法边界增量解析、逐节点判定、命中违规后以最小子树为单位修复，并做接口契约校验。返回修复后的代码、违规轨迹与统计。不写入任何文件。',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '待校验的前端代码（Vue 单文件组件形态）' },
        platform: PLATFORM_SCHEMA,
        fixHints: FIX_HINTS_SCHEMA,
        linesPerChunk: { type: 'number', default: 2, description: '模拟流式切分的每个片段行数' },
      },
      required: ['code'],
    },
  },
  {
    name: 'gate_generate',
    description:
      '驱动模型流式产出一段前端代码，边产出边判定；命中违规即中断本次输出，只重生成违规子树，契约校验通过后从该节点末尾续写。source.code 为本次模拟的模型输出；接入真实模型时替换 provider 实现即可。返回最终代码、中断记录与统计。不写入任何文件。',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '本次生成要产出的代码（模拟模型输出）' },
        task: { type: 'string', description: '生成任务描述，仅用于记录', default: '' },
        platform: PLATFORM_SCHEMA,
        chunkSize: { type: 'number', default: 120, description: '模拟流式输出的片段字符数' },
        delayMs: { type: 'number', default: 0, description: '片段间隔毫秒，用于观察中断时机' },
        fixHints: FIX_HINTS_SCHEMA,
      },
      required: ['code'],
    },
  },
];

function asText(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

const server = new Server(
  { name: 'stream-gate', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    if (name === 'gate_check') {
      const result = check({
        code: args.code,
        platform: args.platform ?? 'h5',
        fixHints: args.fixHints ?? {},
        linesPerChunk: args.linesPerChunk ?? 2,
      });
      return asText(result);
    }

    if (name === 'gate_generate') {
      const provider = createStubProvider(args.code, {
        chunkSize: args.chunkSize ?? 120,
        delayMs: args.delayMs ?? 0,
      });
      const result = await generate({
        provider,
        platform: args.platform ?? 'h5',
        fixHints: args.fixHints ?? {},
        task: args.task ?? '',
      });
      return asText(result);
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
console.error('[stream-gate] MCP server ready on stdio');
