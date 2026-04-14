<script setup>
import { ref, watch } from 'vue'
import { useTimerStore } from '../stores/timer'

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
    default: 'OFF',
  },
})

const emit = defineEmits(["update:value"])

const timerStore = useTimerStore()

const isClick = ref(props.value === 'OFF' ? false : true)

watch(
  () => props.value,
  (newVal) => {
    isClick.value = newVal === 'OFF' ? false : true

    console.log("is click : ", isClick.value)
  }
)

const toggle = async () => {
  isClick.value = !isClick.value

  const state = isClick.value ? "ON" : "OFF"

  emit("update:value", isClick.value)

  await timerStore.handlePump(state)
}
</script>

<template>
  <section class="bg-white rounded-2xl shadow-sm p-4 text-center">

    <div
      class="w-[60%] h-8 mx-auto relative flex items-center p-1 rounded-full cursor-pointer transition"
      :class="isClick ? 'bg-green-400' : 'bg-gray-200'"
      @click="toggle"
    >
      <div
        class="w-6 h-6 bg-white rounded-full absolute top-1/2 -translate-y-1/2 transition-all"
        :class="isClick ? 'right-1' : 'left-1'"
      ></div>
    </div>

    <p class="text-xs text-gray-400 mt-2">
      {{ label }}
    </p>

  </section>
</template>