import { prisma } from "../../config/prisma.js"

// ============================================================
// Helpers
// ============================================================

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const mappingState = (temperature, humidity, soil) => {

  const temp_state =
    temperature < 22
      ? "cold"
      : temperature <= 25
      ? "normal"
      : "hot"

  const hum_state =
    humidity < 80
      ? "low"
      : humidity <= 90
      ? "normal"
      : "high"

  // soil tinggi = makin kering
  const soil_state =
    soil > 2600
      ? "low"
      : soil > 1800
      ? "normal"
      : "high"

  return {
    temp_state,
    hum_state,
    soil_state,
  }
}

const resolveActuators = (
  temp_state,
  hum_state,
  soil_state
) => ({
  pump: soil_state === "low" ? "ON" : "OFF",
  fan: temp_state === "hot" ? "ON" : "OFF",
  humidifier: hum_state === "low" ? "ON" : "OFF",
})

// ============================================================
// Generate Data Per Hari
// ============================================================

const generateDayRecords = (dateStr) => {

  const records = []

  // ==========================================================
  // Spike state
  // ==========================================================

  let spikeCount = 0
  let spikeActive = false
  let spikeStep = 0

  // ==========================================================
  // Soil smooth state
  // ==========================================================

  let lastSoil = randInt(1800, 2600)

  const INTERVAL_MINUTES = 5
  const TOTAL_SLOTS = (24 * 60) / INTERVAL_MINUTES

  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {

    const totalMinutes = slot * INTERVAL_MINUTES

    const hour = Math.floor(totalMinutes / 60)
    const min = totalMinutes % 60

    // ========================================================
    // Datetime UTC
    // ========================================================

    const dt = new Date(`${dateStr}T00:00:00.000Z`)

    dt.setUTCHours(
      hour,
      min,
      randInt(0, 59),
      0
    )

    // ========================================================
    // Window spike
    // WIB 13:00-15:00
    // UTC 06:00-08:00
    // ========================================================

    const utcHour = hour

    const inWindow =
      utcHour === 6 ||
      utcHour === 7 ||
      (utcHour === 8 && min === 0)

    // ========================================================
    // Trigger spike
    // ========================================================

    if (
      inWindow &&
      !spikeActive &&
      spikeCount < 2
    ) {

      if (Math.random() < 0.30) {

        spikeActive = true
        spikeStep = 1
        spikeCount++
      }
    }

    // ========================================================
    // Temperature
    // ========================================================

    let temperature

    if (spikeActive) {

      if (spikeStep === 1) {

        // SPIKE
        temperature = randInt(30, 35)

      } else if (spikeStep === 2) {

        // TURUN
        temperature = randInt(27, 29)

      } else {

        // NORMAL KEMBALI
        spikeActive = false
        spikeStep = 0

        temperature = randInt(22, 25)
      }

      spikeStep++

    } else {

      // NORMAL
      temperature = randInt(22, 25)
    }

    // ========================================================
    // Humidity
    // ========================================================

    const humidity = randInt(80, 90)

    // ========================================================
    // Soil smooth/random realistis
    // Selisih antar data max ±80
    // ========================================================

    const delta = randInt(-80, 80)

    let soil = lastSoil + delta

    soil = Math.max(
      1800,
      Math.min(2600, soil)
    )

    lastSoil = soil

    // ========================================================
    // State + actuator
    // ========================================================

    const {
      temp_state,
      hum_state,
      soil_state,
    } = mappingState(
      temperature,
      humidity,
      soil
    )

    const {
      pump,
      fan,
      humidifier,
    } = resolveActuators(
      temp_state,
      hum_state,
      soil_state
    )

    records.push({
      date: dt,
      temperature,
      humidity,
      soil,
      pump,
      fan,
      humidifier,
    })
  }

  return records
}

// ============================================================
// Seeder
// ============================================================

const seed = async () => {

  const START_DATE = new Date("2026-04-05T00:00:00.000Z")
  const END_DATE = new Date()

  console.log("🌱 Mulai seeding data dummy...")
  console.log(`📅 ${START_DATE.toISOString()} -> ${END_DATE.toISOString()}`)

  // ==========================================================
  // Generate list tanggal
  // ==========================================================

  const dates = []

  const cursor = new Date(START_DATE)

  while (cursor <= END_DATE) {

    dates.push(
      cursor.toISOString().slice(0, 10)
    )

    cursor.setUTCDate(
      cursor.getUTCDate() + 1
    )
  }

  console.log(`📆 Total hari : ${dates.length}`)
  console.log(`📦 Estimasi data : ${dates.length * 288}`)

  // ==========================================================
  // Delete old data
  // ==========================================================

  const deleted = await prisma.data.deleteMany({
    where: {
      date: {
        gte: START_DATE,
        lte: END_DATE,
      },
    },
  })

  console.log(`🗑 Deleted : ${deleted.count}`)

  // ==========================================================
  // Insert
  // ==========================================================

  let totalInserted = 0

  for (const dateStr of dates) {

    const records = generateDayRecords(dateStr)

    // hari terakhir belum tentu penuh
    const filtered = records.filter(
      (r) => r.date <= END_DATE
    )

    await prisma.data.createMany({
      data: filtered,
    })

    totalInserted += filtered.length

    process.stdout.write(
      `\r✅ ${dateStr} -> ${filtered.length} | total ${totalInserted}`
    )
  }

  console.log("\n")
  console.log("🎉 Seeding selesai!")
  console.log(`📦 Total inserted : ${totalInserted}`)

  // ==========================================================
  // Statistik
  // ==========================================================

  const stats = await prisma.$queryRaw`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(temperature), 1) AS avg_temp,
      MIN(temperature) AS min_temp,
      MAX(temperature) AS max_temp,
      SUM(
        CASE
          WHEN temperature > 25
          THEN 1
          ELSE 0
        END
      ) AS spike_count
    FROM \`data\`
    WHERE date >= ${START_DATE}
    AND date <= ${END_DATE}
  `

  const s = stats[0]

  console.log("\n📊 Statistik:")
  console.log(`Total       : ${s.total}`)
  console.log(`Avg Temp    : ${s.avg_temp}°C`)
  console.log(`Min Temp    : ${s.min_temp}°C`)
  console.log(`Max Temp    : ${s.max_temp}°C`)
  console.log(`Spike Count : ${s.spike_count}`)
}

// ============================================================

seed()
  .catch((e) => {
    console.error("❌ Seeder error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })