import { ref, computed } from 'vue'

let fieldIdCounter = Date.now()

export const FIELD_TYPES = [
  { type: 'text',     label: 'متن کوتاه',    icon: '✏️' },
  { type: 'textarea', label: 'متن بلند',      icon: '📝' },
  { type: 'number',   label: 'عدد',           icon: '🔢' },
  { type: 'email',    label: 'ایمیل',         icon: '📧' },
  { type: 'phone',    label: 'تلفن',          icon: '📞' },
  { type: 'date',     label: 'تاریخ',         icon: '📅' },
  { type: 'select',   label: 'لیست کشویی',   icon: '🔽' },
  { type: 'radio',    label: 'تک‌انتخابی',    icon: '⭕' },
  { type: 'checkbox', label: 'چندانتخابی',    icon: '☑️' },
  { type: 'file',     label: 'آپلود فایل',    icon: '📎' },
]

function createField(type) {
  const id = ++fieldIdCounter;
  const base = {
    id,
    type,
    label: FIELD_TYPES.find(f => f.type === type)?.label || 'فیلد جدید',
    placeholder: '',
    required: false,
    helpText: '',
    key: `field_${id}`
  }
  if (['select', 'radio', 'checkbox'].includes(type)) {
    base.options = ['گزینه ۱', 'گزینه ۲']
  }
  return base
}

export function useFormBuilder(initialFields = []) {
  const fields = ref(initialFields.map(f => ({ ...f })))
  const selectedFieldId = ref(null)
  const dragOverIndex = ref(null)

  const selectedField = computed(() =>
    fields.value.find(f => f.id === selectedFieldId.value) || null
  )

  function addField(type) {
    const field = createField(type)
    fields.value.push(field)
    selectedFieldId.value = field.id
    return field
  }

  function removeField(id) {
    fields.value = fields.value.filter(f => f.id !== id)
    if (selectedFieldId.value === id) selectedFieldId.value = null
  }

  function selectField(id) {
    selectedFieldId.value = id
  }

  function updateField(id, patch) {
    const idx = fields.value.findIndex(f => f.id === id)
    if (idx !== -1) {
      fields.value[idx] = { ...fields.value[idx], ...patch }
    }
  }

  function moveField(fromIndex, toIndex) {
    const arr = [...fields.value]
    const [item] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, item)
    fields.value = arr
  }

  function duplicateField(id) {
    const idx = fields.value.findIndex(f => f.id === id)
    if (idx === -1) return
    const copy = { ...fields.value[idx], id: ++fieldIdCounter }
    fields.value.splice(idx + 1, 0, copy)
  }

  function addOption(fieldId) {
    const f = fields.value.find(f => f.id === fieldId)
    if (f && f.options) f.options.push(`گزینه ${f.options.length + 1}`)
  }

  function removeOption(fieldId, optIndex) {
    const f = fields.value.find(f => f.id === fieldId)
    if (f && f.options) f.options.splice(optIndex, 1)
  }

  function updateOption(fieldId, optIndex, value) {
    const f = fields.value.find(f => f.id === fieldId)
    if (f && f.options) f.options[optIndex] = value
  }

  return {
    fields,
    selectedFieldId,
    selectedField,
    dragOverIndex,
    FIELD_TYPES,
    addField,
    removeField,
    selectField,
    updateField,
    moveField,
    duplicateField,
    addOption,
    removeOption,
    updateOption,
  }
}