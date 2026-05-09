import { prisma } from "../../config/prisma.js"

// ============================================================
// Helpers
// ============================================================

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const mappingState = (temperature, humidity, soil) => {
  const temp_state =
    temperature < 22 ? "cold" : temperature <= 25 ? "normal" : "hot"

  const hum_state =
    humidity < 80 ? "low" : humidity <= 90 ? "normal" : "high"

  const soil_state =
    soil > 2600 ? "low" : soil > 1800 ? "normal" : "high"

  return { temp_state, hum_state, soil_state }
}

// ============================================================
// Fuzzy Rule
// ============================================================

const fuzzyRule = (soil_state, temp_state, hum_state) => {
  let pump_state = "VERYLOW"
  let fan_state = "VERYLOW"
  let humidifier_state = "VERYLOW"

  if (soil_state === "high" && temp_state === "cold" && hum_state === "high") { pump_state = "VERYLOW"; fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "high" && temp_state === "cold" && hum_state === "normal") { pump_state = "VERYLOW"; fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "high" && temp_state === "cold" && hum_state === "low") { pump_state = "VERYLOW"; fan_state = "VERYLOW"; humidifier_state = "HIGH" }
  else if (soil_state === "normal" && temp_state === "cold" && hum_state === "high") { pump_state = "VERYLOW"; fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "normal" && hum_state === "normal") { pump_state = "VERYLOW"; fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "hot" && hum_state === "low") { pump_state = "VERYLOW"; fan_state = "HIGH"; humidifier_state = "HIGH" }
  else if (soil_state === "low" && temp_state === "hot" && hum_state === "low") { pump_state = "VERYHIGH"; fan_state = "HIGH"; humidifier_state = "VERYHIGH" }
  else if (soil_state === "low" && temp_state === "cold" && hum_state === "high") { pump_state = "HIGH"; fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "low" && temp_state === "normal" && hum_state === "normal") { pump_state = "HIGH"; fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "hot" && hum_state === "high") { pump_state = "VERYLOW"; fan_state = "HIGH"; humidifier_state = "VERYLOW" }

  return { pump: pump_state, fan: fan_state, humidifier: humidifier_state }
}

// ============================================================
// Generate Data Per Hari
// Interval : 5 detik → 17280 slot/hari
// ============================================================

const generateDayRecords = (dateStr) => {
  const records = []

  let spikeCount = 0
  let spikeActive = false
  let spikeStep = 0
  let lastSoil = randInt(1800, 2600)

  const INTERVAL_SECONDS = 5
  const TOTAL_SLOTS = (24 * 60 * 60) / INTERVAL_SECONDS // 17280

  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
    const totalSeconds = slot * INTERVAL_SECONDS
    const hour = Math.floor(totalSeconds / 3600)
    const min = Math.floor((totalSeconds % 3600) / 60)
    const sec = totalSeconds % 60

    const dt = new Date(`${dateStr}T00:00:00.000Z`)
    dt.setUTCHours(hour, min, sec, 0)

    // WIB 13:00–15:00 → UTC 06:00–08:00
    const inWindow =
      hour === 6 ||
      hour === 7 ||
      (hour === 8 && min === 0 && sec === 0)

    if (inWindow && !spikeActive && spikeCount < 2) {
      if (Math.random() < 0.30) {
        spikeActive = true
        spikeStep = 1
        spikeCount++
      }
    }

    // ── Suhu ──────────────────────────────────────────────
    let temperature
    if (spikeActive) {
      if (spikeStep === 1) temperature = randInt(30, 35)
      else if (spikeStep === 2) temperature = randInt(27, 29)
      else { spikeActive = false; spikeStep = 0; temperature = randInt(22, 25) }
      spikeStep++
    } else {
      temperature = randInt(22, 25)
    }

    // ── Humidity: turun saat spike (60-79%), normal 80-84% ──
    const humidity = spikeActive ? randInt(60, 79) : randInt(80, 84)

    // ── Soil smooth ────────────────────────────────────────
    const delta = randInt(-80, 80)
    const soil = Math.max(1800, Math.min(2600, lastSoil + delta))
    lastSoil = soil

    const { temp_state, hum_state, soil_state } = mappingState(temperature, humidity, soil)
    const { pump, fan, humidifier } = fuzzyRule(soil_state, temp_state, hum_state)

    records.push({ date: dt, temperature, humidity, soil, pump, fan, humidifier })
  }

  return records
}

// ============================================================
// Seeder
// ============================================================

