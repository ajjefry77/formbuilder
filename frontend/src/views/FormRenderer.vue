<template>
  <div class="page" style="max-width:680px">
    <div v-if="loading" class="loading">در حال بارگذاری...</div>
    <div v-else-if="submitted" class="success-card card">
      <div class="success-icon">✅</div>
      <h2>فرم با موفقیت ارسال شد!</h2>
      <p>پاسخ شما ثبت گردید.</p>
      <button class="btn btn-ghost" style="margin-top:16px" @click="reset">ارسال مجدد</button>
    </div>
    <div v-else-if="form" class="card">
      <div class="preview-header">
        <span class="badge" :class="form.is_active ? 'badge-active' : 'badge-inactive'">
          {{ form.is_active ? 'فعال' : 'غیرفعال' }}
        </span>
        <router-link v-if="showEdit" :to="`/forms/${form.id}/edit`" class="btn btn-ghost btn-sm">✏️ ویرایش</router-link>
      </div>
      <h1 class="preview-title">{{ form.title }}</h1>
      <p v-if="form.description" class="preview-desc">{{ form.description }}</p>

      <div class="fields-form">
        <div v-for="field in form.fields" :key="field.id" class="field-group">
          <label class="field-label">
            {{ field.label }}
            <span v-if="field.required" class="required-star">*</span>
          </label>

          <input v-if="['text','email','phone','number','date'].includes(field.type)"
            :type="field.type === 'phone' ? 'tel' : field.type"
            :placeholder="field.placeholder"
            v-model="formData[field.id]"
            class="input"
            @input="clearError(field.id)"
          />

          <textarea v-else-if="field.type === 'textarea'"
            :placeholder="field.placeholder"
            v-model="formData[field.id]"
            class="textarea"
            @input="clearError(field.id)"
          />

          <select v-else-if="field.type === 'select'"
            v-model="formData[field.id]"
            class="select-native"
            @change="clearError(field.id)"
          >
            <option value="" disabled>انتخاب کنید...</option>
            <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>

          <div v-else-if="field.type === 'radio'" class="radio-group">
            <label v-for="opt in field.options" :key="opt" class="radio-label">
              <input type="radio" :name="field.id" :value="opt" v-model="formData[field.id]" @change="clearError(field.id)" />
              {{ opt }}
            </label>
          </div>

          <div v-else-if="field.type === 'checkbox'" class="checkbox-group">
            <label v-for="opt in field.options" :key="opt" class="checkbox-label">
              <input type="checkbox" :value="opt"
                :checked="(formData[field.id] || []).includes(opt)"
                @change="toggleCheckbox(field.id, opt)" />
              {{ opt }}
            </label>
          </div>

          <input v-else-if="field.type === 'file'" type="file" class="input" />

          <p v-if="field.helpText" class="help-text">{{ field.helpText }}</p>
          <p v-if="errors[field.id]" class="field-error">{{ errors[field.id] }}</p>
        </div>

        <button class="btn btn-primary submit-btn" :disabled="submitting" @click="submit">
          {{ submitting ? 'در حال ارسال...' : 'ارسال فرم' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useFormValidator } from '../composables/useFormValidator.js'

const props = defineProps({
  form: { type: Object, default: null },
  loading: { type: Boolean, default: true },
  showEdit: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])

const submitting = ref(false)
const submitted = ref(false)
const formData = reactive({})

const fields = ref([])
const { errors, validate, clearError } = useFormValidator(fields)

onMounted(() => {
  if (props.form) {
    fields.value = props.form.fields || []
  }
})

function toggleCheckbox(fieldId, opt) {
  if (!formData[fieldId]) formData[fieldId] = []
  const arr = formData[fieldId]
  const i = arr.indexOf(opt)
  if (i === -1) arr.push(opt)
  else arr.splice(i, 1)
}

async function submit() {
  if (!validate(formData)) return
  submitting.value = true
  try {
    emit('submit', { ...formData })
    submitted.value = true
  } catch (e) {
    alert('خطا: ' + e.message)
  } finally {
    submitting.value = false
  }
}

function reset() {
  Object.keys(formData).forEach(k => delete formData[k])
  submitted.value = false
}
</script>

<style scoped>
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.preview-title { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
.preview-desc { color: var(--text-muted); margin-bottom: 24px; }
.field-group { margin-bottom: 20px; }
.field-label { font-size: 14px; font-weight: 500; color: var(--text); margin-bottom: 6px; display: block; }
.required-star { color: var(--danger); margin-right: 2px; }
.help-text { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.radio-group, .checkbox-group { display: flex; flex-direction: column; gap: 8px; }
.radio-label, .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.submit-btn { width: 100%; margin-top: 10px; justify-content: center; padding: 12px; font-size: 15px; }
.success-card { text-align: center; padding: 60px; }
.success-icon { font-size: 48px; margin-bottom: 16px; }
.success-card h2 { font-size: 22px; margin-bottom: 8px; }
.success-card p { color: var(--text-muted); }
.loading { text-align: center; padding: 60px; color: var(--text-muted); }
</style>
