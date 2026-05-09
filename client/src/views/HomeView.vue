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
  humidity:    0,
  soil:        0,
  pump:        'VERYLOW',
  fan:         'VERYLOW',
  humidifier:  'VERYLOW',
})

const monitoringHandler = (payload) => {
  data.temperature = payload.temperature
  data.humidity    = payload.humidity
  data.soil        = payload.soil
}

onMounted(async () => {
  try {
    const [sensorRes, actuatorRes] = await Promise.all([
      axios.get(`${import.meta.env.VITE_BE_URL}/data/last-data`),
      axios.get(`${import.meta.env.VITE_BE_URL}/data/actuator/status`),
    ])

    const { temperature, humidity, soil } = sensorRes.data.data
    data.temperature = temperature
    data.humidity    = humidity
    data.soil        = soil

    const { pump, fan, humidifier } = actuatorRes.data.data
    data.pump       = pump?.status       ?? 'VERYLOW'
    data.fan        = fan?.status        ?? 'VERYLOW'
    data.humidifier = humidifier?.status ?? 'VERYLOW'
  } catch (err) {
    console.error('Gagal ambil data awal:', err)
  }

  socket.on("monitoring", monitoringHandler)
})

onUnmounted(() => {
  socket.off("monitoring", monitoringHandler)
})
</script>

<template>
  <DefaultLayout>
    <main class="flex-1">
      <div class="mb-4">
        <h1 class="text-xl font-bold">Dashboard</h1>
        <p class="text-xs text-gray-400">Monitoring hari ini</p>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-4">
        <BaseCard dataName="Suhu Kumbung"         :value="data.temperature" colorValue="#22c55e" />
        <BaseCard dataName="Kelembapan Kumbung"   :value="data.humidity"    colorValue="#22c55e" />
        <BaseCard dataName="Kelembapan Substrat"  :value="data.soil"        colorValue="#22c55e" />
      </div>

      <div class="grid grid-cols-3 gap-4 mb-4">
        <BaseToggle type="fan"        label="Fan"        v-model:value="data.fan"        />
        <BaseToggle type="humidifier" label="Humidifier" v-model:value="data.humidifier" />
        <BaseToggle type="pump"       label="Pump"       v-model:value="data.pump"       />
      </div>

      <BaseChart />
    </main>
  </DefaultLayout>
</template>