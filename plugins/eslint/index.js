// ESLint 插件：把 stream-gate 的规则集暴露为一条规则 stream-gate/gate
// 适用宿主：已用 vue-eslint-parser 解析 .vue 的工程（eslint-plugin-vue 自带该解析器）
// 与 MCP/CLI 共用同一引擎，判定口径一致
import { check, PLATFORMS } from '../../src/mcp/gate-service.js';

const rule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'AI 生成前端代码的实时质量门禁：组件清单、平台 API、安全与性能规则',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          platform: { enum: PLATFORMS },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      violation: '[{{ruleId}}] {{evidence}}',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const platform = options.platform ?? 'h5';

    return {
      Program(node) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const code = sourceCode.text;
        // 只处理单文件组件，普通 js/ts 不走该规则
        if (!code.includes('<template')) return;

        let result;
        try {
          result = check({ code, platform, reportAll: true });
        } catch {
          return; // 非 SFC 结构或平台不匹配时静默跳过，避免阻断 lint
        }
        if (result.violations.length === 0) return;

        const allAutoFixable = result.violations.every((v) => v.regen.accepted);
        result.violations.forEach((violation, index) => {
          const loc = violation.loc ?? { line: 1, column: 1 };
          const point = { line: loc.line, column: Math.max(0, loc.column - 1) };
          context.report({
            node,
            loc: { start: point, end: point },
            messageId: 'violation',
            data: { ruleId: violation.ruleId, evidence: violation.evidence },
            // 全部违规均可自动修复时，整文件替换；存在待人工项时不提供修复，避免掩盖问题
            fix: allAutoFixable && index === 0
              ? (fixer) => fixer.replaceTextRange([0, code.length], result.code)
              : undefined,
          });
        });
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-stream-gate', version: '0.1.0' },
  rules: { gate: rule },
};
