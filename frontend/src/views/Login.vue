<template>
  <div class="auth-screen">
    <div class="auth-card card">
      <div class="auth-logo">🗂️ فرم‌ساز</div>
      <h1 class="auth-title">ورود به سامانه</h1>
      <p class="auth-sub">با شماره تماس و رمز عبور خود وارد شوید</p>

      <form @submit.prevent="onSubmit" class="auth-form">
        <div class="prop-group">
          <label>شماره تماس (نام کاربری)</label>
          <input v-model="phone" class="input" placeholder="09123456789" dir="ltr" autocomplete="username" />
        </div>
        <div class="prop-group">
          <label>رمز عبور</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <p v-if="error" class="field-error">❌ {{ error }}</p>

        <button class="btn btn-primary auth-submit" :disabled="loading" type="submit">
          {{ loading ? 'در حال ورود...' : 'ورود' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const router = useRouter()
const route = useRoute()
const { login, loading, error } = useAuth()

const phone = ref('')
const password = ref('')

async function onSubmit() {
  try {
    await login(phone.value.trim(), password.value)
    router.push(route.query.redirect || '/')
  } catch (e) {
    // پیام خطا از useAuth در error نمایش داده می‌شود
  }
}
</script>

<style scoped>
.auth-screen {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, var(--accent-glow), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(62,207,142,.12), transparent 40%),
    var(--bg);
  padding: 20px;
}
.auth-card {
  width: 100%; max-width: 380px;
  padding: 36px 32px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
}
.auth-logo { font-size: 20px; font-weight: 700; color: var(--accent); margin-bottom: 18px; }
.auth-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.auth-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 26px; }
.auth-form { text-align: right; }
.auth-submit { width: 100%; justify-content: center; padding: 11px; font-size: 15px; margin-top: 6px; }
</style>
