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
  let pump_state       = "VERYLOW"
  let fan_state        = "VERYLOW"
  let humidifier_state = "VERYLOW"

  if      (soil_state === "high"   && temp_state === "cold"   && hum_state === "high")   { pump_state = "VERYLOW";  fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "high"   && temp_state === "cold"   && hum_state === "normal") { pump_state = "VERYLOW";  fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "high"   && temp_state === "cold"   && hum_state === "low")    { pump_state = "VERYLOW";  fan_state = "VERYLOW"; humidifier_state = "HIGH"    }
  else if (soil_state === "normal" && temp_state === "cold"   && hum_state === "high")   { pump_state = "VERYLOW";  fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "normal" && hum_state === "normal") { pump_state = "VERYLOW";  fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "hot"    && hum_state === "low")    { pump_state = "VERYLOW";  fan_state = "HIGH";    humidifier_state = "HIGH"    }
  else if (soil_state === "low"    && temp_state === "hot"    && hum_state === "low")    { pump_state = "VERYHIGH"; fan_state = "HIGH";    humidifier_state = "VERYHIGH"}
  else if (soil_state === "low"    && temp_state === "cold"   && hum_state === "high")   { pump_state = "HIGH";     fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "low"    && temp_state === "normal" && hum_state === "normal") { pump_state = "HIGH";     fan_state = "VERYLOW"; humidifier_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "hot"    && hum_state === "high")   { pump_state = "VERYLOW";  fan_state = "HIGH";    humidifier_state = "VERYLOW" }

  return { pump: pump_state, fan: fan_state, humidifier: humidifier_state }
}

// ============================================================
// Konversi jam WIB → timestamp UTC yang disimpan ke DB
//
// Rumus eksplisit: UTC = WIB - 7
// Jika hourWib < 7 → pindah ke hari sebelumnya di UTC
// ============================================================

