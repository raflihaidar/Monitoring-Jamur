<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { socket } from "@/utils/socket"
import axios from "axios"

const VITE_BE_URL = import.meta.env.VITE_BE_URL


const props = defineProps({
  width: {
    type: String,
    default: '100%',
  },
  label: {
    type: String,
    default: 'Pump',
  },
  value: {
    type: String,
    default: 'VERYLOW',
  },
  type: {
    type: String,
    default: 'pump', // "pump" | "fan" | "humidifier"
  },
})

const emit = defineEmits(["update:value"])

const isOn  = (val) => val === 'HIGH' || val === 'VERYHIGH'
const isClick  = ref(isOn(props.value))
const isLoading = ref(false)

watch(
  () => props.value,
  (newVal) => {
    isClick.value = isOn(newVal)
  }
)

const toggle = async () => {
  if (isLoading.value) return

  const nextStatus = isClick.value ? 'VERYLOW' : 'HIGH'

  try {
    isLoading.value = true
    await axios.post(`${VITE_BE_URL}/data/actuator/control`, {
      type:   props.type,
      status: nextStatus,
    })

    isClick.value = !isClick.value
    emit("update:value", nextStatus)
  } catch (err) {
    console.error(`[ActuatorToggle] Gagal mengontrol ${props.type}:`, err)
  } finally {
    isLoading.value = false
  }
}

// ── Socket ──────────────────────────────────────────────────
const handleActuatorControl = (data) => {
  if (data.type !== props.type) return
  isClick.value = isOn(data.status)
}

onMounted(() => {
  socket.on("actuator_control", handleActuatorControl)
})

onUnmounted(() => {
  socket.off("actuator_control", handleActuatorControl)
})
</script>

<template>
  <section class="bg-white rounded-2xl shadow-sm p-4 text-center">
    <div
      class="w-[60%] h-8 mx-auto relative flex items-center p-1 rounded-full transition"
      :class="[
        isClick ? 'bg-green-400' : 'bg-gray-200',
        isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ]"
      @click="toggle"
    >
      <div
        class="w-6 h-6 bg-white rounded-full absolute top-1/2 -translate-y-1/2 transition-all"
        :class="isClick ? 'right-1' : 'left-1'"
      ></div>
    </div>
    <p class="text-xs text-gray-400 mt-2">{{ label }}</p>
  </section>
</template>