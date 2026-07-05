// composables/useForms.js
import { ref } from 'vue'
import { useApi } from './useApi.js'

export function useForms() {
  const { loading, error, get, post, put, del } = useApi()
  const forms = ref([])
  const currentForm = ref(null)

  async function fetchForms() {
    forms.value = await get('/forms')
  }

  async function fetchForm(id) {
    currentForm.value = await get(`/forms/${id}`)
    return currentForm.value
  }

  // برای صفحه‌ی عمومی پر کردن فرم - بدون نیاز به ورود کاربر
  async function fetchPublicForm(id) {
    currentForm.value = await get(`/forms/${id}/public`)
    return currentForm.value
  }

  async function createForm(formData) {
    const created = await post('/forms', formData)
    forms.value.unshift(created)
    return created
  }

  async function updateForm(id, formData) {
    const updated = await put(`/forms/${id}`, formData)
    const idx = forms.value.findIndex(f => f.id === id)
    if (idx !== -1) forms.value[idx] = updated
    currentForm.value = updated
    return updated
  }

  async function deleteForm(id) {
    await del(`/forms/${id}`)
    forms.value = forms.value.filter(f => f.id !== id)
  }

  async function submitForm(id, data) {
    return await post(`/forms/${id}/submit`, { data })
  }

  async function fetchSubmissions(id, params = {}) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') query.set(key, value)
    }
    const qs = query.toString()
    return await get(`/forms/${id}/submissions${qs ? `?${qs}` : ''}`)
  }

  return {
    forms,
    currentForm,
    loading,
    error,
    fetchForms,
    fetchForm,
    fetchPublicForm,
    createForm,
    updateForm,
    deleteForm,
    submitForm,
    fetchSubmissions,
  }
}