const makeWibDate = (dateStr, hourWib, min, sec) => {
  const pad    = n => String(n).padStart(2, '0')
  const hourUtc = hourWib - 7

  if (hourUtc >= 0) {
    // Jam UTC masih di hari yang sama dengan dateStr
    return new Date(`${dateStr}T${pad(hourUtc)}:${pad(min)}:${pad(sec)}.000Z`)
  } else {
    // Jam UTC pindah ke hari sebelumnya (hourWib 00:00–06:59 WIB)
    const prev = new Date(`${dateStr}T00:00:00.000Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    const prevDateStr = prev.toISOString().slice(0, 10)
    const hourUtcAdj  = hourUtc + 24 // misal -3 → 21
    return new Date(`${prevDateStr}T${pad(hourUtcAdj)}:${pad(min)}:${pad(sec)}.000Z`)
  }
}

// ============================================================
// Generate Data Per Hari
// Interval    : 5 detik → 17280 slot/hari
// startHourWib: jam mulai dalam WIB (default 0 = 00:00 WIB)
// ============================================================

const generateDayRecords = (dateStr, startHourWib = 0) => {
  const records = []

  let spikeCount  = 0
  let spikeActive = false
  let spikeStep   = 0
  let lastSoil    = randInt(1800, 2600)

  const INTERVAL_SECONDS = 5
  const TOTAL_SLOTS      = (24 * 60 * 60) / INTERVAL_SECONDS // 17280
  const START_SLOT       = (startHourWib * 3600) / INTERVAL_SECONDS

  for (let slot = START_SLOT; slot < TOTAL_SLOTS; slot++) {
    const totalSeconds = slot * INTERVAL_SECONDS
    const hourWib      = Math.floor(totalSeconds / 3600)
    const min          = Math.floor((totalSeconds % 3600) / 60)
    const sec          = totalSeconds % 60

    const dt = makeWibDate(dateStr, hourWib, min, sec)

    // Spike window: 13:00–15:00 WIB
    const inWindow = hourWib >= 13 && hourWib < 15

    if (inWindow && !spikeActive && spikeCount < 2) {
      if (Math.random() < 0.30) {
        spikeActive = true
        spikeStep   = 1
        spikeCount++
      }
    }

    // ── Suhu ──────────────────────────────────────────────
    let temperature
    if (spikeActive) {
      if      (spikeStep === 1) temperature = randInt(30, 35)
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
    const soil  = Math.max(1800, Math.min(2600, lastSoil + delta))
    lastSoil    = soil

    const { temp_state, hum_state, soil_state } = mappingState(temperature, humidity, soil)
    const { pump, fan, humidifier }             = fuzzyRule(soil_state, temp_state, hum_state)

    records.push({ date: dt, temperature, humidity, soil, pump, fan, humidifier })
  }

  return records
}

// ============================================================
// Seeder
// ============================================================

const BATCH_SIZE = 1000

const seed = async () => {
  // 5 April 2026 jam 10:00 WIB = 5 April 2026 03:00:00 UTC
  const START_DATE = new Date("2026-04-05T03:00:00.000Z")
  const END_DATE   = new Date()

  // ── Sanity check makeWibDate ───────────────────────────────
  const check = makeWibDate("2026-04-05", 10, 0, 0)
  console.log(`🔍 Sanity check makeWibDate("2026-04-05", 10, 0, 0) → ${check.toISOString()}`)
  console.log(`   Expected : 2026-04-05T03:00:00.000Z`)
  if (check.toISOString() !== "2026-04-05T03:00:00.000Z") {
    throw new Error("makeWibDate salah! Hentikan seeding.")
  }

  console.log("🌱 Mulai seeding data dummy...")
  console.log(`📅 ${START_DATE.toISOString()} → ${END_DATE.toISOString()}`)
  console.log(`   (WIB: 2026-04-05 10:00 WIB → sekarang)`)

  // ── Generate list tanggal ──────────────────────────────────
  const dates  = []
  const cursor = new Date("2026-04-05T00:00:00.000Z")
  while (cursor <= END_DATE) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const SLOTS_PER_DAY = (24 * 60 * 60) / 5
  console.log(`📆 Total hari     : ${dates.length}`)
  console.log(`📦 Estimasi data  : ~${dates.length * SLOTS_PER_DAY} (hari pertama mulai jam 10:00 WIB)`)

  // ── Hapus data lama ────────────────────────────────────────
  console.log("🗑  Menghapus data lama...")
  const delAct  = await prisma.actuatorLog.deleteMany({ where: { date: { gte: START_DATE, lte: END_DATE } } })
  const delData = await prisma.data.deleteMany({ where: { date: { gte: START_DATE, lte: END_DATE } } })
  console.log(`   ActuatorLog deleted : ${delAct.count}`)
  console.log(`   Data deleted        : ${delData.count}`)

  // ── Insert per hari ────────────────────────────────────────
  let totalData = 0
  let totalLogs = 0

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i]

    // Hari pertama (5 April) mulai jam 10:00 WIB, hari lainnya 00:00 WIB
    const startHourWib = i === 0 ? 10 : 0

    const records = generateDayRecords(dateStr, startHourWib)
      .filter(r => r.date >= START_DATE && r.date <= END_DATE)

    for (let j = 0; j < records.length; j += BATCH_SIZE) {
      const batch = records.slice(j, j + BATCH_SIZE)

      // 1. Insert Data batch sekaligus
      await prisma.data.createMany({
        data: batch.map(r => ({
          date:        r.date,
          temperature: r.temperature,
          humidity:    r.humidity,
          soil:        r.soil,
          pump:        r.pump,
          fan:         r.fan,
          humidifier:  r.humidifier,
        }))
      })

      // 2. Ambil id record yang baru diinsert berdasarkan range tanggal batch
      const firstDate = batch[0].date
      const lastDate  = batch[batch.length - 1].date

      const inserted = await prisma.data.findMany({
        where:   { date: { gte: firstDate, lte: lastDate } },
        select:  { id: true, pump: true, fan: true, humidifier: true },
        orderBy: { date: 'asc' },
      })

      // 3. Insert ActuatorLog batch
      const logPayload = inserted.flatMap(d => [
        { type: 'pump',       status: d.pump,       mode: 'Fuzzy', dataId: d.id },
        { type: 'fan',        status: d.fan,        mode: 'Fuzzy', dataId: d.id },
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