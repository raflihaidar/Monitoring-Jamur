<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import DefaultLayout from '../layouts/Default.vue'

// ── State ──────────────────────────────────────────────
const rows = ref([])
const loading = ref(false)
const error = ref(null)
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)
const limit = 15

const today = new Date().toISOString().split('T')[0]
const dateFrom = ref('')
const dateTo = ref('')
const VITE_BE_URL = import.meta.env.VITE_BE_URL


// ── Fetch ──────────────────────────────────────────────
const fetchHistory = async () => {
  loading.value = true
  error.value = null
  try {
    const params = { page: currentPage.value, limit }
    if (dateFrom.value) params.dateFrom = dateFrom.value
    if (dateTo.value) params.dateTo = dateTo.value

    const res = await axios.get(`${import.meta.env.VITE_BE_URL}/data/history`, { params })
    rows.value = res.data.data
    total.value = res.data.pagination.total
    totalPages.value = res.data.pagination.totalPages
  } catch (e) {
    error.value = 'Gagal memuat data history.'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Helpers ────────────────────────────────────────────
const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const exportQuery = computed(() => {
  const params = new URLSearchParams()
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value)   params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
})

const statusClass = (val) =>
  val === 'ON'
    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : 'bg-gray-100 text-gray-500 border border-gray-200'

const tempClass = (val) => {
  if (val < 22) return 'text-blue-500 font-semibold'   // cold
  if (val <= 25) return 'text-emerald-600 font-semibold' // normal
  return 'text-red-500 font-semibold'                    // hot
}

const humClass = (val) => {
  if (val < 80) return 'text-orange-400 font-semibold' // low
  if (val <= 90) return 'text-emerald-600 font-semibold' // normal
  return 'text-blue-500 font-semibold'                   // high
}

const soilClass = (val) => {
  if (val > 2600) return 'text-orange-400 font-semibold' // low
  if (val > 1800) return 'text-emerald-600 font-semibold' // normal
  return 'text-blue-500 font-semibold'                    // high
}

// ── Pagination ─────────────────────────────────────────
const pages = computed(() => {
  const arr = []
  for (let i = 1; i <= totalPages.value; i++) arr.push(i)
  return arr
})

const goTo = (p) => {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
}

// Reset ke page 1 saat filter berubah
const applyFilter = () => {
  currentPage.value = 1
  fetchHistory()
}

const resetFilter = () => {
  dateFrom.value = ''
  dateTo.value = ''
  currentPage.value = 1
  fetchHistory()
}

watch(currentPage, fetchHistory)
onMounted(fetchHistory)
</script>

<template>
  <DefaultLayout>
    <main class="flex-1">

      <!-- HEADER -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-800">Riwayat Data</h1>
        <p class="text-xs text-gray-400 mt-0.5">Log sensor & aktuator jamur kuping</p>
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
        <button @click="applyFilter"
          class="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition font-medium">
          Filter
        </button>
        <button @click="resetFilter"
          class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg transition font-medium">
          Reset
        </button>
        <!-- tambahkan di filter bar, setelah tombol Reset -->
        <a
          :href="`${VITE_BE_URL}/api/data/export${exportQuery}`"
          target="_blank"
          class="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm rounded-lg transition font-medium
          flex items-center gap-1.5"
          >
          ⬇ Export Excel
        </a>
        <p class="ml-auto text-xs text-gray-400 self-center">
          Total: <span class="font-semibold text-gray-600">{{ total }} data</span>
        </p>
      </div>

      <!-- TABLE -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <div class="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-16 text-sm text-red-500">
          {{ error }}
        </div>

        <!-- Empty -->
        <div v-else-if="rows.length === 0" class="text-center py-16 text-sm text-gray-400">
          Tidak ada data.
        </div>

        <!-- Data -->
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
              <tr v-for="row in rows" :key="row.id" class="hover:bg-emerald-50/40 transition-colors">
                <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {{ formatDate(row.date) }}
                </td>
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
                    {{ row.pump }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.fan)]">
                    {{ row.fan }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusClass(row.humidifier)]">
                    {{ row.humidifier }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PAGINATION -->
      <div v-if="totalPages > 1" class="flex justify-center items-center gap-1 pb-4">
        <button @click="goTo(currentPage - 1)" :disabled="currentPage === 1"
          class="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
          ← Prev
        </button>

        <template v-for="p in pages" :key="p">
          <!-- ellipsis kiri -->
          <span v-if="p === 2 && currentPage > 4" class="px-1 text-gray-400 text-xs">…</span>

          <button v-if="p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)" @click="goTo(p)"
            :class="[
              'px-3 py-1.5 text-xs rounded-lg border transition font-medium',
              p === currentPage
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            ]">
            {{ p }}
          </button>

          <!-- ellipsis kanan -->
          <span v-if="p === totalPages - 1 && currentPage < totalPages - 3" class="px-1 text-gray-400 text-xs">…</span>
        </template>

        <button @click="goTo(currentPage + 1)" :disabled="currentPage === totalPages"
          class="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
          Next →
        </button>
      </div>

    </main>
  </DefaultLayout>
</template>