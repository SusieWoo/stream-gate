// H5 浏览器端组件清单（Element Plus 子集）
export const webNativeTags = [
  'template', 'slot', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'section', 'header', 'footer', 'main', 'input', 'button',
  'label', 'form', 'table', 'tr', 'td', 'th', 'svg', 'path',
];

export const webComponentCatalog = {
  'el-form': {
    props: { model: {}, rules: {}, labelWidth: {}, labelPosition: { enum: ['left', 'top', 'right'] }, inline: {}, size: {} },
    events: [],
  },
  'el-form-item': {
    props: { label: {}, prop: {}, required: {}, labelWidth: {}, rules: {} },
    events: [],
  },
  'el-input': {
    props: {
      modelValue: {}, placeholder: {}, disabled: {}, clearable: {}, maxlength: {},
      rows: {}, readonly: {},
      type: { enum: ['text', 'password', 'number', 'textarea', 'email'] },
    },
    events: ['input', 'change', 'focus', 'blur', 'clear', 'keyup'],
  },
  'el-button': {
    props: {
      type: { enum: ['primary', 'success', 'warning', 'danger', 'info', 'default'] },
      size: { enum: ['large', 'default', 'small'] },
      text: {}, loading: {}, disabled: {}, nativeType: {},
    },
    events: ['click'],
  },
  'el-table': {
    props: { data: {}, border: {}, stripe: {}, height: {}, maxHeight: {}, rowKey: {} },
    events: ['row-click', 'selection-change', 'sort-change', 'row-dblclick'],
  },
  'el-table-column': {
    props: { prop: {}, label: {}, width: {}, minWidth: {}, sortable: {}, fixed: {}, align: {} },
    events: [],
  },
  'el-select': {
    props: { modelValue: {}, placeholder: {}, clearable: {}, multiple: {}, disabled: {}, filterable: {} },
    events: ['change', 'visible-change', 'clear'],
  },
  'el-option': {
    props: { label: {}, value: {}, disabled: {} },
    events: [],
  },
  'el-tag': {
    props: { type: { enum: ['primary', 'success', 'warning', 'danger', 'info'] }, size: { enum: ['large', 'default', 'small'] }, closable: {}, effect: {} },
    events: ['close', 'click'],
  },
  'el-pagination': {
    props: { total: {}, pageSize: {}, currentPage: {}, layout: {}, background: {}, pageSizes: {} },
    events: ['current-change', 'size-change'],
  },
  'el-dialog': {
    props: { modelValue: {}, title: {}, width: {}, appendToBody: {}, destroyOnClose: {}, closeOnClickModal: {} },
    events: ['close', 'open', 'opened', 'closed'],
  },
};
