<template>
  <div class="bg-white w-full shadow-sm p-4 rounded-2xl">

    <!-- HEADER -->
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm text-gray-500 font-medium">Monitoring Sensor</p>

      <!-- SELECT BUTTON -->
      <div class="flex gap-2 text-xs">
        <button
          @click="active = 'temp'"
          :class="btnClass('temp')"
        >
          Suhu
        </button>

        <button
          @click="active = 'hum'"
          :class="btnClass('hum')"
        >
          Kumbung
        </button>

        <button
          @click="active = 'soil'"
          :class="btnClass('soil')"
        >
          Substrat
        </button>
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
import { ref, computed, onMounted } from "vue"
import axios from "axios"
import { socket } from "@/utils/socket";

const active = ref("temp")

const labels = ref([])

const data = ref({
  temp: [],
  hum: [],
  soil: []
})

const fetchChartData = async () => {
  try {
    const res = await axios.get(
      "http://localhost:5000/api/data/chart-data"
    )

    labels.value = res.data.data.labels
    data.value.temp = res.data.data.temp
    data.value.hum = res.data.data.hum
    data.value.soil = res.data.data.soil

  } catch (err) {
    console.error("Gagal ambil data chart:", err)
  }
}

onMounted(() => {
  fetchChartData()

  socket.on("chart_update", (payload) => {
    labels.value = payload.labels

    data.value.temp = payload.temp
    data.value.hum = payload.hum
    data.value.soil = payload.soil
  })
})

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false }
  },
  xaxis: {
    categories: labels.value
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
  }
}))

const chartSeries = computed(() => {
  if (active.value === "temp") {
    return [
      {
        name: "Suhu Kumbung",
        data: data.value.temp
      }
    ]
  }

  if (active.value === "hum") {
    return [
      {
        name: "Kelembapan Kumbung",
        data: data.value.hum
      }
    ]
  }

  return [
    {
      name: "Kelembapan Substrat",
      data: data.value.soil
    }
  ]
})

const btnClass = (type) => {
  return [
    "px-3 py-1 rounded-full transition",
    active.value === type
      ? "bg-green-500 text-white"
      : "bg-gray-100 text-gray-500"
  ]
}
</script>