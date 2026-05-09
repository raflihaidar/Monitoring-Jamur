<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import DefaultLayout from '../layouts/Default.vue'
import Pagination from '../components/Pagination.vue'

const VITE_BE_URL = import.meta.env.VITE_BE_URL

// ── Active tab ─────────────────────────────────────────────
const activeTab = ref('sensor') // 'sensor' | 'actuator'

// ── Shared filter ──────────────────────────────────────────
const dateFrom = ref('')
const dateTo   = ref('')

// ─────────────────────────────────────────────────────────
// TAB SENSOR
// ─────────────────────────────────────────────────────────
const sensorRows    = ref([])
const sensorLoading = ref(false)
const sensorError   = ref(null)
const sensorPage    = ref(1)
const sensorTotal   = ref(0)
const sensorTotalPages = ref(1)
const LIMIT = 15

const fetchSensor = async () => {
  sensorLoading.value = true
  sensorError.value   = null
  try {
    const params = { page: sensorPage.value, limit: LIMIT }
    if (dateFrom.value) params.dateFrom = dateFrom.value
    if (dateTo.value)   params.dateTo   = dateTo.value
    const res = await axios.get(`${VITE_BE_URL}/data/history`, { params })
    sensorRows.value       = res.data.data
    sensorTotal.value      = res.data.pagination.total
    sensorTotalPages.value = res.data.pagination.totalPages
  } catch (e) {
    sensorError.value = 'Gagal memuat data sensor.'
  } finally {
    sensorLoading.value = false
  }
}

// ─────────────────────────────────────────────────────────
// TAB AKTUATOR LOG
// ─────────────────────────────────────────────────────────
const actRows      = ref([])
const actLoading   = ref(false)
const actError     = ref(null)
const actPage      = ref(1)
const actTotal     = ref(0)
const actTotalPages = ref(1)
const actTypeFilter = ref('')   // '' | 'pump' | 'fan' | 'humidifier'
const actModeFilter = ref('')   // '' | 'Fuzzy' | 'Manual' | 'Timer'

const fetchActuator = async () => {
  actLoading.value = true
  actError.value   = null
  try {
    const params = { page: actPage.value, limit: LIMIT }
    if (dateFrom.value)      params.dateFrom = dateFrom.value
    if (dateTo.value)        params.dateTo   = dateTo.value
    if (actTypeFilter.value) params.type     = actTypeFilter.value
    if (actModeFilter.value) params.mode     = actModeFilter.value
    const res = await axios.get(`${VITE_BE_URL}/data/actuator/log`, { params })
    actRows.value       = res.data.data
    actTotal.value      = res.data.pagination.total
    actTotalPages.value = res.data.pagination.totalPages
  } catch (e) {
    actError.value = 'Gagal memuat log aktuator.'
  } finally {
    actLoading.value = false
  }
}

// ── Switch tab ─────────────────────────────────────────────
const switchTab = (tab) => {
  activeTab.value = tab
  if (tab === 'sensor') fetchSensor()
  if (tab === 'actuator')  fetchActuator()
}

// ── Filter & reset ─────────────────────────────────────────
const applyFilter = () => {
  sensorPage.value = 1
  actPage.value    = 1
  if (activeTab.value === 'sensor')   fetchSensor()
  if (activeTab.value === 'actuator') fetchActuator()
}

const resetFilter = () => {
  dateFrom.value       = ''
  dateTo.value         = ''
  actTypeFilter.value  = ''
  actModeFilter.value  = ''
  sensorPage.value     = 1
  actPage.value        = 1
  fetchSensor()
  fetchActuator()
}

// ── Pagination helpers ─────────────────────────────────────
const makePagesArr = (total) => Array.from({ length: total }, (_, i) => i + 1)
const sensorPages = computed(() => makePagesArr(sensorTotalPages.value))
const actPages    = computed(() => makePagesArr(actTotalPages.value))

const goSensor = (p) => { if (p >= 1 && p <= sensorTotalPages.value) { sensorPage.value = p } }
const goAct    = (p) => { if (p >= 1 && p <= actTotalPages.value)    { actPage.value    = p } }

