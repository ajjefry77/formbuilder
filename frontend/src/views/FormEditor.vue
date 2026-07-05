<template>
  <div class="editor-layout">
    <!-- Sidebar: Field palette -->
    <aside class="palette">
      <h3 class="palette-title">نوع فیلد</h3>
      <button
        v-for="ft in FIELD_TYPES" 
        :key="ft.type"
        class="palette-item"
        @click="addField(ft.type)"
      >
        <Icon :icon="ft.icon" class="palette-icon" width="22" height="22" />
        <span>{{ ft.label }}</span>
      </button>
    </aside>

    <!-- Center: Canvas -->
    <main class="canvas">
      <div class="canvas-header">
        <input v-model="formTitle" class="input form-title-input" placeholder="عنوان فرم..." />
        <input v-model="formDescription" class="input" placeholder="توضیحات (اختیاری)" style="margin-top:8px" />
        <select v-model="formGroupId" class="select-native" style="margin-top:8px">
          <option :value="null">بدون گروه</option>
          <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </div>

      <div v-if="!fields.length" class="empty-canvas">
        <p>👈 یک نوع فیلد از سمت راست انتخاب کنید</p>
      </div>

      <div v-else class="fields-list">
        <div
          v-for="(field, idx) in fields" 
          :key="field.id"
          class="field-row"
          :class="{ 'field-row--selected': selectedFieldId === field.id, 'field-row--dragover': dragOverIndex === idx }"
          draggable="true"
          @click="selectField(field.id)"
          @dragstart="onDragStart(idx)"
          @dragover.prevent="dragOverIndex = idx"
          @dragleave="dragOverIndex = null"
          @drop="onDrop(idx)"
          @dragend="dragOverIndex = null"
        >
          <span class="drag-handle">⠿</span>
          
          <div class="field-preview">
            <div class="field-label-row">
              <Icon 
                :icon="FIELD_TYPES.find(f => f.type === field.type)?.icon || 'mdi:help-circle-outline'" 
                class="field-type-badge" 
                width="20" 
                height="20"
              />
              <strong>{{ field.label }}</strong>
              <span v-if="field.required" class="required-star">*</span>
            </div>
          </div>

          <div class="field-row-actions">
            <button class="icon-btn" title="کپی" @click.stop="duplicateField(field.id)">
              <Icon icon="mdi:content-copy" width="18" height="18" />
            </button>
            <button class="icon-btn danger" title="حذف" @click.stop="removeField(field.id)">
              <Icon icon="mdi:delete-outline" width="18" height="18" />
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Right panel: Field properties -->
    <aside class="properties" v-if="selectedField">
      <h3 class="properties-title">تنظیمات فیلد</h3>

      <div class="prop-group">
        <label>برچسب</label>
        <input class="input" :value="selectedField.label"
          @input="updateField(selectedField.id, { label: $event.target.value })" />
      </div>

      <div class="prop-group">
        <label>متن راهنما (placeholder)</label>
        <input class="input" :value="selectedField.placeholder"
          @input="updateField(selectedField.id, { placeholder: $event.target.value })" />
      </div>

      <div class="prop-group">
        <label>توضیح کمکی</label>
        <input class="input" :value="selectedField.helpText"
          @input="updateField(selectedField.id, { helpText: $event.target.value })" />
      </div>

      <div class="prop-group prop-toggle">
        <label>اجباری</label>
        <input type="checkbox" :checked="selectedField.required"
          @change="updateField(selectedField.id, { required: $event.target.checked })" />
      </div>

      <!-- Options for select/radio/checkbox -->
      <div v-if="['select','radio','checkbox'].includes(selectedField.type)" class="prop-group">
        <label>گزینه‌ها</label>
        <div v-for="(opt, i) in selectedField.options" :key="i" class="option-row">
          <input class="input" :value="opt"
            @input="updateOption(selectedField.id, i, $event.target.value)" />
          <button class="icon-btn danger" @click="removeOption(selectedField.id, i)">
            <Icon icon="mdi:delete-outline" width="16" height="16" />
          </button>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" @click="addOption(selectedField.id)">
          <Icon icon="mdi:plus" width="16" height="16" style="margin-left:4px" />
          افزودن گزینه
        </button>
      </div>
    </aside>

    <aside class="properties properties--empty" v-else>
      <p>یک فیلد انتخاب کنید تا تنظیمات آن نمایش داده شود</p>
    </aside>
  </div>

  <!-- Bottom save bar -->
  <div class="save-bar">
    <div class="save-bar-inner">
      <label class="toggle-label">
        <input type="checkbox" v-model="isActive" />
        <span>فرم فعال باشد</span>
      </label>
      <div style="display:flex;gap:8px">
        <router-link to="/" class="btn btn-ghost">انصراف</router-link>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          <Icon v-if="!saving" icon="mdi:content-save" width="18" height="18" style="margin-left:6px" />
          {{ saving ? 'در حال ذخیره...' : (isEdit ? 'ذخیره تغییرات' : 'ایجاد فرم') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForms } from '../composables/useForms.js'
import { useFormBuilder } from '../composables/useFormBuilder.js'
import { useGroups } from '../composables/useGroups.js'

const route = useRoute()
const router = useRouter()
const { fetchForm, createForm, updateForm } = useForms()
const { groups, fetchGroups } = useGroups()
const isEdit = computed(() => !!route.params.id)

const formTitle = ref('فرم بدون عنوان')
const formDescription = ref('')
const formGroupId = ref(null)
const isActive = ref(true)
const saving = ref(false)
let dragFromIndex = null

const {
  fields, selectedFieldId, selectedField, dragOverIndex,
  FIELD_TYPES, addField, removeField, selectField, updateField,
  moveField, duplicateField, addOption, removeOption, updateOption
} = useFormBuilder([])

onMounted(async () => {
  await fetchGroups()
  if (isEdit.value) {
    const form = await fetchForm(route.params.id)
    formTitle.value = form.title
    formDescription.value = form.description || ''
    formGroupId.value = form.group_id ?? null
    isActive.value = form.is_active
    fields.value = form.fields || []
  }
})

function onDragStart(idx) { dragFromIndex = idx }
function onDrop(toIdx) {
  if (dragFromIndex !== null && dragFromIndex !== toIdx) moveField(dragFromIndex, toIdx)
  dragFromIndex = null
  dragOverIndex.value = null
}

async function save() {
  if (!formTitle.value.trim()) return alert('عنوان فرم الزامی است')
  saving.value = true
  try {
    const payload = { title: formTitle.value, description: formDescription.value, group_id: formGroupId.value, fields: fields.value, is_active: isActive.value }
    if (isEdit.value) await updateForm(route.params.id, payload)
    else await createForm(payload)
    router.push('/')
  } catch (e) {
    alert('خطا: ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editor-layout {
  display: grid;
  grid-template-columns: 180px 1fr 240px;
  height: calc(100vh - 56px - 60px);
  overflow: hidden;
}

.palette {
  background: var(--surface);
  border-left: 1px solid var(--border);
  padding: 16px 10px;
  overflow-y: auto;
}
.palette-title { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: .5px; }
.palette-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px; margin-bottom: 4px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; font-family: var(--font); font-size: 13px;
  color: var(--text); cursor: pointer; transition: all .15s;
  text-align: right;
}
.palette-item:hover { border-color: var(--accent); background: var(--accent-glow); }
.palette-icon { font-size: 16px; }

.canvas {
  padding: 20px;
  overflow-y: auto;
  border-left: 1px solid var(--border);
}
.form-title-input { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.canvas-header { margin-bottom: 20px; }
.empty-canvas {
  border: 2px dashed var(--border); border-radius: var(--radius);
  padding: 60px; text-align: center; color: var(--text-muted);
  margin-top: 20px;
}

.field-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; margin-bottom: 8px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all .15s;
}
.field-row:hover { border-color: var(--accent); }
.field-row--selected { border-color: var(--accent); background: var(--accent-glow); }
.field-row--dragover { border-color: var(--warning); transform: scale(1.01); }
.drag-handle { color: var(--text-muted); cursor: grab; font-size: 18px; }
.field-preview { flex: 1; }
.field-label-row { display: flex; align-items: center; gap: 6px; }
.required-star { color: var(--danger); }
.field-row-actions { display: flex; gap: 4px; }
.icon-btn {
  background: none; border: none; cursor: pointer; padding: 4px 7px;
  border-radius: 6px; color: var(--text-muted); font-size: 14px;
  transition: all .15s;
}
.icon-btn:hover { background: var(--surface); color: var(--text); }
.icon-btn.danger:hover { color: var(--danger); }

.properties {
  background: var(--surface); border-right: 1px solid var(--border);
  padding: 16px; overflow-y: auto;
}
.properties--empty { display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 13px; text-align: center; }
.properties-title { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; text-transform: uppercase; letter-spacing: .5px; }
.prop-group { margin-bottom: 14px; }
.prop-toggle { display: flex; justify-content: space-between; align-items: center; }
.option-row { display: flex; gap: 6px; margin-bottom: 6px; }

.save-bar {
  background: var(--surface); border-top: 1px solid var(--border);
  height: 60px; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
}
.save-bar-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 20px;
  height: 100%; display: flex; align-items: center; justify-content: space-between;
}
.toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
</style>
