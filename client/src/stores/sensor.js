import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useSensorStore = defineStore(
  'sensor',
  () => {
    // const ws = new WebSocket(process.env.WS_URL)
    const pH = ref(7)
    const pHHistory = ref([]) // Array untuk menyimpan data pH

    // Fungsi untuk menentukan warna berdasarkan nilai pH
    const pHColor = computed(() => {
      if (pH.value <= 3) return '#FF0000' // Merah (terlalu asam)
      if (pH.value <= 4) return '#DC143C' // Merah Muda (terlalu asam)
      if (pH.value < 5) return '#FFBF00' // Kuning (sedikit asam)
      if (pH.value >= 5 && pH.value <= 7) return '#008000' // Hijau Muda (optimal)
      if (pH.value === 7) return '#50C878' // Hijau (Netral)
      if (pH.value <= 14) return '#0047AB' // Biru (terlalu basa)
      return '#000' // Default untuk nilai tak terduga
    })

    const setPH = (data) => {
      pH.value = data

      // Tambahkan nilai pH ke dalam array history
      pHHistory.value.push({
        time: new Date().toLocaleTimeString(), // Waktu dalam format jam:menit:detik
        value: data,
      })

      // Batasi panjang history (misalnya hanya simpan 20 data terakhir)
      if (pHHistory.value.length > 10) {
        pHHistory.value.shift()
      }
    }

    return { pH, pHHistory, pHColor, setPH }
  },
  {
    persist: true,
  },
)
