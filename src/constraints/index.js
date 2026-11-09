// S1 约束条件汇总：平台能力矩阵 + 组件清单 + 框架版本
import { platformMatrix } from './platform-matrix.js';
import { componentCatalog, nativeTags } from './component-catalog.js';

export function buildConstraintSet() {
  return {
    targetPlatform: platformMatrix.platform,
    framework: 'vue3-script-setup',
    matrix: platformMatrix,
    catalog: componentCatalog,
    nativeTags,
  };
}
