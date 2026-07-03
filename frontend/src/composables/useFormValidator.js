// composables/useFormValidator.js
import { ref } from 'vue'

export function useFormValidator(fields) {
  const errors = ref({})

  function validate(formData) {
    errors.value = {}
    let valid = true

    for (const field of fields.value) {
      const val = formData[field.id]
      const isEmpty = val === undefined || val === null || val === '' ||
        (Array.isArray(val) && val.length === 0)

      if (field.required && isEmpty) {
        errors.value[field.id] = `«${field.label}» اجباری است`
        valid = false
      }

      if (!isEmpty && field.type === 'email') {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRe.test(val)) {
          errors.value[field.id] = 'آدرس ایمیل معتبر نیست'
          valid = false
        }
      }

      if (!isEmpty && field.type === 'phone') {
        const phoneRe = /^[0-9+\-\s()]{7,15}$/
        if (!phoneRe.test(val)) {
          errors.value[field.id] = 'شماره تلفن معتبر نیست'
          valid = false
        }
      }
    }

    return valid
  }

  function clearError(fieldId) {
    delete errors.value[fieldId]
  }

  return { errors, validate, clearError }
}
