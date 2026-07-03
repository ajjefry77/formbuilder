<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">فرم‌های من</h1>
    </div>

    <div v-if="loading" class="loading">در حال بارگذاری...</div>
    <div v-else-if="error" class="error-msg">❌ {{ error }}</div>
    <div v-else-if="!forms.length" class="empty-state">
      <p>{{ canManageForms ? 'هنوز فرمی نساخته‌اید.' : 'هنوز فرمی به شما اختصاص داده نشده است.' }}</p>
      <router-link v-if="canManageForms" to="/forms/new" class="btn btn-primary" style="margin-top:12px">اولین فرم را بسازید</router-link>
    </div>
    <div v-else class="forms-grid">
      <div v-for="form in forms" :key="form.id" class="form-card card">
        <div class="form-card-header">
          <span class="badge" :class="form.is_active ? 'badge-active' : 'badge-inactive'">
            {{ form.is_active ? 'فعال' : 'غیرفعال' }}
          </span>
          <span class="form-date">{{ formatDate(form.created_at) }}</span>
        </div>
        <h2 class="form-title">{{ form.title }}</h2>
        <p v-if="form.description" class="form-desc">{{ form.description }}</p>
        <div class="form-actions">
          <router-link v-if="canManageForms" :to="`/forms/${form.id}/edit`" class="btn btn-ghost btn-sm">✏️ ویرایش</router-link>
          <router-link :to="`/forms/${form.id}/preview`" class="btn btn-ghost btn-sm">👁️ پیش‌نمایش</router-link>
          <router-link :to="`/forms/${form.id}/submissions`" class="btn btn-ghost btn-sm">📊 پاسخ‌ها</router-link>
          <button class="btn btn-ghost btn-sm" @click="copyLink(form)">🔗 لینک عمومی</button>
          <button v-if="canManageForms" class="btn btn-danger btn-sm" @click="confirmDelete(form)">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useForms } from '../composables/useForms.js'
import { useAuthStore } from '../stores/auth.js'

const { forms, loading, error, fetchForms, deleteForm } = useForms()
const auth = useAuthStore()
const canManageForms = computed(() => auth.isAdmin || auth.isGroupManager)

onMounted(fetchForms)

function formatDate(str) {
  return new Date(str).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function confirmDelete(form) {
  if (!confirm(`فرم «${form.title}» حذف شود؟`)) return
  await deleteForm(form.id)
}

async function copyLink(form) {
  const url = `${window.location.origin}/f/${form.id}`
  try {
    await navigator.clipboard.writeText(url)
    alert('لینک عمومی فرم کپی شد:\n' + url)
  } catch {
    prompt('لینک عمومی فرم:', url)
  }
}
</script>

<style scoped>
.forms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.form-card { transition: transform .15s, box-shadow .15s; }
.form-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,.25); }
.form-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.form-date { font-size: 11px; color: var(--text-muted); }
.form-title { font-size: 17px; font-weight: 600; margin-bottom: 6px; }
.form-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; }
.form-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
.loading, .error-msg { text-align: center; padding: 60px; color: var(--text-muted); }
.empty-state { text-align: center; padding: 80px; color: var(--text-muted); }
</style>
