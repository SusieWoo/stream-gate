// S1 约束条件之一：目标平台能力矩阵
// 结构：平台 × API × 是否支持 × 替代方案
export const platformMatrix = {
  platform: 'mp-weixin',
  apis: [
    { api: 'window', supported: false, alternative: null, reason: '小程序无 window 全局对象' },
    { api: 'document', supported: false, alternative: null, reason: '小程序无 DOM' },
    { api: 'location', supported: false, alternative: 'uni.navigateTo / uni.redirectTo', reason: '页面跳转须用路由 API' },
    { api: 'localStorage', supported: false, alternative: 'uni.setStorageSync / uni.getStorageSync', reason: '须用小程序存储 API' },
    { api: 'sessionStorage', supported: false, alternative: 'uni.setStorageSync', reason: '须用小程序存储 API' },
    { api: 'fetch', supported: false, alternative: 'uni.request', reason: '须用小程序网络 API' },
    { api: 'XMLHttpRequest', supported: false, alternative: 'uni.request', reason: '须用小程序网络 API' },
    { api: 'alert', supported: false, alternative: 'uni.showToast / uni.showModal', reason: '须用小程序交互 API' },
    { api: 'uni.request', supported: true },
    { api: 'uni.navigateTo', supported: true },
    { api: 'uni.redirectTo', supported: true },
    { api: 'uni.setStorageSync', supported: true },
    { api: 'uni.getStorageSync', supported: true },
    { api: 'uni.showToast', supported: true },
    { api: 'uni.showModal', supported: true },
    { api: 'console.log', supported: true },
  ],
};
