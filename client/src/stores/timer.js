import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useTimerStore = defineStore('timer', () => {
  const BaseURL = 'http://localhost:5000/api'
  const timerDuration = ref(30) // Durasi awal timer dalam detik (30 detik)
  const idleDuration = ref(10 * 60) // Durasi diam (10 menit) dalam detik
  const pumpIdleDuration = ref(10) // Durasi pompa diam setelah 30 detik (misalnya 10 detik)
  const currentTime = ref(timerDuration.value) // Waktu yang sedang berjalan
  const isIdle = ref(false) // Menyimpan status apakah sedang diam
  const isPumpIdle = ref(false) // Menyimpan status apakah pompa dalam keadaan diam
  let timerInterval = null
  let idleTimerInterval = null
  let pumpIdleTimerInterval = null // Timer untuk waktu diam pompa

  // Fungsi untuk memulai timer
  const startTimer = () => {
    if (timerInterval || isIdle.value) return // Jangan mulai timer jika sudah ada yang berjalan atau sedang diam

    timerInterval = setInterval(() => {
      if (currentTime.value > 0) {
        currentTime.value -= 1
      } else {
        stopTimer() // Menghentikan timer jika waktu habis
        startPumpIdleTimer() // Mulai timer pompa diam setelah waktu habis
      }
    }, 1000)
  }

  // Fungsi untuk menghentikan timer
  const stopTimer = () => {
    clearInterval(timerInterval)
    timerInterval = null
  }

  // Fungsi untuk mereset timer
  const resetTimer = () => {
    currentTime.value = timerDuration.value
    stopTimer() // Hentikan timer sebelum mereset
    if (isIdle.value) {
      stopIdleTimer() // Hentikan timer diam jika timer sedang dalam kondisi diam
    }
    if (isPumpIdle.value) {
      stopPumpIdleTimer() // Hentikan timer pompa diam jika sedang berjalan
    }
  }

  // Fungsi untuk memulai timer diam (10 menit)
  const startIdleTimer = () => {
    isIdle.value = true
    idleTimerInterval = setInterval(() => {
      if (idleDuration.value > 0) {
        idleDuration.value -= 1
      } else {
        stopIdleTimer() // Menghentikan timer diam setelah waktu selesai
        resetTimer() // Mulai ulang timer setelah diam
      }
    }, 1000)
  }

  // Fungsi untuk menghentikan timer diam
  const stopIdleTimer = () => {
    clearInterval(idleTimerInterval)
    idleTimerInterval = null
    isIdle.value = false
  }

  // Fungsi untuk memulai timer diam pompa
  const startPumpIdleTimer = () => {
    isPumpIdle.value = true
    pumpIdleTimerInterval = setInterval(() => {
      if (pumpIdleDuration.value > 0) {
        pumpIdleDuration.value -= 1
      } else {
        stopPumpIdleTimer() // Menghentikan timer pompa diam setelah waktu selesai
        resetTimer() // Mulai ulang timer setelah pompa diam
      }
    }, 1000)
  }

  // Fungsi untuk menghentikan timer diam pompa
  const stopPumpIdleTimer = () => {
    clearInterval(pumpIdleTimerInterval)
    pumpIdleTimerInterval = null
    isPumpIdle.value = false
  }

  // Fungsi untuk menampilkan waktu dalam format menit:detik
  const formattedTime = computed(() => {
    const minutes = Math.floor(currentTime.value / 60)
    const seconds = currentTime.value % 60
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  })

  // Fungsi untuk menangani status pompa
  const handlePump = async (state) => {
    try {
      const response = await axios.post(`${BaseURL}/relay`, { state })
      console.log(response.data.message)

      if (state === 'ON') {
        startPumpTime() // Mulai menghitung waktu ketika pompa diaktifkan
      } else {
        stopPumpTime() // Hentikan penghitungan waktu ketika pompa dimatikan
      }
    } catch (err) {
      console.log(err)
    }
  }

  // Fungsi untuk memulai waktu pompa
  const startPumpTime = () => {
    resetTimer() // Reset timer sebelum memulai
    startTimer() // Mulai timer
  }

  // Fungsi untuk menghentikan waktu pompa
  const stopPumpTime = () => {
    stopTimer() // Hentikan timer saat pompa dimatikan
  }

  return {
    timerDuration,
    currentTime,
    startTimer,
    stopTimer,
    resetTimer,
    formattedTime,
    isIdle,
    handlePump, // Menambahkan fungsi handlePump ke store
    isPumpIdle, // Status pompa diam
  }
})