watch(sensorPage, fetchSensor)
watch(actPage,    fetchActuator)
watch([actTypeFilter, actModeFilter], () => { actPage.value = 1; fetchActuator() })

// ── Export query ───────────────────────────────────────────
const exportQuery = computed(() => {
  const p = new URLSearchParams()
  if (dateFrom.value) p.set('dateFrom', dateFrom.value)
  if (dateTo.value)   p.set('dateTo',   dateTo.value)
  return p.toString() ? `?${p}` : ''
})

// ── Formatters ─────────────────────────────────────────────
const formatDate = (iso) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

const formatStatus = (val) =>
  ({ VERYLOW: 'Very Low', LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', VERYHIGH: 'Very High' }[val] ?? val)

const statusClass = (val) => ({
  VERYLOW:  'bg-gray-100 text-gray-400 border border-gray-200',
  LOW:      'bg-blue-50 text-blue-400 border border-blue-200',
  NORMAL:   'bg-emerald-50 text-emerald-600 border border-emerald-200',
  HIGH:     'bg-orange-100 text-orange-500 border border-orange-200',
  VERYHIGH: 'bg-red-100 text-red-500 border border-red-200',
}[val] ?? 'bg-gray-100 text-gray-400 border border-gray-200')

const modeClass = (m) => ({
  Fuzzy:  'bg-blue-50 text-blue-700 border border-blue-200',
  Manual: 'bg-amber-50 text-amber-700 border border-amber-200',
  Timer:  'bg-purple-50 text-purple-700 border border-purple-200',
}[m] ?? 'bg-gray-100 text-gray-400 border border-gray-200')

const modeIcon = (m) => ({ Fuzzy: '🤖', Manual: '✋', Timer: '⏱' }[m] ?? '')

const typeIcon = (t) => ({ pump: '💧', fan: '💨', humidifier: '🌫️' }[t] ?? '')

const tempClass = (v) => v < 22 ? 'text-blue-500 font-semibold' : v <= 25 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'
const humClass  = (v) => v < 80 ? 'text-orange-400 font-semibold' : v <= 90 ? 'text-emerald-600 font-semibold' : 'text-blue-500 font-semibold'
const soilClass = (v) => v > 2600 ? 'text-orange-400 font-semibold' : v > 1800 ? 'text-emerald-600 font-semibold' : 'text-blue-500 font-semibold'

onMounted(fetchSensor)
</script>

<template>
  <DefaultLayout>
    <main class="flex-1">

      <!-- HEADER -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-800">Riwayat Data</h1>
        <p class="text-xs text-gray-400 mt-0.5">Log sensor & aktuator jamur kuping</p>
      </div>

      <!-- TAB BAR -->
      <div class="flex gap-0 border-b border-gray-200 mb-4">
        <button
          @click="switchTab('sensor')"
          :class="[
            'px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
            activeTab === 'sensor'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          ]"
        >
          Sensor
        </button>
        <button
          @click="switchTab('actuator')"
          :class="[
            'px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
            activeTab === 'actuator'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          ]"
        >
          Log Aktuator
        </button>
      </div>

      <!-- FILTER BAR -->
      <div class="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-500 font-medium">Dari Tanggal</label>
          <input type="date" v-model="dateFrom"
            class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-500 font-medium">Sampai Tanggal</label>
          <input type="date" v-model="dateTo"
            class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>

        <!-- Filter aktuator (hanya tampil di tab aktuator) -->
        <template v-if="activeTab === 'actuator'">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500 font-medium">Aktuator</label>
            <select v-model="actTypeFilter"
              class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Semua</option>
              <option value="pump">Pump</option>
              <option value="fan">Fan</option>
              <option value="humidifier">Humidifier</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500 font-medium">Mode</label>
            <select v-model="actModeFilter"
              class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Semua</option>
              <option value="Fuzzy">Fuzzy</option>
              <option value="Manual">Manual</option>
              <option value="Timer">Timer</option>
            </select>
          </div>
        </template>

        <button @click="applyFilter"
          class="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition font-medium">
          Filter
        </button>
        <button @click="resetFilter"
          class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg transition font-medium">
          Reset
        </button>
        <a  v-if="activeTab === 'sensor'" :href="`${VITE_BE_URL}/data/export${exportQuery}`" target="_blank"
          class="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm rounded-lg transition font-medium flex items-center gap-1.5">
          Export Excel
        </a>
        <p class="ml-auto text-xs text-gray-400 self-center">
          Total:
          <span class="font-semibold text-gray-600">
            {{ activeTab === 'sensor' ? sensorTotal : actTotal }} data
          </span>
        </p>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- TAB SENSOR                                        -->
      <!-- ══════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'sensor'">
        <div class="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div v-if="sensorLoading" class="flex items-center justify-center py-16">
            <div class="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div v-else-if="sensorError" class="text-center py-16 text-sm text-red-500">{{ sensorError }}</div>
          <div v-else-if="sensorRows.length === 0" class="text-center py-16 text-sm text-gray-400">Tidak ada data.</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  <th class="px-4 py-3 whitespace-nowrap">Waktu</th>
                  <th class="px-4 py-3 text-center">Suhu (°C)</th>
                  <th class="px-4 py-3 text-center">Kelembapan (%)</th>
                  <th class="px-4 py-3 text-center">Substrat</th>
                  <th class="px-4 py-3 text-center">Pump</th>
                  <th class="px-4 py-3 text-center">Fan</th>
                  <th class="px-4 py-3 text-center">Humidifier</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="row in sensorRows" :key="row.id" class="hover:bg-emerald-50/40 transition-colors">
                  <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{{ formatDate(row.date) }}</td>
                  <td class="px-4 py-3 text-center"><span :class="tempClass(row.temperature)">{{ row.temperature.toFixed(1) }}</span></td>
                  <td class="px-4 py-3 text-center"><span :class="humClass(row.humidity)">{{ row.humidity.toFixed(1) }}</span></td>
                  <td class="px-4 py-3 text-center"><span :class="soilClass(row.soil)">{{ row.soil.toFixed(0) }}</span></td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.pump)]">{{ formatStatus(row.pump) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.fan)]">{{ formatStatus(row.fan) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.humidifier)]">{{ formatStatus(row.humidifier) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination Sensor -->
        <Pagination :pages="sensorPages" :current="sensorPage" :total="sensorTotalPages" @go="goSensor" />
      </template>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- TAB AKTUATOR LOG                                  -->
      <!-- ══════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'actuator'">
        <div class="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div v-if="actLoading" class="flex items-center justify-center py-16">
            <div class="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div v-else-if="actError" class="text-center py-16 text-sm text-red-500">{{ actError }}</div>
          <div v-else-if="actRows.length === 0" class="text-center py-16 text-sm text-gray-400">Tidak ada data.</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  <th class="px-4 py-3 whitespace-nowrap">Waktu</th>
                  <th class="px-4 py-3 text-center">Aktuator</th>
                  <th class="px-4 py-3 text-center">Status</th>
                  <th class="px-4 py-3 text-center">Mode</th>
                  <!-- <th class="px-4 py-3 text-center">Suhu </th>
                  <th class="px-4 py-3 text-center">Kelembapan </th> -->
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="row in actRows" :key="row.id" class="hover:bg-emerald-50/40 transition-colors">
                  <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{{ formatDate(row.date) }}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="text-sm capitalize">{{ row.type }}</span>
                    <!-- <span class="ml-1 text-xs font-medium text-gray-700 capitalize">{{ row.type }}</span> -->
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.status)]">
                      {{ formatStatus(row.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', modeClass(row.mode)]">
                      {{ row.mode }}
                    </span>
                  </td>
                  <!-- <td class="px-4 py-3 text-center">
                    <span v-if="row.data" :class="tempClass(row.data.temperature)">
                      {{ row.data.temperature.toFixed(1) }}°C
                    </span>
                    <span v-else class="text-gray-300">–</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span v-if="row.data" :class="humClass(row.data.humidity)">
                      {{ row.data.humidity.toFixed(1) }}%
                    </span>
                    <span v-else class="text-gray-300">–</span>
                  </td> -->
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination Aktuator -->
        <Pagination :pages="actPages" :current="actPage" :total="actTotalPages" @go="goAct" />
      </template>

    </main>
  </DefaultLayout>
</template>