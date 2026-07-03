<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">مدیریت گروه‌ها</h1>
      <button class="btn btn-primary" @click="openCreate">+ گروه جدید</button>
    </div>

    <div v-if="loading && !groups.length" class="loading">در حال بارگذاری...</div>
    <div v-else-if="!groups.length" class="empty-state card">هنوز گروهی ساخته نشده است.</div>

    <div v-else class="forms-grid">
      <div v-for="g in groups" :key="g.id" class="card group-card">
        <div class="group-card-header">
          <h2 class="group-title">{{ g.name }}</h2>
          <span class="badge badge-inactive">{{ g.member_count }} عضو</span>
        </div>
        <p v-if="g.description" class="group-desc">{{ g.description }}</p>
        <div class="form-actions">
          <button class="btn btn-ghost btn-sm" @click="openEdit(g)">✏️ ویرایش</button>
          <button class="btn btn-ghost btn-sm" @click="openPermissions(g)">🔑 دسترسی فرم‌ها</button>
          <button class="btn btn-danger btn-sm" @click="onDelete(g)">🗑️</button>
        </div>
      </div>
    </div>

    <!-- مودال ایجاد/ویرایش گروه -->
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <div class="modal card">
        <h2 class="modal-title">{{ editingGroup ? 'ویرایش گروه' : 'گروه جدید' }}</h2>
        <div class="prop-group">
          <label>نام گروه</label>
          <input v-model="form.name" class="input" />
        </div>
        <div class="prop-group">
          <label>توضیحات (اختیاری)</label>
          <input v-model="form.description" class="input" />
        </div>
        <p v-if="modalError" class="field-error">❌ {{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="modalOpen = false">انصراف</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? 'در حال ذخیره...' : 'ذخیره' }}</button>
        </div>
      </div>
    </div>

    <!-- مودال دسترسی فرم‌های گروه -->
    <div v-if="permModalOpen" class="modal-backdrop" @click.self="permModalOpen = false">
      <div class="modal card">
        <h2 class="modal-title">دسترسی فرم‌های گروه «{{ permGroup?.name }}»</h2>
        <p class="modal-hint">همه‌ی اعضای این گروه به فرم‌های انتخاب‌شده دسترسی خواهند داشت.</p>
        <div class="forms-checklist">
          <label v-for="f in allForms" :key="f.id" class="check-row">
            <input type="checkbox" :value="f.id" v-model="selectedFormIds" />
            <span>{{ f.title }}</span>
          </label>
          <p v-if="!allForms.length" class="empty-hint">هیچ فرمی ساخته نشده است.</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="permModalOpen = false">انصراف</button>
          <button class="btn btn-primary" :disabled="savingPerm" @click="onSavePermissions">{{ savingPerm ? 'در حال ذخیره...' : 'ذخیره دسترسی‌ها' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useGroups } from '../../composables/useGroups.js'
import { useForms } from '../../composables/useForms.js'

const { groups, loading, fetchGroups, createGroup, updateGroup, deleteGroup, fetchGroupPermissions, setGroupPermissions } = useGroups()
const { forms: allForms, fetchForms } = useForms()

const modalOpen = ref(false)
const modalError = ref('')
const saving = ref(false)
const editingGroup = ref(null)
const form = reactive({ name: '', description: '' })

const permModalOpen = ref(false)
const permGroup = ref(null)
const selectedFormIds = ref([])
const savingPerm = ref(false)

onMounted(async () => {
  await Promise.all([fetchGroups(), fetchForms()])
})

function openCreate() {
  editingGroup.value = null
  Object.assign(form, { name: '', description: '' })
  modalError.value = ''
  modalOpen.value = true
}

function openEdit(g) {
  editingGroup.value = g
  Object.assign(form, { name: g.name, description: g.description || '' })
  modalError.value = ''
  modalOpen.value = true
}

async function onSave() {
  if (!form.name.trim()) { modalError.value = 'نام گروه الزامی است'; return }
  saving.value = true
  try {
    if (editingGroup.value) await updateGroup(editingGroup.value.id, form)
    else await createGroup(form)
    await fetchGroups()
    modalOpen.value = false
  } catch (e) {
    modalError.value = e.message
  } finally {
    saving.value = false
  }
}

async function onDelete(g) {
  if (!confirm(`گروه «${g.name}» حذف شود؟ (کاربران عضو حذف نمی‌شوند)`)) return
  await deleteGroup(g.id)
}

async function openPermissions(g) {
  permGroup.value = g
  selectedFormIds.value = await fetchGroupPermissions(g.id)
  permModalOpen.value = true
}

async function onSavePermissions() {
  savingPerm.value = true
  try {
    await setGroupPermissions(permGroup.value.id, selectedFormIds.value)
    permModalOpen.value = false
  } finally {
    savingPerm.value = false
  }
}
</script>

<style scoped>
.forms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.group-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.group-title { font-size: 17px; font-weight: 600; }
.group-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; }
.form-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
.loading, .empty-state { text-align: center; padding: 60px; color: var(--text-muted); }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
}
.modal { width: 100%; max-width: 420px; max-height: 86vh; overflow-y: auto; }
.modal-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
.modal-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.forms-checklist { display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; }
.check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; padding: 6px 8px; border-radius: 8px; }
.check-row:hover { background: var(--surface2); }
.empty-hint { font-size: 12px; color: var(--text-muted); }
</style>
