<template>
  <main class="flex items-center justify-center w-full h-screen">
    <section class="w-[90vw]">
      <form @submit.prevent="updatePH" class="max-w-sm mx-auto">
        <label for="ph-input" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Enter pH Value:
        </label>
        <input
          v-model="phValue"
          type="number"
          id="ph-input"
          aria-describedby="helper-text-explanation"
          class="bg-black text-black border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Enter pH value"
          required
        />
        <button
          type="submit"
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Update pH
        </button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const phValue = ref('') // Reactive variable for the input value

const updatePH = async () => {
  if (phValue.value) {
    try {
      const response = await fetch('http://localhost:5000/publish/ph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ph: parseFloat(phValue.value) }),
      })

      const data = await response.json()
      alert(data.message) // Show success message
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to update pH value')
    }
  } else {
    alert('Please enter a valid pH value')
  }
}
</script>
