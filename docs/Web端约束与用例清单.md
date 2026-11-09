# Web 端约束条件与用例清单（H5 浏览器场景）

对应交底书大纲 S1（约束注入）与第六节（对照实验）。本清单是 Web demo 的事实来源，代码实现见 `src/constraints/web-*`、`src/rules/`、`src/judge/web-checks.js`、`fixtures/web-cases.js`。

运行：`npm run demo:web`

---

## 一、约束条件（S1 注入内容）

### 1. 目标平台能力矩阵（`src/constraints/web-platform-matrix.js`）

目标平台：`h5`。与小程序端相反，浏览器 API 可用，小程序专用 API 不可用。

| API | 是否支持 | 替代方案 | 原因 |
|---|---|---|---|
| window / document / location / history | 是 | — | 浏览器原生 |
| localStorage / sessionStorage | 是 | — | 浏览器原生 |
| fetch / XMLHttpRequest | 是 | — | 浏览器原生 |
| IntersectionObserver | 是 | — | 浏览器原生 |
| **wx** | **否** | axios / fetch | 浏览器无 wx 全局对象 |
| **alert** | **否** | ElMessage / ElMessageBox | 项目规范禁用原生弹窗 |
| uni.request / uni.navigateTo / uni.setStorageSync | 是 | — | uni-app H5 端可用 |
| console.log | 是 | — | — |

### 2. 组件清单（`src/constraints/web-component-catalog.js`）

Element Plus 子集 11 个组件 + 浏览器原生标签白名单 27 个。

| 组件 | 关键合法属性（枚举值） | 合法事件 |
|---|---|---|
| el-form | model, rules, labelWidth, labelPosition(left/top/right), inline | — |
| el-form-item | label, prop, required, labelWidth | — |
| el-input | modelValue, placeholder, maxlength, rows, type(text/password/number/textarea/email) | input, change, focus, blur, clear, keyup |
| el-button | type(primary/success/warning/danger/info/default), size(large/default/small), loading | click |
| el-table | data, border, stripe, height, rowKey | row-click, selection-change, sort-change, row-dblclick |
| el-table-column | prop, label, width, sortable, fixed, align | — |
| el-select | modelValue, placeholder, clearable, multiple, filterable | change, visible-change, clear |
| el-option | label, value, disabled | — |
| el-tag | type(primary/success/warning/danger/info), size | close, click |
| el-pagination | total, pageSize, currentPage, layout | current-change, size-change |
| el-dialog | modelValue, title, width, appendToBody, destroyOnClose | close, open, opened, closed |

属性名判定前统一转驼峰（`label-width` → `labelWidth`、`model-value` → `modelValue`）。

### 3. 规则集（`src/rules/rules.js`，含严重级）

| 规则编号 | 严重级 | 适用节点 | 内容 |
|---|---|---|---|
| R-TPL-001 | 中 | 模板元素 | 标签必须存在于组件清单（编辑距离 ≤2 给出最相近合法项） |
| R-TPL-002 | 低 | 模板元素 | 属性名、属性枚举取值、事件名必须合法 |
| R-TPL-003 | 中 | 模板元素 | 事件处理函数必须在脚本中声明（模板先到则挂起，流结束结算；表达式型绑定不判定） |
| R-API-101 | 高 | 脚本语句 | 禁止调用目标平台不支持的 API（Web 端针对 wx / alert） |
| R-API-102 | 低 | 脚本语句 | uni.* 调用必须在白名单内 |
| R-CC-201 | 中 | 条件编译块 | 目标平台切片后不得为空 |
| R-JS-301 | 低 | 脚本语句 | 函数调用目标必须先声明 |
| **R-SEC-401** | **高** | 模板元素 | v-html 不得直接渲染未净化内容（DOM XSS） |
| **R-SEC-402** | **高** | 脚本语句 | 禁止硬编码密钥或 token |
| **R-PERF-501** | **低** | 模板元素 | 列表 key 不得使用数组下标 |

浏览器全局对象（window、document、fetch、axios、ElMessage 等 27 项）预置为已声明，避免 R-JS-301 误报。

### 4. 语法边界（与小程序 demo 共用）

- 模板元素：开标签到匹配闭标签（栈式扫描）
- 脚本语句：括号配平且以 `;` / `}` 收尾
- 条件编译块：`// #ifdef X` 到 `// #endif`

---

## 二、用例清单（`fixtures/web-cases.js`，共 12 例 205 行）

