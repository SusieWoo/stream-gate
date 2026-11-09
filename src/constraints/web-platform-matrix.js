// H5 浏览器端平台能力矩阵
export const webPlatformMatrix = {
  platform: 'h5',
  apis: [
    { api: 'window', supported: true },
    { api: 'document', supported: true },
    { api: 'location', supported: true },
    { api: 'history', supported: true },
    { api: 'localStorage', supported: true },
    { api: 'sessionStorage', supported: true },
    { api: 'fetch', supported: true },
    { api: 'XMLHttpRequest', supported: true },
    { api: 'IntersectionObserver', supported: true },
    { api: 'wx', supported: false, alternative: 'axios / fetch', reason: '浏览器环境无 wx 全局对象，小程序专用 API 不可用' },
    { api: 'alert', supported: false, alternative: 'ElMessage / ElMessageBox', reason: '项目规范不允许原生弹窗，须用组件库反馈' },
    { api: 'uni.request', supported: true },
    { api: 'uni.navigateTo', supported: true },
    { api: 'uni.setStorageSync', supported: true },
    { api: 'console.log', supported: true },
  ],
};
