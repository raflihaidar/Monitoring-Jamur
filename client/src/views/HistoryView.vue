<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import DefaultLayout from '../layouts/Default.vue'
import Pagination from '../components/Pagination.vue'

const VITE_BE_URL   = import.meta.env.VITE_BE_URL
const LIMIT_OPTIONS = [15, 30, 50, 100]

const STATUS_OPTIONS = ['VERYLOW', 'LOW', 'NORMAL', 'HIGH', 'VERYHIGH']

// ── Active tab ─────────────────────────────────────────────
const activeTab = ref('sensor')

// ── Shared filter ──────────────────────────────────────────
const dateFrom = ref('')
const dateTo   = ref('')

// ─────────────────────────────────────────────────────────
// TAB SENSOR
// ─────────────────────────────────────────────────────────
const sensorRows        = ref([])
const sensorLoading     = ref(false)
const sensorError       = ref(null)
const sensorLimit       = ref(15)
const sensorCursors     = ref([null])
const sensorPageIndex   = ref(0)
const sensorNextCursor  = ref(null)

// Filter status sensor — bisa filter pump / fan / humidifier per status
const sensorPumpStatus  = ref('')
const sensorFanStatus   = ref('')
const sensorHumStatus   = ref('')

const sensorHasPrev = computed(() => sensorPageIndex.value > 0)
const sensorHasNext = computed(() => !!sensorNextCursor.value)

const fetchSensor = async (cursor = null) => {
  sensorLoading.value = true
  sensorError.value   = null
  try {
    const params = { limit: sensorLimit.value }
    if (cursor)                  params.cursor     = cursor
    if (dateFrom.value)          params.dateFrom   = dateFrom.value
    if (dateTo.value)            params.dateTo     = dateTo.value
    if (sensorPumpStatus.value)  params.pump       = sensorPumpStatus.value
    if (sensorFanStatus.value)   params.fan        = sensorFanStatus.value
    if (sensorHumStatus.value)   params.humidifier = sensorHumStatus.value
    const res = await axios.get(`${VITE_BE_URL}/data/history`, { params })
    sensorRows.value       = res.data.data
    sensorNextCursor.value = res.data.pagination.nextCursor
  } catch {
    sensorError.value = 'Gagal memuat data sensor.'
  } finally {
    sensorLoading.value = false
  }
}

const sensorNext = () => {
  if (!sensorNextCursor.value) return
  sensorCursors.value.push(sensorNextCursor.value)
  sensorPageIndex.value++
  fetchSensor(sensorNextCursor.value)
}

const sensorPrev = () => {
  if (sensorPageIndex.value === 0) return
  sensorPageIndex.value--
  sensorCursors.value.pop()
  fetchSensor(sensorCursors.value[sensorPageIndex.value] ?? null)
}

const resetSensorCursor = () => {
  sensorCursors.value    = [null]
  sensorPageIndex.value  = 0
  sensorNextCursor.value = null
}

// ─────────────────────────────────────────────────────────
// TAB AKTUATOR LOG
// ─────────────────────────────────────────────────────────
const actRows       = ref([])
const actLoading    = ref(false)
const actError      = ref(null)
const actLimit      = ref(15)
const actCursors    = ref([null])
const actPageIndex  = ref(0)
const actNextCursor = ref(null)
const actTypeFilter = ref('')
const actModeFilter = ref('')
const actStatusFilter = ref('')   // ← filter status baru

const actHasPrev = computed(() => actPageIndex.value > 0)
const actHasNext = computed(() => !!actNextCursor.value)

const fetchActuator = async (cursor = null) => {
  actLoading.value = true
  actError.value   = null
  try {
    const params = { limit: actLimit.value }
    if (cursor)               params.cursor   = cursor
    if (dateFrom.value)       params.dateFrom = dateFrom.value
    if (dateTo.value)         params.dateTo   = dateTo.value
    if (actTypeFilter.value)  params.type     = actTypeFilter.value
    if (actModeFilter.value)  params.mode     = actModeFilter.value
    if (actStatusFilter.value) params.status  = actStatusFilter.value
    const res = await axios.get(`${VITE_BE_URL}/data/actuator/log`, { params })
    actRows.value       = res.data.data
    actNextCursor.value = res.data.pagination.nextCursor
  } catch {
    actError.value = 'Gagal memuat log aktuator.'
  } finally {
    actLoading.value = false
  }
}

const actNext = () => {
  if (!actNextCursor.value) return
  actCursors.value.push(actNextCursor.value)
  actPageIndex.value++
  fetchActuator(actNextCursor.value)
}

const actPrev = () => {
  if (actPageIndex.value === 0) return
  actPageIndex.value--
  actCursors.value.pop()
  fetchActuator(actCursors.value[actPageIndex.value] ?? null)
}

const resetActCursor = () => {
  actCursors.value    = [null]
  actPageIndex.value  = 0
  actNextCursor.value = null
}

// ── Switch tab ─────────────────────────────────────────────
const switchTab = (tab) => {
  activeTab.value = tab
  if (tab === 'sensor')   fetchSensor()
  if (tab === 'actuator') fetchActuator()
}

// ── Filter & reset ─────────────────────────────────────────
const applyFilter = () => {
  resetSensorCursor()
  resetActCursor()
  if (activeTab.value === 'sensor')   fetchSensor()
  if (activeTab.value === 'actuator') fetchActuator()
}

