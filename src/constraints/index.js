// S1 约束条件汇总：按目标平台组装能力矩阵 + 组件清单 + 框架版本 + 专属规则
import { platformMatrix } from './platform-matrix.js';
import { componentCatalog, nativeTags } from './component-catalog.js';
import { webPlatformMatrix } from './web-platform-matrix.js';
import { webComponentCatalog, webNativeTags } from './web-component-catalog.js';
import { createWebExtraChecks } from '../judge/web-checks.js';

const BROWSER_GLOBALS = [
  'window', 'document', 'history', 'fetch', 'localStorage', 'sessionStorage',
  'JSON', 'Object', 'Array', 'Math', 'Date', 'Promise', 'Number', 'String',
  'setTimeout', 'setInterval', 'encodeURIComponent', 'decodeURIComponent',
  'axios', 'ElMessage', 'ElMessageBox', 'sanitize',
];

export function buildConstraintSet(platform = 'mp-weixin') {
  if (platform === 'h5') {
    return {
      targetPlatform: webPlatformMatrix.platform,
      framework: 'vue3-script-setup + element-plus',
      matrix: webPlatformMatrix,
      catalog: webComponentCatalog,
      nativeTags: webNativeTags,
      globals: BROWSER_GLOBALS,
      extraChecks: createWebExtraChecks(),
    };
  }
  return {
    targetPlatform: platformMatrix.platform,
    framework: 'vue3-script-setup',
    matrix: platformMatrix,
    catalog: componentCatalog,
    nativeTags,
  };
}
