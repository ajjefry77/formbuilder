<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">مدیریت کاربران</h1>
      <button class="btn btn-primary" @click="openCreate">+ کاربر جدید</button>
    </div>

    <div v-if="loading && !users.length" class="loading">در حال بارگذاری...</div>
    <div v-else-if="!users.length" class="empty-state card">هنوز کاربری ساخته نشده است.</div>

    <div v-else class="table-wrap card">
      <table class="sub-table">
        <thead>
          <tr>
            <th>نام و نام خانوادگی</th>
            <th>شماره تماس (نام کاربری)</th>
            <th>نقش‌ها</th>
            <th>گروه‌ها</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.full_name }}</td>
            <td dir="ltr" style="text-align:left">{{ u.phone }}</td>
            <td>
              <span v-for="r in (u.roles || [u.role])" :key="r" class="badge" :class="r === 'admin' ? 'badge-active' : 'badge-inactive'" style="margin-left:4px">{{ roleLabel(r) }}</span>
            </td>
            <td>
              <span v-if="u.groups?.length">{{ u.groups.map(g => g.name).join('، ') }}</span>
              <span v-else-if="u.group_name">{{ u.group_name }}</span>
              <span v-else>—</span>
            </td>
            <td><span class="badge" :class="u.is_active ? 'badge-active' : 'badge-inactive'">{{ u.is_active ? 'فعال' : 'غیرفعال' }}</span></td>
            <td>
              <div class="row-actions">
                <button class="btn btn-ghost btn-sm" @click="openEdit(u)">✏️ ویرایش</button>
                <button class="btn btn-ghost btn-sm" @click="openPermissions(u)" v-if="!u.roles?.includes('admin') && !(u.role === 'admin') && auth.isAdmin">🔑 دسترسی فرم‌ها</button>
                <button class="btn btn-danger btn-sm" @click="onDelete(u)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- مودال ایجاد/ویرایش کاربر -->
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <div class="modal card">
        <h2 class="modal-title">{{ editingUser ? 'ویرایش کاربر' : 'کاربر جدید' }}</h2>

        <div class="prop-group">
          <label>نام و نام خانوادگی</label>
          <input v-model="form.full_name" class="input" />
        </div>
        <div class="prop-group">
          <label>شماره تماس (نام کاربری)</label>
          <input v-model="form.phone" class="input" dir="ltr" placeholder="09123456789" />
        </div>
        <div class="prop-group">
          <label>{{ editingUser ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور' }}</label>
          <input v-model="form.password" type="password" class="input" />
        </div>
        <div class="prop-group" v-if="auth.isAdmin">
          <label>نقش‌ها</label>
          <div class="check-group">
            <label v-for="opt in roleOptions" :key="opt.value" class="check-row-inline">
              <input type="checkbox" :value="opt.value" v-model="form.roles" />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </div>
        <div class="prop-group">
          <label>گروه‌ها{{ auth.isGroupManager ? ' (حداقل یکی الزامی)' : '' }}</label>
          <div class="check-group">
            <label v-for="g in groups" :key="g.id" class="check-row-inline">
              <input type="checkbox" :value="g.id" v-model="form.group_ids" />
              <span>{{ g.name }}</span>
            </label>
            <p v-if="!groups.length" class="empty-hint">گروهی وجود ندارد</p>
          </div>
        </div>
        <div class="prop-group prop-toggle" v-if="editingUser">
          <label>فعال باشد</label>
          <input type="checkbox" v-model="form.is_active" />
        </div>

        <p v-if="modalError" class="field-error">❌ {{ modalError }}</p>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="modalOpen = false">انصراف</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? 'در حال ذخیره...' : 'ذخیره' }}</button>
        </div>
      </div>
    </div>

    <!-- مودال دسترسی فرم‌ها -->
    <div v-if="permModalOpen" class="modal-backdrop" @click.self="permModalOpen = false">
      <div class="modal card">
        <h2 class="modal-title">دسترسی فرم‌های «{{ permUser?.full_name }}»</h2>
        <p class="modal-hint">فرم‌هایی که می‌خواهید این کاربر بتواند مدیریت/مشاهده کند را انتخاب کنید.</p>
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
import { useUsers } from '../../composables/useUsers.js'
import { useGroups } from '../../composables/useGroups.js'
import { useForms } from '../../composables/useForms.js'
import { useAuthStore } from '../../stores/auth.js'