const resetFilter = () => {
  dateFrom.value        = ''
  dateTo.value          = ''
  sensorPumpStatus.value = ''
  sensorFanStatus.value  = ''
  sensorHumStatus.value  = ''
  actTypeFilter.value   = ''
  actModeFilter.value   = ''
  actStatusFilter.value = ''
  resetSensorCursor()
  resetActCursor()
  fetchSensor()
  fetchActuator()
}

// ── Watch ──────────────────────────────────────────────────
watch(sensorLimit, () => { resetSensorCursor(); fetchSensor() })
watch(actLimit,    () => { resetActCursor();    fetchActuator() })
watch([actTypeFilter, actModeFilter, actStatusFilter], () => { resetActCursor(); fetchActuator() })
watch([sensorPumpStatus, sensorFanStatus, sensorHumStatus], () => { resetSensorCursor(); fetchSensor() })

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
        <button @click="switchTab('sensor')" :class="[
          'px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
          activeTab === 'sensor'
            ? 'border-emerald-500 text-emerald-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        ]">Sensor</button>
        <button @click="switchTab('actuator')" :class="[
          'px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px',
          activeTab === 'actuator'
            ? 'border-emerald-500 text-emerald-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        ]">Log Aktuator</button>
      </div>

      <!-- FILTER BAR -->
      <div class="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">

        <!-- Shared: tanggal -->
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

        <!-- Filter khusus tab SENSOR -->
        <template v-if="activeTab === 'sensor'">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500 font-medium">Status Pump</label>
            <select v-model="sensorPumpStatus"
              class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Semua</option>
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ formatStatus(s) }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500 font-medium">Status Fan</label>
            <select v-model="sensorFanStatus"
              class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Semua</option>
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ formatStatus(s) }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500 font-medium">Status Humidifier</label>
            <select v-model="sensorHumStatus"
              class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Semua</option>
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ formatStatus(s) }}</option>
            </select>
          </div>
        </template>

        <!-- Filter khusus tab AKTUATOR -->
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
            <label class="text-xs text-gray-500 font-medium">Status</label>
            <select v-model="actStatusFilter"
              class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Semua</option>
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ formatStatus(s) }}</option>
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
        <a :href="activeTab === 'sensor'
            ? `${VITE_BE_URL}/data/export${exportQuery}`
            : `${VITE_BE_URL}/data/actuator-log/export${exportQuery}`"
          target="_blank"
          class="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm rounded-lg transition font-medium flex items-center gap-1.5">
          Export Excel
        </a>
        <p class="ml-auto text-xs text-gray-400 self-center">
          Halaman ke-<span class="font-semibold text-gray-600">{{
            activeTab === 'sensor' ? sensorPageIndex + 1 : actPageIndex + 1
          }}</span>
        </p>
      </div>

      <!-- TAB SENSOR -->
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
                  <th class="px-4 py-3 text-center">Mode</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="row in sensorRows" :key="row.id" class="hover:bg-emerald-50/40 transition-colors">
                  <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{{ formatDate(row.recordedAt) }}</td>
                  <td class="px-4 py-3 text-center">
                    <span :class="tempClass(row.temperature)">{{ row.temperature.toFixed(1) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="humClass(row.humidity)">{{ row.humidity.toFixed(1) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="soilClass(row.soil)">{{ row.soil.toFixed(0) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.pump)]">
                      {{ formatStatus(row.pump) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.fan)]">
                      {{ formatStatus(row.fan) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.humidifier)]">
                      {{ formatStatus(row.humidifier) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', modeClass(row.mode)]">
                      {{ row.mode }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          :hasPrev="sensorHasPrev"
          :hasNext="sensorHasNext"
          :limit="sensorLimit"
          :limitOptions="LIMIT_OPTIONS"
          @prev="sensorPrev"
          @next="sensorNext"
          @limitChange="sensorLimit = $event"
        />
      </template>

      <!-- TAB AKTUATOR LOG -->
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
                  <th class="px-4 py-3 text-center">Suhu (°C)</th>
                  <th class="px-4 py-3 text-center">Kelembapan (%)</th>
                  <th class="px-4 py-3 text-center">Substrat</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="row in actRows" :key="row.id" class="hover:bg-emerald-50/40 transition-colors">
                  <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{{ formatDate(row.recordedAt) }}</td>
                  <td class="px-4 py-3 text-center capitalize text-sm">{{ row.type }}</td>
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
                  <td class="px-4 py-3 text-center">
                    <span v-if="row.temperature != null" :class="tempClass(row.temperature)">
                      {{ row.temperature.toFixed(1) }}
                    </span>
                    <span v-else class="text-gray-300">-</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span v-if="row.humidity != null" :class="humClass(row.humidity)">
                      {{ row.humidity.toFixed(1) }}
                    </span>
                    <span v-else class="text-gray-300">-</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span v-if="row.soil != null" :class="soilClass(row.soil)">
                      {{ Math.round(row.soil) }}
                    </span>
                    <span v-else class="text-gray-300">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          :hasPrev="actHasPrev"
          :hasNext="actHasNext"
          :limit="actLimit"
          :limitOptions="LIMIT_OPTIONS"
          @prev="actPrev"
          @next="actNext"
          @limitChange="actLimit = $event"
        />
      </template>

    </main>
  </DefaultLayout>
</template>