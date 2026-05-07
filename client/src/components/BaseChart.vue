<template>
  <div class="bg-white w-full shadow-sm p-4 rounded-2xl">
    <!-- HEADER -->
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm text-gray-500 font-medium">Monitoring Sensor</p>
      <!-- SELECT BUTTON -->
      <div class="flex gap-2 text-xs">
        <button @click="active = 'temp'" :class="btnClass('temp')">Suhu</button>
        <button @click="active = 'hum'" :class="btnClass('hum')">Kumbung</button>
        <button @click="active = 'soil'" :class="btnClass('soil')">Substrat</button>
      </div>
    </div>

    <!-- CHART -->
    <apexchart
      width="100%"
      height="300"
      type="line"
      :options="chartOptions"
      :series="chartSeries"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue"
import axios from "axios"
import { socket } from "@/utils/socket"

const active = ref("temp")
const labels = ref([])
const chartData = ref({
  temp: [],
  hum: [],
  soil: []
})

// ✅ Fetch data awal dari API
const fetchChartData = async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_BE_URL}/data/chart-data`)
    labels.value = res.data.data.labels
    chartData.value.temp = res.data.data.temp
    chartData.value.hum = res.data.data.hum
    chartData.value.soil = res.data.data.soil
  } catch (err) {
    console.error("Gagal ambil data chart:", err)
  }
}

// ✅ Named handler untuk chart_update
const chartUpdateHandler = (payload) => {
  labels.value = payload.labels
  chartData.value.temp = payload.temp
  chartData.value.hum = payload.hum
  chartData.value.soil = payload.soil
}

onMounted(() => {
  fetchChartData()
  socket.on("chart_update", chartUpdateHandler)
})

onUnmounted(() => {
  // ✅ Bersihkan listener saat komponen di-destroy
  socket.off("chart_update", chartUpdateHandler)
})

// ✅ chartOptions sebagai computed — reaktif terhadap perubahan labels.value
const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 400,
    }
  },
  stroke: {
    curve: "smooth",
    width: 2
  },
  dataLabels: {
    enabled: false
  },
  grid: {
    borderColor: "#f1f1f1"
  },
  xaxis: {
    categories: labels.value  // ✅ reaktif karena di dalam computed
  }
}))

// ✅ chartSeries tetap computed seperti sebelumnya
const chartSeries = computed(() => {
  if (active.value === "temp") {
    return [{ name: "Suhu Kumbung", data: chartData.value.temp }]
  }
  if (active.value === "hum") {
    return [{ name: "Kelembapan Kumbung", data: chartData.value.hum }]
  }
  return [{ name: "Kelembapan Substrat", data: chartData.value.soil }]
})

const btnClass = (type) => [
  "px-3 py-1 rounded-full transition",
  active.value === type ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"
]
</script>