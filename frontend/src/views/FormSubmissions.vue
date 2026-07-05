<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">پاسخ‌های فرم: {{ form?.title }}</h1>
      <router-link
        :to="`/forms/${route.params.id}/edit`"
        class="btn btn-ghost btn-sm back-btn"
        >← برگشت</router-link
      >
    </div>

    <div v-if="loading" class="loading">در حال بارگذاری...</div>
    <template v-else>
      <div class="filters card">
        <div class="simple-filters">
          <label class="filter-field">
            <span>از تاریخ</span>
            <input v-model="dateFilters.from" type="date" class="input" />
          </label>
          <label class="filter-field">
            <span>تا تاریخ</span>
            <input v-model="dateFilters.to" type="date" class="input" />
          </label>
          <label class="filter-field">
            <span>مرتب‌سازی</span>
            <select v-model="dateFilters.sort" class="select-native">
              <option value="desc">جدیدترین</option>
              <option value="asc">قدیمی‌ترین</option>
            </select>
          </label>
        </div>

        <template v-if="showAdvanced">
          <div class="filter-divider"></div>
          <div class="filter-section">
            <div class="filter-section__title">شرط‌های فیلد</div>
            <div class="filter-section__row filter-section__row--logic">
              <label class="logic-toggle">
                <span>عملگر بین شرط‌ها:</span>
                <select v-model="filterLogic" class="select-native">
                  <option value="AND">و (AND)</option>
                  <option value="OR">یا (OR)</option>
                </select>
              </label>
            </div>

            <div v-for="(cond, i) in fieldFilters" :key="i" class="condition-row">
              <label class="condition-field">
                <span>فیلد</span>
                <select
                  v-model="cond.field_key"
                  class="select-native"
                  @change="onFieldChange(i)"
                >
                  <option value="">انتخاب فیلد</option>
                  <option
                    v-for="field in form?.fields || []"
                    :key="field.id"
                    :value="`field_${field.id}`"
                  >
                    {{ field.label }}
                  </option>
                </select>
              </label>
              <label class="condition-operator">
                <span>عملگر</span>
                <select v-model="cond.operator" class="select-native">
                  <option
                    v-for="op in getOperatorsForField(i)"
                    :key="op.value"
                    :value="op.value"
                  >
                    {{ op.label }}
                  </option>
                </select>
              </label>
              <label class="condition-value" v-if="!isNoValueOp(cond.operator)">
                <span>مقدار</span>
                <input
                  v-model="cond.value"
                  class="input"
                  type="text"
                  placeholder="مقدار..."
                />
              </label>
              <button
                class="btn btn-danger btn-sm condition-remove"
                @click="removeCondition(i)"
                :disabled="fieldFilters.length === 1"
              >
                ✕
              </button>
            </div>

            <button class="btn btn-ghost btn-sm" @click="addCondition">
              + افزودن شرط
            </button>
          </div>
        </template>

        <div class="filters-actions">
          <button class="btn btn-primary btn-sm" @click="applyFilters">
            اعمال فیلتر
          </button>
          <button class="btn btn-ghost btn-sm" @click="resetFilters">
            پاک کردن
          </button>
          <button
            class="btn btn-ghost btn-sm toggle-advanced"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? "فیلتر ساده" : "فیلتر پیشرفته" }}
            <span class="toggle-icon">{{ showAdvanced ? "▲" : "▼" }}</span>
          </button>
        </div>
      </div>

      <div v-if="!submissions.length" class="empty-state card">
        <p>پاسخی با این فیلترها یافت نشد.</p>
        <router-link
          :to="`/forms/${route.params.id}/preview`"
          class="btn btn-primary"
          style="margin-top: 12px"
        >
          مشاهده فرم
        </router-link>
      </div>
      <div v-else>
        <p class="sub-count">{{ submissions.length }} پاسخ</p>
        <div class="table-wrap card">
          <table class="sub-table">
            <thead>
              <tr>
                <th>#</th>
                <th v-for="field in form.fields" :key="field.id">
                  {{ field.label }}
                </th>
                <th>تاریخ ارسال</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(sub, idx) in submissions" :key="sub.id">
                <td>{{ idx + 1 }}</td>
                <td v-for="field in form.fields" :key="field.id">
                  <span class="cell-val">{{
                    formatValue(sub.data[field.id])
                  }}</span>
                </td>
                <td>{{ formatDate(sub.submitted_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useForms } from "../composables/useForms.js";

const route = useRoute();
const { fetchForm, fetchSubmissions } = useForms();

const form = ref(null);
const submissions = ref([]);
const loading = ref(true);

const showAdvanced = ref(false);

const dateFilters = reactive({
  sort: "desc",
  from: "",
  to: "",
});

const filterLogic = ref("AND");

const fieldFilters = reactive([
  { field_key: "", operator: "contains", value: "" },
]);

const operatorOptions = {
  text: [
    { value: "contains", label: "شامل" },
    { value: "not_contains", label: "شامل نباشد" },
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  textarea: [
    { value: "contains", label: "شامل" },
    { value: "not_contains", label: "شامل نباشد" },
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  number: [
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "gt", label: "بزرگتر از" },
    { value: "gte", label: "بزرگتر یا برابر" },
    { value: "lt", label: "کوچکتر از" },
    { value: "lte", label: "کوچکتر یا برابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  email: [
    { value: "contains", label: "شامل" },
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  phone: [
    { value: "contains", label: "شامل" },
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  date: [
    { value: "eq", label: "برابر" },
    { value: "gt", label: "بعد از" },
    { value: "gte", label: "بعد یا برابر" },
    { value: "lt", label: "قبل از" },
    { value: "lte", label: "قبل یا برابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  select: [
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  radio: [
    { value: "eq", label: "برابر" },
    { value: "neq", label: "نابرابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  checkbox: [
    { value: "contains", label: "شامل" },
    { value: "eq", label: "برابر" },
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
  file: [
    { value: "is_empty", label: "خالی باشد" },
    { value: "is_not_empty", label: "خالی نباشد" },
  ],
};

function getFieldType(i) {
  const cond = fieldFilters[i];
  if (!cond.field_key) return "text";
  const field = form.value?.fields?.find(
    (f) => `field_${f.id}` === cond.field_key,
  );
  return field?.type || "text";
}

function getOperatorsForField(i) {
  const type = getFieldType(i);
  return operatorOptions[type] || operatorOptions.text;
}

function isNoValueOp(op) {
  return op === "is_empty" || op === "is_not_empty";
}

function onFieldChange(i) {
  const ops = getOperatorsForField(i);
  const cond = fieldFilters[i];
  const currentOpValid = ops.some((o) => o.value === cond.operator);
  if (!currentOpValid) {
    cond.operator = ops[0]?.value || "contains";
  }
}

function addCondition() {
  fieldFilters.push({ field_key: "", operator: "contains", value: "" });
}

function removeCondition(i) {
  if (fieldFilters.length > 1) {
    fieldFilters.splice(i, 1);
  }
}

async function loadSubmissions() {
  const params = {
    sort: dateFilters.sort,
    from: dateFilters.from ? `${dateFilters.from}T00:00:00` : "",
    to: dateFilters.to ? `${dateFilters.to}T23:59:59` : "",
  };

  const validFilters = fieldFilters.filter(
    (f) => f.field_key && (isNoValueOp(f.operator) || f.value),
  );
  if (validFilters.length > 0) {
    params.filters = JSON.stringify(validFilters);
    params.filter_logic = filterLogic.value;
  }

  submissions.value = await fetchSubmissions(route.params.id, params);
}

async function applyFilters() {
  loading.value = true;
  try {
    await loadSubmissions();
  } finally {
    loading.value = false;
  }
}

async function resetFilters() {
  dateFilters.sort = "desc";
  dateFilters.from = "";
  dateFilters.to = "";
  filterLogic.value = "AND";
  fieldFilters.splice(0, fieldFilters.length, {
    field_key: "",
    operator: "contains",
    value: "",
  });
  await applyFilters();
}

onMounted(async () => {
  form.value = await fetchForm(route.params.id);
  await loadSubmissions();
  loading.value = false;
});

function formatDate(str) {
  return new Date(str).toLocaleString("fa-IR");
}

function formatValue(val) {
  if (val === undefined || val === null || val === "") return "—";
  if (Array.isArray(val)) return val.join("، ");
  return String(val);
}
</script>

<style scoped>
.filters {
  padding: 16px;
  margin-bottom: 16px;
}
.simple-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}
.filter-divider {
  height: 1px;
  background: var(--border);
  margin: 12px 0;
}
.toggle-advanced {
  margin-right: auto;
}
.toggle-icon {
  font-size: 10px;
}
.filter-section {
  margin-bottom: 16px;
}
.filter-section:last-of-type {
  margin-bottom: 12px;
}
.filter-section__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.filter-section__row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-section__row--logic {
  margin-bottom: 8px;
}
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
}
.filter-field span {
  font-size: 12px;
  color: var(--text-muted);
}
.logic-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logic-toggle span {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.logic-toggle .select-native {
  width: auto;
  min-width: 100px;
}
.condition-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 8px;
}
.condition-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
  flex: 1;
}
.condition-field span {
  font-size: 11px;
  color: var(--text-muted);
}
.condition-operator {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 130px;
}
.condition-operator span {
  font-size: 11px;
  color: var(--text-muted);
}
.condition-value {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  flex: 1;
}
.condition-value span {
  font-size: 11px;
  color: var(--text-muted);
}
.condition-remove {
  margin-bottom: 0;
  height: 36px;
  width: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.filters-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.sub-count {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.table-wrap {
  padding: 0;
  overflow-x: auto;
}
.sub-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.sub-table th {
  padding: 12px 14px;
  text-align: right;
  font-weight: 600;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.sub-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
}
.sub-table tr:last-child td {
  border-bottom: none;
}
.sub-table tr:hover td {
  background: var(--surface2);
}
.cell-val {
  max-width: 200px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}
.empty-state {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}
</style>
