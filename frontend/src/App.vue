<template>
  <div v-if="!isPublicRoute" class="app-shell">
    <nav class="topbar">
      <router-link to="/" class="topbar-logo">
        <span class="logo-dot"></span> فرم‌ساز
      </router-link>

      <div class="topbar-nav" v-if="auth.isAuthenticated">
        <router-link to="/" class="nav-link">فرم‌ها</router-link>
        <template v-if="auth.isAdmin || auth.isGroupManager">
          <router-link to="/admin/groups" class="nav-link">گروه‌ها</router-link>
          <router-link to="/admin/users" class="nav-link">کاربران</router-link>
        </template>
      </div>

      <div class="topbar-actions" v-if="auth.isAuthenticated">
        <router-link
          v-if="auth.isAdmin || auth.isGroupManager"
          to="/forms/new"
          class="btn btn-primary btn-sm"
          >+ فرم جدید</router-link
        >

        <div
          class="user-menu"
          @click="menuOpen = !menuOpen"
          v-click-outside="closeMenu"
        >
          <span class="user-avatar">{{ initials }}</span>
          <span class="user-name">{{ auth.user?.full_name }}</span>
          <div v-if="menuOpen" class="user-dropdown card">
            <div class="user-dropdown-info">
              <strong>{{ auth.user?.full_name }}</strong>
              <span class="user-phone" dir="ltr">{{ auth.user?.phone }}</span>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
                <span
                  v-for="r in auth.roles"
                  :key="r"
                  class="badge"
                  :class="r === 'admin' ? 'badge-active' : 'badge-inactive'"
                  style="width: fit-content"
                >
                  {{ r === 'admin' ? 'مدیر سیستم' : (r === 'group_manager' ? 'مدیر گروه' : 'کاربر') }}
                </span>
              </div>
            </div>
            <button class="dropdown-item" @click="onLogout">
              🚪 خروج از حساب
            </button>
          </div>
        </div>
      </div>
    </nav>
    <router-view />
  </div>
  <router-view v-else />
</template>

<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth.js";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const menuOpen = ref(false);

const isPublicRoute = computed(() => route.meta.public);

const initials = computed(() => {
  const name = auth.user?.full_name || "";
  return (
    name
      .trim()
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "؟"
  );
});

function closeMenu() {
  menuOpen.value = false;
}

function onLogout() {
  auth.logout();
  menuOpen.value = false;
  router.push("/login");
}

// دایرکتیو ساده برای بستن منو با کلیک بیرون از آن
const vClickOutside = {
  mounted(el, binding) {
    el.__clickOutside__ = (e) => {
      if (!el.contains(e.target)) binding.value();
    };
    document.addEventListener("click", el.__clickOutside__);
  },
  unmounted(el) {
    document.removeEventListener("click", el.__clickOutside__);
  },
};
</script>

<style>
.app-shell {
  min-height: 100vh;
}

.topbar {
  background: rgba(26, 29, 39, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.topbar-logo {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.3px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.logo-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #d97706);
  box-shadow: 0 0 12px var(--accent-glow);
}
.topbar-nav {
  display: flex;
  gap: 4px;
  flex: 1;
}
.nav-link {
  padding: 7px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  transition: all 0.15s;
}
.nav-link:hover {
  color: var(--text);
  background: var(--surface2);
}
.nav-link--active {
  color: var(--accent);
  background: var(--accent-glow);
}

.topbar-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 5px 8px;
  border-radius: var(--radius);
  transition: background 0.15s;
}
.user-menu:hover {
  background: var(--surface2);
}
.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}
.user-name {
  font-size: 13px;
  color: var(--text);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: 220px;
  padding: 14px;
  z-index: 200;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
}
.user-dropdown-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.user-phone {
  font-size: 12px;
  color: var(--text-muted);
}
.dropdown-item {
  width: 100%;
  text-align: right;
  background: none;
  border: none;
  color: var(--danger);
  font-family: var(--font);
  font-size: 13px;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
}
.dropdown-item:hover {
  background: rgba(255, 85, 114, 0.1);
}
</style>