const BATCH_SIZE = 500

const seed = async () => {
  const START_DATE = new Date("2026-04-05T00:00:00.000Z")
  const END_DATE = new Date()

  console.log("🌱 Mulai seeding data dummy...")
  console.log(`📅 ${START_DATE.toISOString()} → ${END_DATE.toISOString()}`)

  // ── Generate list tanggal ──────────────────────────────────
  const dates = []
  const cursor = new Date(START_DATE)
  while (cursor <= END_DATE) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const SLOTS_PER_DAY = (24 * 60 * 60) / 5 // 17280
  console.log(`📆 Total hari     : ${dates.length}`)
  console.log(`📦 Estimasi data  : ${dates.length * SLOTS_PER_DAY}`)

  // ── Hapus data lama ────────────────────────────────────────
  console.log("🗑  Menghapus data lama...")
  const delAct = await prisma.actuatorLog.deleteMany({ where: { date: { gte: START_DATE, lte: END_DATE } } })
  const delData = await prisma.data.deleteMany({ where: { date: { gte: START_DATE, lte: END_DATE } } })
  console.log(`   ActuatorLog deleted : ${delAct.count}`)
  console.log(`   Data deleted        : ${delData.count}`)

  // ── Insert per hari ────────────────────────────────────────
  let totalData = 0
  let totalLogs = 0

  for (const dateStr of dates) {
    const records = generateDayRecords(dateStr).filter(r => r.date <= END_DATE)

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)

      const inserted = await prisma.$transaction(
        batch.map(r =>
          prisma.data.create({
            data: {
              date: r.date,
              temperature: r.temperature,
              humidity: r.humidity,
              soil: r.soil,
              pump: r.pump,
              fan: r.fan,
              humidifier: r.humidifier,
            },
            select: { id: true, pump: true, fan: true, humidifier: true }
          })
        )
      )

      const logPayload = inserted.flatMap(d => [
        { type: 'pump', status: d.pump, mode: 'Fuzzy', dataId: d.id },
        { type: 'fan', status: d.fan, mode: 'Fuzzy', dataId: d.id },
        { type: 'humidifier', status: d.humidifier, mode: 'Fuzzy', dataId: d.id },
      ])

      await prisma.actuatorLog.createMany({ data: logPayload })

      totalData += inserted.length
      totalLogs += logPayload.length
    }

    process.stdout.write(
      `\r✅ ${dateStr} | data: ${totalData} | logs: ${totalLogs}`
    )
  }

  console.log("\n")
  console.log("🎉 Seeding selesai!")
  console.log(`📦 Total Data inserted        : ${totalData}`)
  console.log(`📋 Total ActuatorLog inserted : ${totalLogs}`)

  // ── Statistik ──────────────────────────────────────────────
  const stats = await prisma.$queryRaw`
    SELECT
      COUNT(*)                                           AS total,
      ROUND(AVG(temperature), 1)                         AS avg_temp,
      MIN(temperature)                                   AS min_temp,
      MAX(temperature)                                   AS max_temp,
      SUM(CASE WHEN temperature > 25 THEN 1 ELSE 0 END)  AS spike_count,
      ROUND(AVG(humidity), 1)                            AS avg_hum,
      SUM(CASE WHEN humidity < 80 THEN 1 ELSE 0 END)     AS low_hum_count
    FROM \`data\`
    WHERE date >= ${START_DATE}
    AND   date <= ${END_DATE}
  `

  const logStats = await prisma.$queryRaw`
    SELECT mode, COUNT(*) AS total
    FROM actuator_log
    WHERE date >= ${START_DATE}
    AND   date <= ${END_DATE}
    GROUP BY mode
  `

  const s = stats[0]
  console.log("\n📊 Statistik sensor:")
  console.log(`   Total         : ${s.total}`)
  console.log(`   Avg Temp      : ${s.avg_temp}°C`)
  console.log(`   Min/Max Temp  : ${s.min_temp}°C / ${s.max_temp}°C`)
  console.log(`   Spike Count   : ${s.spike_count}`)
  console.log(`   Avg Humidity  : ${s.avg_hum}%`)
  console.log(`   Low Hum Count : ${s.low_hum_count} (saat spike)`)

  console.log("\n📋 Statistik actuator log per mode:")
  logStats.forEach(r => console.log(`   ${r.mode.padEnd(8)}: ${r.total}`))
}

// ============================================================

seed()
  .catch(e => { console.error("❌ Seeder error:", e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })