// composables/useApi.js
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import router from '../router/index.js'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export function useApi() {
  const loading = ref(false)
  const error = ref(null)

  async function request(method, endpoint, body = null) {
    loading.value = true
    error.value = null
    try {
      const auth = useAuthStore()
      const headers = { 'Content-Type': 'application/json' }
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`

      const options = { method, headers }
      if (body) options.body = JSON.stringify(body)

      const res = await fetch(`${BASE_URL}${endpoint}`, options)

      if (res.status === 401) {
        auth.logout()
        router.push('/login')
        throw new Error('نشست شما منقضی شده، دوباره وارد شوید')
      }

      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'خطای ناشناخته')
      return json.data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    get: (endpoint) => request('GET', endpoint),
    post: (endpoint, body) => request('POST', endpoint, body),
    put: (endpoint, body) => request('PUT', endpoint, body),
    del: (endpoint) => request('DELETE', endpoint),
  }
}
