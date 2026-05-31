<script setup>
defineProps({
  hasPrev:     { type: Boolean, required: true },
  hasNext:     { type: Boolean, required: true },
  limit:       { type: Number,  required: true },
  limitOptions:{ type: Array,   default: () => [15, 30, 50, 100] },
})
const emit = defineEmits(['prev', 'next', 'limitChange'])
</script>

<template>
  <div class="flex justify-between items-center pb-4 px-1">
    <!-- Limit selector -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-400">Tampilkan</span>
      <select
        :value="limit"
        @change="emit('limitChange', parseInt($event.target.value))"
        class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-gray-600"
      >
        <option v-for="opt in limitOptions" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <span class="text-xs text-gray-400">baris</span>
    </div>

    <!-- Prev / Next -->
    <div class="flex items-center gap-2">
      <button
        @click="emit('prev')"
        :disabled="!hasPrev"
        class="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        ← Prev
      </button>
      <button
        @click="emit('next')"
        :disabled="!hasNext"
        class="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Next →
      </button>
    </div>
  </div>
</template>