const { users, loading, fetchUsers, createUser, updateUser, deleteUser, fetchUserPermissions, setUserPermissions } = useUsers()
const { groups, fetchGroups } = useGroups()
const { forms: allForms, fetchForms } = useForms()
const auth = useAuthStore()

const modalOpen = ref(false)
const modalError = ref('')
const saving = ref(false)
const editingUser = ref(null)
const form = reactive({ full_name: '', phone: '', password: '', roles: ['user'], group_ids: [], is_active: true })

const permModalOpen = ref(false)
const permUser = ref(null)
const selectedFormIds = ref([])
const savingPerm = ref(false)

const roleOptions = [
  { value: 'user', label: 'کاربر عادی' },
  { value: 'group_manager', label: 'مدیر گروه' },
  { value: 'admin', label: 'مدیر سیستم' },
]

onMounted(async () => {
  await Promise.all([fetchUsers(), fetchGroups(), fetchForms()])
})

function roleLabel(role) {
  if (role === 'admin') return 'مدیر سیستم'
  if (role === 'group_manager') return 'مدیر گروه'
  return 'کاربر'
}

function openCreate() {
  editingUser.value = null
  Object.assign(form, { full_name: '', phone: '', password: '', roles: ['user'], group_ids: auth.isGroupManager ? [] : [], is_active: true })
  modalError.value = ''
  modalOpen.value = true
}

function openEdit(u) {
  editingUser.value = u
  Object.assign(form, {
    full_name: u.full_name,
    phone: u.phone,
    password: '',
    roles: u.roles || [u.role || 'user'],
    group_ids: (u.group_ids) || (u.group_id ? [u.group_id] : (u.groups?.map(g => g.id) || [])),
    is_active: u.is_active,
  })
  modalError.value = ''
  modalOpen.value = true
}

async function onSave() {
  modalError.value = ''
  if (!form.full_name || !form.phone || (!editingUser.value && !form.password)) {
    modalError.value = 'لطفاً فیلدهای الزامی را پر کنید'
    return
  }
  if (auth.isGroupManager && !form.group_ids.length) {
    modalError.value = 'انتخاب حداقل یک گروه الزامی است'
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    if (!payload.password) delete payload.password
    if (auth.isGroupManager) payload.roles = ['user']
    if (editingUser.value) await updateUser(editingUser.value.id, payload)
    else await createUser(payload)
    await fetchUsers()
    modalOpen.value = false
  } catch (e) {
    modalError.value = e.message
  } finally {
    saving.value = false
  }
}

async function onDelete(u) {
  if (!confirm(`کاربر «${u.full_name}» حذف شود؟`)) return
  await deleteUser(u.id)
}

async function openPermissions(u) {
  permUser.value = u
  selectedFormIds.value = await fetchUserPermissions(u.id)
  permModalOpen.value = true
}

async function onSavePermissions() {
  savingPerm.value = true
  try {
    await setUserPermissions(permUser.value.id, selectedFormIds.value)
    permModalOpen.value = false
  } finally {
    savingPerm.value = false
  }
}
</script>

<style scoped>
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.table-wrap { padding: 0; overflow-x: auto; }
.sub-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sub-table th { padding: 12px 14px; text-align: right; font-weight: 600; font-size: 12px; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
.sub-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); }
.sub-table tr:last-child td { border-bottom: none; }
.sub-table tr:hover td { background: var(--surface2); }
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
.check-group { display: flex; flex-direction: column; gap: 6px; }
.check-row-inline { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
.check-row-inline:hover { background: var(--surface2); }
</style>
