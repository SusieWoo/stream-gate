// S3 规则集（编号与交底书大纲一致）
export const rules = [
  { id: 'R-TPL-001', kind: 'template-element', name: '标签必须存在于组件清单' },
  { id: 'R-TPL-002', kind: 'template-element', name: '属性与属性取值必须合法' },
  { id: 'R-TPL-003', kind: 'template-element', name: '事件绑定目标必须在脚本中声明' },
  { id: 'R-API-101', kind: 'script-stmt', name: '禁止调用目标平台不支持的 API' },
  { id: 'R-API-102', kind: 'script-stmt', name: 'uni.* 调用必须在白名单内' },
  { id: 'R-CC-201', kind: 'cc-block', name: '条件编译块在目标平台切片后不得为空' },
  { id: 'R-JS-301', kind: 'script-stmt', name: '函数调用目标必须先声明' },
];
