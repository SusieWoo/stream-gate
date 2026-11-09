// S3 规则集（编号与交底书大纲一致；severity 用于实验数据分级统计）
export const rules = [
  { id: 'R-TPL-001', kind: 'template-element', severity: '中', name: '标签必须存在于组件清单' },
  { id: 'R-TPL-002', kind: 'template-element', severity: '低', name: '属性与属性取值必须合法' },
  { id: 'R-TPL-003', kind: 'template-element', severity: '中', name: '事件绑定目标必须在脚本中声明' },
  { id: 'R-API-101', kind: 'script-stmt', severity: '高', name: '禁止调用目标平台不支持的 API' },
  { id: 'R-API-102', kind: 'script-stmt', severity: '低', name: 'uni.* 调用必须在白名单内' },
  { id: 'R-CC-201', kind: 'cc-block', severity: '中', name: '条件编译块在目标平台切片后不得为空' },
  { id: 'R-JS-301', kind: 'script-stmt', severity: '低', name: '函数调用目标必须先声明' },
  { id: 'R-SEC-401', kind: 'template-element', severity: '高', name: 'v-html 不得直接渲染未净化内容' },
  { id: 'R-SEC-402', kind: 'script-stmt', severity: '高', name: '禁止硬编码密钥或 token' },
  { id: 'R-PERF-501', kind: 'template-element', severity: '低', name: '列表 key 不得使用数组下标' },
];

export const severityOf = (ruleId) => rules.find((r) => r.id === ruleId)?.severity ?? '未知';
