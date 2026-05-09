<script setup>
defineProps({
  pages:   { type: Array,  required: true },
  current: { type: Number, required: true },
  total:   { type: Number, required: true },
})
const emit = defineEmits(['go'])
</script>

<template>
  <div v-if="total > 1" class="flex justify-center items-center gap-1 pb-4">
    <button @click="emit('go', current - 1)" :disabled="current === 1"
      class="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
      ← Prev
    </button>

    <template v-for="p in pages" :key="p">
      <span v-if="p === 2 && current > 4" class="px-1 text-gray-400 text-xs">…</span>
      <button
        v-if="p === 1 || p === total || (p >= current - 2 && p <= current + 2)"
        @click="emit('go', p)"
        :class="[
          'px-3 py-1.5 text-xs rounded-lg border transition font-medium',
          p === current
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        ]">
        {{ p }}
      </button>
      <span v-if="p === total - 1 && current < total - 3" class="px-1 text-gray-400 text-xs">…</span>
    </template>

    <button @click="emit('go', current + 1)" :disabled="current === total"
      class="px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
      Next →
    </button>
  </div>
</template>