import { ref } from 'vue'
import { useApi } from './useApi.js'

export function useUsers() {
  const { loading, error, get, post, put, del } = useApi()
  const users = ref([])

  async function fetchUsers() {
    users.value = await get('/users')
  }

  async function createUser(payload) {
    const created = await post('/users', payload)
    users.value.unshift(created)
    return created
  }

  async function updateUser(id, payload) {
    const updated = await put(`/users/${id}`, payload)
    const idx = users.value.findIndex(u => u.id === id)
    if (idx !== -1) users.value[idx] = updated
    return updated
  }

  async function deleteUser(id) {
    await del(`/users/${id}`)
    users.value = users.value.filter(u => u.id !== id)
  }

  async function fetchUserPermissions(id) {
    return await get(`/users/${id}/permissions`)
  }

  async function setUserPermissions(id, formIds) {
    return await put(`/users/${id}/permissions`, { formIds })
  }

  return {
    users, loading, error,
    fetchUsers, createUser, updateUser, deleteUser,
    fetchUserPermissions, setUserPermissions,
  }
}
