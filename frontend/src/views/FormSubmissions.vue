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

    <div class="filters-sticky">
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
    </div>

    <div class="tabs">
      <button
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        <svg class="tab-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="16" height="14" rx="2" />
          <line x1="6" y1="8" x2="14" y2="8" />
          <line x1="6" y1="11" x2="14" y2="11" />
          <line x1="6" y1="14" x2="10" y2="14" />
        </svg>
        لیست پاسخ‌ها
      </button>
      <button
        :class="{ active: activeTab === 'map' }"
        @click="activeTab = 'map'"
      >
        <svg class="tab-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2a6 6 0 00-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 00-6-6z" />
          <circle cx="10" cy="8" r="2" />
        </svg>
        نقشه موقعیت‌ها
      </button>
    </div>

    <div v-if="loading" class="loading">در حال بارگذاری...</div>
    <template v-else>
      <div v-if="activeTab === 'list'" class="tab-content">
        <div v-if="!submissions.length" class="empty-state card">
          <p>پاسخی با این فیلترها یافت نشد.</p>
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
      </div>

      <div v-else class="tab-content">
        <div class="map-tab">
          <div ref="mapContainer" class="map-container"></div>
          <div class="map-info-bar">
            <div class="map-stats">
              <span class="map-stat">📍 {{ locationsCount }} موقعیت</span>
              <span class="map-stat-divider"></span>
              <span class="map-stat">{{ submissions.length }} پاسخ</span>
            </div>
            <button class="btn btn-primary btn-sm" @click="fitMap">
              فیت نقشه
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from "vue";
import { useRoute } from "vue-router";
import { useForms } from "../composables/useForms.js";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.setRTLTextPlugin(
      'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
      null,
      true // Lazy load the plugin
  );

const route = useRoute();
const { fetchForm, fetchSubmissions } = useForms();

const form = ref(null);
const submissions = ref([]);
const loading = ref(true);
const activeTab = ref("list");

const mapContainer = ref(null);
let map = null;
let markers = [];

const showAdvanced = ref(false);
const dateFilters = reactive({ sort: "desc", from: "", to: "" });
const filterLogic = ref("AND");
const fieldFilters = reactive([
  { field_key: "", operator: "contains", value: "" },
]);

const locationsCount = computed(() => {
  return submissions.value.filter((sub) => {
    const loc = sub.data?._location || sub.data?.location;
    return loc?.lat && loc?.lng;
  }).length;
});

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
  location: [
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
  await loadSubmissions();
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
  await loadSubmissions();
}

function initMap() {
  if (map) map.remove();

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: "mapbox://styles/mapbox/dark-v11",
    center: [51.389, 35.6892],
    zoom: 6,
  });

  map.addControl(new mapboxgl.NavigationControl(), "top-right");

  map.once("load", () => {
    updateMarkers();
  });
}

function updateMarkers() {
  if (!map) return;

  markers.forEach((m) => m.remove());
  markers = [];

  submissions.value.forEach((sub, idx) => {
    const loc = sub.data?._location || sub.data?.location;
    if (!loc?.lat || !loc?.lng) return;

    const el = document.createElement("div");
    el.className = "map-pin";
    el.innerHTML = `<span class="map-pin__num">${idx + 1}</span>`;

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([loc.lng, loc.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="map-popup">
            <div class="map-popup__header">پاسخ #${idx + 1}</div>
            <div class="map-popup__date">${formatDate(sub.submitted_at)}</div>
          </div>
        `),
      )
      .addTo(map);
    markers.push(marker);
  });

  if (markers.length > 0) {
    fitMap();
  }
}

function fitMap() {
  if (!map || markers.length === 0) return;
  const bounds = new mapboxgl.LngLatBounds();
  markers.forEach((m) => bounds.extend(m.getLngLat()));
  map.fitBounds(bounds, { padding: 60 });
}

watch(activeTab, (tab) => {
  if (tab === "map") nextTick(initMap);
});

watch(submissions, () => {
  if (activeTab.value === "map" && map?.loaded()) {
    updateMarkers();
  }
});

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
.filters-sticky {
  position: sticky;
  top: 76px;
  z-index: 10;
}

.filters {
  padding: 16px;
  margin-bottom: 8px;
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

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tabs button:hover {
  color: var(--text);
  background: var(--surface2);
  border-radius: 8px 8px 0 0;
}

.tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
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

.map-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.map-container {
  height: 65vh;
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.map-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.map-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.map-stat {
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-stat-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
}

:deep(.map-pin) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #d97706);
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

:deep(.map-pin:hover) {
  transform: scale(1.2);
}

:deep(.map-pin__num) {
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font);
}

:deep(.mapboxgl-popup-content) {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  padding: 12px 16px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
  font-family: var(--font) !important;
}

:deep(.mapboxgl-popup-tip) {
  border-top-color: var(--surface) !important;
}

:deep(.mapboxgl-popup-close-button) {
  color: var(--text-muted) !important;
  font-size: 16px !important;
  padding: 4px 8px !important;
}

:deep(.mapboxgl-popup-close-button:hover) {
  color: var(--text) !important;
}

:deep(.map-popup__header) {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  margin-bottom: 4px;
}

:deep(.map-popup__date) {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
