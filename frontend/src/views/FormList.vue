<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">فرم‌های من</h1>
    </div>

    <div v-if="loading" class="loading">در حال بارگذاری...</div>
    <div v-else-if="error" class="error-msg">❌ {{ error }}</div>
    <div v-else-if="!forms.length" class="empty-state">
      <p>
        {{
          canManageForms
            ? "هنوز فرمی نساخته‌اید."
            : "هنوز فرمی به شما اختصاص داده نشده است."
        }}
      </p>
      <router-link
        v-if="canManageForms"
        to="/forms/new"
        class="btn btn-primary"
        style="margin-top: 12px"
        >اولین فرم را بسازید</router-link
      >
    </div>
    <div v-else class="forms-grid">
      <div v-for="form in forms" :key="form.id" class="form-card card">
        <div class="form-card-header">
          <span
            class="badge"
            :class="form.is_active ? 'badge-active' : 'badge-inactive'"
          >
            {{ form.is_active ? "فعال" : "غیرفعال" }}
          </span>
          <span class="form-date">{{ formatDate(form.created_at) }}</span>
        </div>
        <h2 class="form-title">{{ form.title }}</h2>
        <p v-if="form.description" class="form-desc">{{ form.description }}</p>
        <div class="form-actions">
          <router-link
            v-if="canManageForms"
            :to="`/forms/${form.id}/edit`"
            class="btn btn-ghost btn-sm"
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              width="1.3em"
              height="1.3em"
              viewBox="0 0 24 24"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path
                fill="currentColor"
                d="m14.06 9.02l.92.92L5.92 19H5v-.92zM17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83l3.75 3.75l1.83-1.83a.996.996 0 0 0 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94z"
              />
            </svg>
            ویرایش</router-link
          >
          <router-link
            :to="`/forms/${form.id}/preview`"
            class="btn btn-ghost btn-sm"
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              width="1.3em"
              height="1.3em"
              viewBox="0 0 24 24"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <g fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M20.188 10.934c.388.472.582.707.582 1.066s-.194.594-.582 1.066C18.768 14.79 15.636 18 12 18s-6.768-3.21-8.188-4.934c-.388-.472-.582-.707-.582-1.066s.194-.594.582-1.066C5.232 9.21 8.364 6 12 6s6.768 3.21 8.188 4.934Z"
                />
              </g>
            </svg>
            پیش‌نمایش</router-link
          >
          <router-link
            :to="`/forms/${form.id}/submissions`"
            class="btn btn-ghost btn-sm"
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              width="1.5em"
              height="1.5em"
              viewBox="0 0 24 24"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path
                fill="currentColor"
                d="M4 13c.55 0 1-.45 1-1s-.45-1-1-1s-1 .45-1 1s.45 1 1 1m0 4c.55 0 1-.45 1-1s-.45-1-1-1s-1 .45-1 1s.45 1 1 1m0-8c.55 0 1-.45 1-1s-.45-1-1-1s-1 .45-1 1s.45 1 1 1m4 4h12c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1s.45 1 1 1m0 4h12c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1s.45 1 1 1M7 8c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1m-3 5c.55 0 1-.45 1-1s-.45-1-1-1s-1 .45-1 1s.45 1 1 1m0 4c.55 0 1-.45 1-1s-.45-1-1-1s-1 .45-1 1s.45 1 1 1m0-8c.55 0 1-.45 1-1s-.45-1-1-1s-1 .45-1 1s.45 1 1 1m4 4h12c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1s.45 1 1 1m0 4h12c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1s.45 1 1 1M7 8c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1"
              />
            </svg>
            پاسخ‌ها</router-link
          >
          <button class="btn btn-ghost btn-sm" @click="copyLink(form)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1.3em"
              height="1.3em"
              viewBox="0 0 24 24"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path
                fill="currentColor"
                d="M17 7h-3c-.55 0-1 .45-1 1s.45 1 1 1h3c1.65 0 3 1.35 3 3s-1.35 3-3 3h-3c-.55 0-1 .45-1 1s.45 1 1 1h3c2.76 0 5-2.24 5-5s-2.24-5-5-5m-9 5c0 .55.45 1 1 1h6c.55 0 1-.45 1-1s-.45-1-1-1H9c-.55 0-1 .45-1 1m2 3H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h3c.55 0 1-.45 1-1s-.45-1-1-1H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h3c.55 0 1-.45 1-1s-.45-1-1-1"
              />
            </svg>
            لینک عمومی
          </button>
          <button
            v-if="canManageForms"
            class="btn btn-danger btn-sm"
            @click="confirmDelete(form)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1.5em"
              height="1.5em"
              viewBox="0 0 24 24"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path
                fill="currentColor"
                d="M18 19a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7H4V4h4.5l1-1h4l1 1H19v3h-1zM6 7v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V7zm12-1V5h-4l-1-1h-3L9 5H5v1zM8 9h1v10H8zm6 0h1v10h-1z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from "vue";
import { useForms } from "../composables/useForms.js";
import { useAuthStore } from "../stores/auth.js";

const { forms, loading, error, fetchForms, deleteForm } = useForms();
const auth = useAuthStore();
const canManageForms = computed(() => auth.isAdmin || auth.isGroupManager);

onMounted(fetchForms);

function formatDate(str) {
  return new Date(str).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function confirmDelete(form) {
  if (!confirm(`فرم «${form.title}» حذف شود؟`)) return;
  await deleteForm(form.id);
}

async function copyLink(form) {
  const url = `${window.location.origin}/f/${form.id}`;
  try {
    await navigator.clipboard.writeText(url);
    alert("لینک عمومی فرم کپی شد:\n" + url);
  } catch {
    prompt("لینک عمومی فرم:", url);
  }
}
</script>

<style scoped>
.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.form-card {
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}
.form-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
}
.form-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.form-date {
  font-size: 11px;
  color: var(--text-muted);
}
.form-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 6px;
}
.form-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 14px;
}
.form-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.loading,
.error-msg {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}
.empty-state {
  text-align: center;
  padding: 80px;
  color: var(--text-muted);
}
</style>
