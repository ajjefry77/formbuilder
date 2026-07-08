import { ref } from 'vue'
import { useApi } from './useApi.js'

export function useGroups() {
  const { loading, error, get, post, put, del } = useApi()
  const groups = ref([])

  async function fetchGroups() {
    groups.value = await get('/groups')
  }

  async function createGroup(payload) {
    const created = await post('/groups', payload)
    groups.value.unshift(created)
    return created
  }

  async function updateGroup(id, payload) {
    const updated = await put(`/groups/${id}`, payload)
    const idx = groups.value.findIndex(g => g.id === id)
    if (idx !== -1) groups.value[idx] = updated
    return updated
  }

  async function deleteGroup(id) {
    await del(`/groups/${id}`)
    groups.value = groups.value.filter(g => g.id !== id)
  }

  async function fetchGroupPermissions(id) {
    return await get(`/groups/${id}/permissions`)
  }

  async function setGroupPermissions(id, formIds) {
    return await put(`/groups/${id}/permissions`, { formIds })
  }

  async function fetchGroupMembers(id) {
    return await get(`/groups/${id}/members`)
  }

  async function setGroupMembers(id, userIds) {
    return await put(`/groups/${id}/members`, { userIds })
  }

  return {
    groups, loading, error,
    fetchGroups, createGroup, updateGroup, deleteGroup,
    fetchGroupPermissions, setGroupPermissions,
    fetchGroupMembers, setGroupMembers,
  }
}
