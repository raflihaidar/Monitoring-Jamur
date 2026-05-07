<script setup>
import BaseCard from '@/components/BaseCard.vue'
import BaseToggle from '@/components/BaseToggle.vue'
import BaseChart from '@/components/BaseChart.vue'
import { socket } from "@/utils/socket"
import { onMounted, onUnmounted, reactive } from 'vue'
import DefaultLayout from '../layouts/Default.vue'
import axios from 'axios'

const data = reactive({
  temperature: 0,
  humidity: 0,
  soil: 0,
  pump: 'OFF',
  fan: 'OFF',
  humidifier: 'OFF'
})

const monitoringHandler = (payload) => {
  data.temperature = payload.temperature
  data.humidity = payload.humidity
  data.soil = payload.soil
}

onMounted(async () => {
  try {
    const response = await axios.get(`${import.meta.env.VITE_BE_URL}/api/data/last-data`)
    const { temperature, humidity, soil, fan, pump, humidifier } = response.data.data
    data.temperature = temperature
    data.humidity = humidity
    data.soil = soil
    data.fan = fan
    data.pump = pump
    data.humidifier = humidifier
  } catch (err) {
    console.error('Gagal ambil last-data:', err)
  }

  socket.on("monitoring", monitoringHandler)
})

onUnmounted(() => {
  socket.off("monitoring", monitoringHandler)
})
</script>

<template>
  <DefaultLayout>
    <!-- CONTENT -->
    <main class="flex-1">
      <!-- TITLE -->
      <div class="mb-4">
        <h1 class="text-xl font-bold">Dashboard</h1>
        <p class="text-xs text-gray-400">Monitoring hari ini</p>
      </div>

      <!-- CARD -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <BaseCard dataName="Suhu Kumbung" :value="data.temperature" colorValue="#22c55e" />
        <BaseCard dataName="Kelembapan Kumbung" :value="data.humidity" colorValue="#22c55e" />
        <BaseCard dataName="Kelembapan Substrat" :value="data.soil" colorValue="#22c55e" />
      </div>

      <!-- TOGGLE -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <BaseToggle label="Fan" v-model:value="data.fan" />
        <BaseToggle label="Humidifier" v-model:value="data.humidifier" />
        <BaseToggle label="Pump" v-model:value="data.pump" />
      </div>

      <BaseChart />
    </main>
  </DefaultLayout>
</template>