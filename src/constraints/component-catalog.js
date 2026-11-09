// S1 约束条件之二：可用组件清单（uView 子集 + 小程序原生标签）
export const nativeTags = [
  'template', 'view', 'text', 'image', 'scroll-view',
  'swiper', 'swiper-item', 'button', 'input', 'form', 'navigator', 'block', 'slot',
];

export const componentCatalog = {
  'u-form': {
    props: { model: {}, rules: {}, labelWidth: {}, labelPosition: { enum: ['left', 'top'] } },
    events: [],
  },
  'u-form-item': {
    props: { label: {}, prop: {}, required: {}, labelWidth: {} },
    events: [],
  },
  'u-input': {
    props: {
      value: {}, placeholder: {}, disabled: {}, clearable: {},
      type: { enum: ['text', 'number', 'digit', 'password', 'tel'] },
    },
    events: ['input', 'focus', 'blur', 'confirm', 'clear'],
  },
  'u-button': {
    props: {
      type: { enum: ['default', 'primary', 'success', 'warning', 'error'] },
      size: { enum: ['small', 'medium', 'large'] },
      text: {}, loading: {}, disabled: {},
    },
    events: ['click'],
  },
  'u-icon': {
    props: { name: {}, size: {}, color: {} },
    events: ['click'],
  },
};
