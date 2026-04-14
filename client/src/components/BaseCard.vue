<script setup>
import WarningIcon from '@/components/icons/WarningIcon.vue'
import SuccessIcon from '@/components/icons/SuccessIcon.vue'

defineProps({
  dataName: String,
  value: {
    type: Number,
    default: 0,
  },
  colorValue: {
    type: String,
    default: '#000',
  },
  icon: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <section
    class="bg-white w-full h-[80px] flex flex-col justify-center items-center shadow-sm rounded-2xl"
  >
    <h3 class="text-lg font-semibold" :style="{ color: colorValue }">
      {{ value }}
    </h3>

    <component
      v-if="icon"
      :is="(value >= 5 && value <= 7) || value === 7 ? SuccessIcon : WarningIcon"
      class="my-1"
    />

    <p class="text-xs text-gray-400">{{ dataName }}</p>
  </section>
</template>