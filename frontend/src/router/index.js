import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

import Login from '../views/Login.vue'
import FormList from '../views/FormList.vue'
import FormEditor from '../views/FormEditor.vue'
import FormPreview from '../views/FormPreview.vue'
import FormFill from '../views/FormFill.vue'
import FormSubmissions from '../views/FormSubmissions.vue'
import AdminUsers from '../views/admin/Users.vue'
import AdminGroups from '../views/admin/Groups.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login, meta: { public: true } },
    { path: '/f/:id', component: FormFill, meta: { public: true } }, // لینک عمومی پر کردن فرم

    { path: '/', component: FormList },
    { path: '/forms/new', component: FormEditor, meta: { managerOrAdmin: true } },
    { path: '/forms/:id/edit', component: FormEditor, meta: { managerOrAdmin: true } },
    { path: '/forms/:id/preview', component: FormPreview },
    { path: '/forms/:id/submissions', component: FormSubmissions },

    { path: '/admin/users', component: AdminUsers, meta: { managerOrAdmin: true } },
    { path: '/admin/groups', component: AdminGroups, meta: { managerOrAdmin: true } },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) return true
  if (!auth.isAuthenticated) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.adminOnly && !auth.isAdmin) return { path: '/' }
  if (to.meta.managerOrAdmin && !auth.isAdmin && !auth.isGroupManager) return { path: '/' }
  return true
})

export default router