| 用例 | 任务 | 预置缺陷 | 预期违规 | 预期修复 |
|---|---|---|---|---|
| WEB-CASE-001 | 用户管理列表页（36 行） | `el--table-column` 多一个连字符 | R-TPL-001 | L1 子树修复 |
| WEB-CASE-002 | 公告详情页 | `v-html` 直接渲染富文本 | R-SEC-401 | L2 模型重生成（包裹 sanitize） |
| WEB-CASE-003 | 用户请求封装 | 硬编码 `token = 'sk-live-...'` | R-SEC-402 | L1 改环境变量注入 |
| WEB-CASE-004 | 登录提交逻辑 | 误用 `wx.request` | R-API-101 | L1 改 axios |
| WEB-CASE-005 | 消息列表 | `:key="index"` | R-PERF-501 | L1 改 `item.id` |
| WEB-CASE-006 | 提交按钮 | `@click="onSbumit"` 与 `onSubmit` 不一致 | R-TPL-003 | L1 改名 |
| WEB-CASE-007 | 确认按钮 | `type="main"`、`size="big"` 双枚举非法 | R-TPL-002 ×2 | 同节点两轮 L1 修复 |
| WEB-CASE-008 | 个人资料表单（17 行） | 无（合规对照） | 无 | 验证不误报 |
| WEB-CASE-009 | 订单管理页（47 行，大文件） | `:key="index"` + 硬编码 `apiToken` | R-PERF-501, R-SEC-402 | L1 ×2，验证子树粒度 |
| WEB-CASE-010 | 批量选择表格 | `@selection-chang` 事件名拼错；模型修复片段丢失兄弟事件 `@row-click` | R-TPL-002 | L2 片段被契约校验**拒绝**，转人工 |
| WEB-CASE-011 | 姓名输入框 | `maxlen` 属性名拼错 | R-TPL-002 | L2 模型重生成修正 |
| WEB-CASE-012 | 数据看板（合规对照） | 无 | 无 | 验证列表渲染不误报 |

---

## 三、记录位置（S5 证据链）

- 证据链 JSON：`experiments/YYYYMMDD/web-gate-run-XXX.json`
- 汇总表：`experiments/summary-YYYYMMDD.md`（多次运行追加）
- 运行：`npm run demo:web`，也可 `node src/demo/run-web-demo.js web-gate-run-003` 指定运行号

### 运行记录

| runId | 结果 | 说明 |
|---|---|---|
| web-gate-run-001 | 14 次拦截，4 误报 2 漏报 | 属性 kebab-case 未转驼峰、`async (` 被判为函数调用，暴露判定缺陷 |
| web-gate-run-002 | 12 次拦截，0 误报 0 漏报 | 修复驼峰转换与关键字白名单；当前有效数据 |

### run-002 关键数据

- 12 个用例 / 205 行代码，拦截 12 次，误报 0，漏报 0
- 按严重级：高 4、中 2、低 6
- 按规则：R-TPL-002 4、R-PERF-501 2、R-SEC-402 2、R-TPL-001 1、R-SEC-401 1、R-API-101 1、R-TPL-003 1
- 重生成层级：L1（子树规则修复）9 次、L2（模型重生成）2 次、L0（契约校验拒绝未修复）1 次
- 拦截位置：最早在流式输出第 2/6 块（case-003），大文件在 15/24、19/24 块
- token 估计：门禁 292，整文件重生成基线 3034，节省 90.4%
- 耗时估算（token×1.8ms + 每次修复 120ms）：门禁 1966ms，基线 6901ms，节省 71.5%
- 契约校验拒绝 1 次（case-010）：模型片段丢失 `@row-click`，被拒绝后转人工，未被静默采纳

单例 token 节省比区间为 60.6%–99.5%，小文件因修复指令固定开销占比高，节省比明显低于大文件。

---

## 四、口径与局限（写交底书时必须保留）

1. 流式输出由 `splitChunks` 按 2 行切分模拟，不是真实 LLM token 流；接入真实 API 只需替换 fixture 来源。
2. token 为本地估算（中文 1 字 1 token、ASCII 4 字符 1 token）；耗时为 `token × 1.8ms` 的估算，不是墙钟测量。
3. 基线口径为「该用例发现缺陷后整文件重生成一次」，未计入首次全量生成成本（两组相同，可抵消）。
4. R-SEC-401 按 `v-html` 出现判定，未做完整污点追踪，属近似规则，交底书写成「未经净化的直接渲染」。
5. L2 修复片段为预置 `fixHint`，代表模型输出，用于验证契约校验链路，不能当作真实模型成功率。
6. 12 例为预标注用例，样本有限，不外推为普遍效果；真实漏检率需接入真实生成后另行测量。
