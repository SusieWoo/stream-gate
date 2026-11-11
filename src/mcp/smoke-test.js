// MCP 冒烟测试：以真实 MCP 客户端连接 stdio 服务，验证工具列表与三条主路径
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TYPO_CASE = `<template>
  <div class="page">
    <el-buton type="primary" @click="onSave">保存</el-buton>
  </div>
</template>

<script setup>
const onSave = () => { console.log('save'); };
</script>
`;

const CONTRACT_CASE = `<template>
  <div class="page">
    <div class="content" v-html="html" @click="onClick"></div>
  </div>
</template>

<script setup>
const html = '<b>x</b>';
const onClick = () => {};
</script>
`;

// 替换片段丢失了兄弟事件 @click，接口契约应拒绝
const BAD_HINT = { 'R-SEC-401': { replacement: '<div class="content" v-html="safeHtml"></div>' } };

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('./server.js', import.meta.url))],
});
const client = new Client({ name: 'gate-smoke', version: '0.1.0' }, { capabilities: {} });
await client.connect(transport);

const parse = (result) => JSON.parse(result.content[0].text);

const { tools } = await client.listTools();
assert.equal(tools.length, 2);
assert.deepEqual(tools.map((t) => t.name).sort(), ['gate_check', 'gate_generate']);
console.log('✓ tools/list 返回 2 个工具');

const checked = parse(await client.callTool({ name: 'gate_check', arguments: { platform: 'h5', code: TYPO_CASE } }));
assert.equal(checked.changed, true);
assert.equal(checked.stats.rules[0], 'R-TPL-001');
assert.ok(checked.code.includes('<el-button'));
assert.ok(!checked.code.includes('<el-buton'));
console.log('✓ gate_check 修复标签拼写，命中 R-TPL-001');

const generated = parse(
  await client.callTool({ name: 'gate_generate', arguments: { platform: 'h5', code: TYPO_CASE, chunkSize: 40 } }),
);
assert.equal(generated.stopped, false);
assert.ok(generated.stats.interrupts >= 1);
assert.equal(generated.code, checked.code);
console.log(`✓ gate_generate 流式中断 ${generated.stats.interrupts} 次并续写，结果与一次性门禁一致`);

const rejected = parse(
  await client.callTool({
    name: 'gate_generate',
    arguments: { platform: 'h5', code: CONTRACT_CASE, chunkSize: 40, fixHints: BAD_HINT },
  }),
);
assert.equal(rejected.stopped, true);
assert.equal(rejected.stoppedAt.ruleId, 'R-SEC-401');
assert.ok(rejected.stoppedAt.reason.includes('契约'));
assert.ok(rejected.code.includes('v-html="html"'), '拒绝时不得静默采纳替换片段');
console.log('✓ 契约校验拒绝丢失兄弟事件的片段，停止生成并交人工');

const badPlatform = await client.callTool({ name: 'gate_check', arguments: { platform: 'react-native', code: TYPO_CASE } });
assert.equal(badPlatform.isError, true);
console.log('✓ 非法平台入参返回错误');

await client.close();
console.log('\nMCP 冒烟测试全部通过');
