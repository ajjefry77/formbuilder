<template>
  <FormRenderer
    :form="form"
    :loading="loading"
    :showEdit="true"
    @submit="onSubmit"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useForms } from '../composables/useForms.js'
import FormRenderer from './FormRenderer.vue'

const route = useRoute()
const { fetchForm, submitForm } = useForms()

const form = ref(null)
const loading = ref(true)

onMounted(async () => {
  form.value = await fetchForm(route.params.id)
  loading.value = false
})

async function onSubmit(data) {
  await submitForm(route.params.id, data)
}
</script>
