import { useApi } from './useApi.js'
import { useAuthStore } from '../stores/auth.js'

export function useAuth() {
  const { loading, error, post, get } = useApi()
  const auth = useAuthStore()

  async function login(phone, password) {
    const data = await post('/auth/login', { phone, password })
    auth.setSession(data.token, data.user)
    return data.user
  }

  async function fetchMe() {
    const data = await get('/auth/me')
    auth.updateUser(data)
    return data
  }

  async function changePassword(currentPassword, newPassword) {
    return await post('/auth/change-password', { currentPassword, newPassword })
  }

  function logout() {
    auth.logout()
  }

  return { loading, error, login, logout, fetchMe, changePassword }
}
