// H5 浏览器端用例库（模拟 AI 流式输出；标注预期违规，用于计算误报/漏报）
// fixHint 表示该用例中"模型按结构化修复指令重生成"的结果，用于替代真实 LLM 调用

export const webCases = [
  {
    id: 'WEB-CASE-001',
    task: '生成用户管理列表页（表单 + 表格 + 分页，含组件标签拼写缺陷）',
    expectViolations: ['R-TPL-001'],
    code: `<template>
  <div class="user-page">
    <el-form :model="query" inline label-width="80px">
      <el-form-item label="用户名" prop="name">
        <el-input v-model="query.name" placeholder="请输入用户名" clearable />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="query.status" placeholder="全部" clearable>
          <el-option label="启用" value="1" />
          <el-option label="停用" value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="rows" border stripe @row-click="onRowClick">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="用户名" />
      <el-table-column prop="status" label="状态" />
      <el--table-column prop="createdAt" label="创建时间" />
    </el-table>
    <el-pagination :total="total" :page-size="pageSize" layout="prev, pager, next" @current-change="onPageChange" />
  </div>
</template>
<script setup>
const query = { name: '', status: '' };
const rows = [];
const total = 0;
const pageSize = 20;
const onSearch = () => { console.log('search'); };
const onReset = () => { query.name = ''; query.status = ''; };
const onRowClick = (row) => { console.log(row.id); };
const onPageChange = (page) => { console.log(page); };
</script>
`,
  },
  {
    id: 'WEB-CASE-002',
    task: '生成公告详情页（富文本 v-html 渲染）',
    expectViolations: ['R-SEC-401'],
    fixHint: {
      'R-SEC-401': {
        replacement: '<div class="content" v-html="sanitize(detail.content)"></div>',
        note: '模型按结构化修复指令重生成：包裹净化函数（预置模拟）',
      },
    },
    code: `<template>
  <div class="notice-detail">
    <h1 class="title">{{ detail.title }}</h1>
    <div class="content" v-html="detail.content"></div>
    <div class="footer">
      <el-button @click="onBack">返回</el-button>
    </div>
  </div>
</template>
<script setup>
const detail = { title: '', content: '' };
const onBack = () => { window.history.back(); };
</script>
`,
  },
  {
    id: 'WEB-CASE-003',
    task: '生成用户信息请求封装（硬编码 token）',
    expectViolations: ['R-SEC-402'],
    code: `<script setup>
const baseURL = 'https://api.example.com';
const token = 'sk-live-9f8a2c7b41e6d5038af2bc91';
const fetchUser = async (id) => {
  const res = await fetch(\`\${baseURL}/user/\${id}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  });
  return res.json();
};
</script>
`,
  },
  {
    id: 'WEB-CASE-004',
    task: '生成登录提交逻辑（误用小程序专用 API）',
    expectViolations: ['R-API-101'],
    code: `<script setup>
const form = { user: '', pwd: '' };
const submit = () => {
  wx.request({
    url: '/api/login',
    method: 'POST',
    data: { user: form.user, pwd: form.pwd },
    success: (res) => {
      console.log(res.statusCode);
    },
  });
};
</script>
`,
  },
  {
    id: 'WEB-CASE-005',
    task: '生成消息列表（列表 key 使用数组下标）',
    expectViolations: ['R-PERF-501'],
    code: `<template>
  <div class="list">
    <div v-for="(item, index) in list" :key="index" class="item">
      <span>{{ item.name }}</span>
      <el-tag type="success" size="small">{{ item.status }}</el-tag>
    </div>
  </div>
</template>
<script setup>
const list = [];
</script>
`,
  },
  {
    id: 'WEB-CASE-006',
    task: '生成提交按钮（事件处理函数拼写不一致）',
    expectViolations: ['R-TPL-003'],
    code: `<template>
  <div>
    <el-button type="primary" @click="onSbumit">提交</el-button>
  </div>
</template>
<script setup>
const onSubmit = () => { console.log('submit'); };
</script>
`,
  },
  {
    id: 'WEB-CASE-007',
    task: '生成确认按钮（属性枚举取值非法）',
    expectViolations: ['R-TPL-002'],
    code: `<template>
  <div>
    <el-button type="main" size="big" @click="onOk">确定</el-button>
  </div>
</template>
<script setup>
const onOk = () => { console.log('ok'); };
</script>
`,
  },
  {
    id: 'WEB-CASE-008',
    task: '生成个人资料表单（合规对照）',
    expectViolations: [],
    code: `<template>
  <div class="profile">
    <el-form :model="form" label-width="90px">
      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="form.nickname" maxlength="20" placeholder="请输入昵称" />
      </el-form-item>
      <el-form-item label="简介" prop="intro">
        <el-input v-model="form.intro" type="textarea" :rows="3" />
      </el-form-item>
      <el-button type="primary" @click="onSave">保存</el-button>
    </el-form>
  </div>
</template>
<script setup>
const form = { nickname: '', intro: '' };
const onSave = () => { console.log('saved'); };
</script>
`,
  },
  {
    id: 'WEB-CASE-009',
    task: '生成订单管理页（大文件，含列表 key 与硬编码密钥两处缺陷）',
    expectViolations: ['R-PERF-501', 'R-SEC-402'],
    code: `<template>
  <div class="order-page">
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="订单号" clearable @change="onKeywordChange" />
      <el-button type="primary" @click="onQuery">查询</el-button>
      <el-button type="danger" @click="onExport">导出</el-button>
    </div>
    <el-table :data="orders" border stripe height="520" @row-click="onRowClick" @sort-change="onSortChange">
      <el-table-column prop="orderNo" label="订单号" width="180" sortable />
      <el-table-column prop="customer" label="客户" />
      <el-table-column prop="amount" label="金额" width="120" sortable />
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column label="操作" width="160">
        <template #default="scope">
          <el-button type="primary" size="small" @click="onDetail(scope.row)">详情</el-button>
          <el-button type="danger" size="small" @click="onCancel(scope.row)">取消</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="pager">
      <el-pagination :total="total" :page-size="pageSize" :current-page="page" layout="total, prev, pager, next" @current-change="onPageChange" />
    </div>
    <div class="history">
      <div v-for="(item, index) in historyList" :key="index" class="history-item">
        <span>{{ item.action }}</span>
        <span>{{ item.time }}</span>
      </div>
    </div>
  </div>
</template>
<script setup>
const keyword = '';
const orders = [];
const historyList = [];
const total = 0;
const pageSize = 20;
const page = 1;
const apiToken = 'sk-live-7c31a08b9e2d4f6a8c05';
const onKeywordChange = () => { console.log(keyword); };
const onQuery = () => { console.log('query'); };
const onExport = () => { console.log('export'); };
const onRowClick = (row) => { console.log(row.orderNo); };
const onSortChange = ({ prop, order }) => { console.log(prop, order); };
const onDetail = (row) => { console.log(row.orderNo); };
const onCancel = (row) => { console.log(row.orderNo); };
const onPageChange = (p) => { page = p; };
</script>
`,
  },
  {
    id: 'WEB-CASE-010',
    task: '生成批量选择表格（模型修复片段丢失兄弟事件，契约校验应拒绝）',
    expectViolations: ['R-TPL-002'],
    fixHint: {
      'R-TPL-002': {
        replacement: `<el-table :data="rows" border @selection-change="onSelectChange">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="name" label="名称" />
    </el-table>`,
        note: '模型重生成时丢失了 @row-click，契约校验应拒绝该片段',
      },
    },
    code: `<template>
  <div class="table-wrap">
    <el-table :data="rows" border @row-click="onRowClick" @selection-chang="onSelectChange">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="name" label="名称" />
    </el-table>
  </div>
</template>
<script setup>
const rows = [];
const onRowClick = (row) => { console.log(row.id); };
const onSelectChange = (val) => { console.log(val.length); };
</script>
`,
  },
  {
    id: 'WEB-CASE-011',
    task: '生成姓名输入框（属性名拼写错误，模型重生成修正）',
    expectViolations: ['R-TPL-002'],
    fixHint: {
      'R-TPL-002': {
        replacement: '<el-input v-model="form.name" maxlength="20" placeholder="姓名" />',
        note: '模型按结构化修复指令重生成：maxlen 修正为 maxlength（预置模拟）',
      },
    },
    code: `<template>
  <div>
    <el-input v-model="form.name" maxlen="20" placeholder="姓名" />
    <el-button type="primary" @click="onSubmit">保存</el-button>
  </div>
</template>
<script setup>
const form = { name: '' };
const onSubmit = () => { console.log(form.name); };
</script>
`,
  },
  {
    id: 'WEB-CASE-012',
    task: '生成数据看板（合规对照，含列表渲染与组件属性绑定）',
    expectViolations: [],
    code: `<template>
  <div class="dashboard">
    <div class="cards">
      <el-tag v-for="tag in tags" :key="tag.id" type="info" size="small">{{ tag.label }}</el-tag>
    </div>
    <el-select v-model="selected" placeholder="请选择" clearable @change="onChange">
      <el-option v-for="opt in options" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>
    <el-button type="primary" size="large" :loading="loading" @click="onRefresh">刷新</el-button>
  </div>
</template>
<script setup>
const tags = [];
const options = [];
const selected = '';
const loading = false;
const onChange = (val) => { console.log(val); };
const onRefresh = () => { console.log('refresh'); };
</script>
`,
  },
];
