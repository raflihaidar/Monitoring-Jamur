import { prisma } from "../../config/prisma.js"
import { createReadStream } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import ExcelJS from "exceljs"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ============================================================
// Helpers
// ============================================================

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const mappingState = (temperature, humidity, soil) => {
  const temp_state = temperature < 22 ? "cold" : temperature <= 25 ? "normal" : "hot"
  const hum_state  = humidity  < 80   ? "low"  : humidity  <= 90   ? "normal" : "high"
  const soil_state = soil      > 2600  ? "low"  : soil      > 1800   ? "normal" : "high"
  return { temp_state, hum_state, soil_state }
}

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
// Parse tanggal dari format Excel: "30 Apr 2026, 23.59.55" → Date UTC
// Data di DB disimpan UTC, display WIB. Kolom waktu di Excel = WIB.
// UTC = WIB - 7 jam
// ============================================================

const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2,  Apr: 3,  Mei: 4,  Jun: 5,
  Jul: 6, Agu: 7, Sep: 8,  Okt: 9,  Nov: 10, Des: 11,
  // fallback English
  May: 4, Aug: 7, Oct: 9,  Dec: 11,
}

const parseExcelDate = (str) => {
  // Format: "30 Apr 2026, 23.59.55"
  const [datePart, timePart] = str.split(", ")
  const [day, monthStr, year] = datePart.split(" ")
  const [hh, mm, ss] = timePart.split(".")

  const month = MONTH_MAP[monthStr]
  if (month === undefined) throw new Error(`Unknown month: ${monthStr}`)

  // Buat sebagai WIB lalu konversi ke UTC (−7 jam)
  const wibMs = Date.UTC(+year, month, +day, +hh, +mm, +ss)
  return new Date(wibMs - 7 * 60 * 60 * 1000)
}

// ============================================================
// Deteksi mode dari data Excel
// Aturan: pump HIGH pada jam 07:00:00 WIB → Timer
//         lainnya → deteksi dari fuzzy rule
// ============================================================

const detectMode = (row, recordedAt) => {
  const hourWib = (recordedAt.getUTCHours() + 7) % 24
  const minVal  = recordedAt.getUTCMinutes()
  const secVal  = recordedAt.getUTCSeconds()

  // Timer: jam 07:00:00 dan 07:00:05 WIB (10 detik = 2 slot × 5 detik)
  const isTimerSlot = hourWib === 7 && minVal === 0 && (secVal === 0 || secVal === 5)
  if (isTimerSlot) return 'Timer'

  // Cek apakah hasil cocok dengan fuzzy — kalau tidak cocok berarti Manual
  const { temp_state, hum_state, soil_state } = mappingState(row.temperature, row.humidity, row.soil)
  const fuzzy = fuzzyRule(soil_state, temp_state, hum_state)

  const matchesFuzzy =
    fuzzy.pump       === row.pump &&
    fuzzy.fan        === row.fan  &&
    fuzzy.humidifier === row.humidifier

  return matchesFuzzy ? 'Fuzzy' : 'Manual'
}

// ============================================================
// Konversi jam WIB → UTC untuk generate data baru (1 Mei – sekarang)
// ============================================================

const makeWibDate = (dateStr, hourWib, min, sec) => {
  const pad     = n => String(n).padStart(2, '0')
  const hourUtc = hourWib - 7

  if (hourUtc >= 0) {
    return new Date(`${dateStr}T${pad(hourUtc)}:${pad(min)}:${pad(sec)}.000Z`)
  } else {
    const prev = new Date(`${dateStr}T00:00:00.000Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    const prevDateStr = prev.toISOString().slice(0, 10)
    return new Date(`${prevDateStr}T${pad(hourUtc + 24)}:${pad(min)}:${pad(sec)}.000Z`)
  }
}

// ============================================================
// Generate data per hari (untuk 1 Mei – sekarang)
// Sama persis dengan seed.js, termasuk timer pump jam 07:00
// ============================================================

const TIMER_PUMP_STATUS  = 'HIGH'
const TIMER_DURATION_SEC = 10
const TIMER_HOUR_WIB     = 7
const INTERVAL_SECONDS   = 5

const generateDayRecords = (dateStr, startHourWib = 0) => {
  const records    = []
  const timerSlots = []

  let spikeCount  = 0
  let spikeActive = false
  let spikeStep   = 0
  let lastSoil    = randInt(1800, 2600)

  const TOTAL_SLOTS = (24 * 60 * 60) / INTERVAL_SECONDS
  const START_SLOT  = (startHourWib * 3600) / INTERVAL_SECONDS

  const timerStartSec = TIMER_HOUR_WIB * 3600
  const timerEndSec   = timerStartSec + TIMER_DURATION_SEC
  for (let s = timerStartSec; s < timerEndSec; s += INTERVAL_SECONDS) {
    timerSlots.push(Math.floor(s / INTERVAL_SECONDS))
  }
  const timerSlotSet = new Set(timerSlots)

  for (let slot = START_SLOT; slot < TOTAL_SLOTS; slot++) {
    const totalSeconds = slot * INTERVAL_SECONDS
    const hourWib = Math.floor(totalSeconds / 3600)
    const min     = Math.floor((totalSeconds % 3600) / 60)
    const sec     = totalSeconds % 60

    const dt       = makeWibDate(dateStr, hourWib, min, sec)
    const inWindow = hourWib >= 13 && hourWib < 15

    if (inWindow && !spikeActive && spikeCount < 2) {
      if (Math.random() < 0.30) { spikeActive = true; spikeStep = 1; spikeCount++ }
    }

    let temperature
    if (spikeActive) {
      if      (spikeStep === 1) temperature = randInt(30, 35)
      else if (spikeStep === 2) temperature = randInt(27, 29)
      else { spikeActive = false; spikeStep = 0; temperature = randInt(22, 25) }
      spikeStep++
    } else {
      temperature = randInt(22, 25)
    }

    const humidity = spikeActive ? randInt(60, 79) : randInt(80, 84)
    const delta    = randInt(-80, 80)
    const soil     = Math.max(1800, Math.min(2600, lastSoil + delta))
    lastSoil       = soil

    const { temp_state, hum_state, soil_state } = mappingState(temperature, humidity, soil)
    const fuzzy = fuzzyRule(soil_state, temp_state, hum_state)

    const isTimerSlot = timerSlotSet.has(slot)
    const pump        = isTimerSlot ? TIMER_PUMP_STATUS : fuzzy.pump
    const pumpMode    = isTimerSlot ? 'Timer' : 'Fuzzy'

    records.push({
      recordedAt:  dt,
      temperature,
      humidity,
      soil,
      pump,
      fan:         fuzzy.fan,
      humidifier:  fuzzy.humidifier,
      dataMode:    isTimerSlot ? 'Timer' : 'Fuzzy',
      pumpMode,
    })
  }

  return records
}

// ============================================================
// BATCH INSERT helper
// ============================================================

const BATCH_SIZE = 1000

const insertBatch = async (records) => {
  for (let j = 0; j < records.length; j += BATCH_SIZE) {
    const batch = records.slice(j, j + BATCH_SIZE)

    await prisma.data.createMany({
      data: batch.map(r => ({
        recordedAt:  r.recordedAt,
        temperature: r.temperature,
        humidity:    r.humidity,
        soil:        r.soil,
        pump:        r.pump,
        fan:         r.fan,
        humidifier:  r.humidifier,
        mode:        r.dataMode,
      })),
      skipDuplicates: true,
    })

    await prisma.actuatorLog.createMany({
      data: batch.flatMap(r => [
        { recordedAt: r.recordedAt, type: 'pump',       status: r.pump,       mode: r.pumpMode, temperature: r.temperature, humidity: r.humidity, soil: r.soil },
        { recordedAt: r.recordedAt, type: 'fan',        status: r.fan,        mode: 'Fuzzy',    temperature: r.temperature, humidity: r.humidity, soil: r.soil },
        { recordedAt: r.recordedAt, type: 'humidifier', status: r.humidifier, mode: 'Fuzzy',    temperature: r.temperature, humidity: r.humidity, soil: r.soil },
      ]),
      skipDuplicates: true,
    })
  }
  return records.length
}

// ============================================================
// PHASE 1 — Import dari Excel (5 Apr – 30 Apr 2026)
// Baca Excel dengan streaming agar tidak OOM di 442k rows
// ============================================================

const EXCEL_PATH = join(__dirname, "history_jamur_1779016468633_1_.xlsx")

const importFromExcel = async () => {
  console.log("📂 Phase 1: Import dari Excel (5 Apr – 30 Apr 2026)...")

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(EXCEL_PATH)
  let buffer     = []
  let rowCount   = 0
  let skipRows   = 0   // skip header baris 1-4
  let totalData  = 0
  let totalLogs  = 0

  for await (const worksheet of workbook) {
    for await (const row of worksheet) {
      skipRows++
      if (skipRows <= 4) continue   // skip title, periode, kosong, header

      const cells = row.values   // index mulai dari 1
      const no          = cells[1]
      const waktuStr    = cells[2]
      const temperature = Number(cells[3])
      const humidity    = Number(cells[4])
      const soil        = Number(cells[5])
      const pump        = cells[6]
      const fan         = cells[7]
      const humidifier  = cells[8]

      if (!waktuStr || !no) continue

      let recordedAt
      try {
        recordedAt = parseExcelDate(String(waktuStr))
      } catch (e) {
        console.warn(`  ⚠ Skip row ${no}: ${e.message}`)
        continue
      }

      const mode     = detectMode({ pump, fan, humidifier, temperature, humidity, soil }, recordedAt)
      const pumpMode = mode === 'Timer' ? 'Timer' : 'Fuzzy'

      // Override pump ke HIGH untuk slot timer yang di Excel masih VERYLOW (07:00:05)
      const finalPump = mode === 'Timer' ? 'HIGH' : pump

      buffer.push({
        recordedAt,
        temperature,
        humidity,
        soil,
        pump:        finalPump,
        fan,
        humidifier,
        dataMode:    mode,
        pumpMode,
      })

      if (buffer.length >= BATCH_SIZE) {
        await insertBatch(buffer)
        totalData += buffer.length
        totalLogs += buffer.length * 3
        buffer     = []
        rowCount  += BATCH_SIZE
        process.stdout.write(`\r  ✅ Imported: ${rowCount.toLocaleString()} rows`)
      }
    }
  }

  // Flush sisa
  if (buffer.length > 0) {
    await insertBatch(buffer)
    totalData += buffer.length
    totalLogs += buffer.length * 3
    rowCount  += buffer.length
  }

  console.log(`\n  ✅ Phase 1 selesai: ${totalData.toLocaleString()} data, ${totalLogs.toLocaleString()} logs`)
  return { totalData, totalLogs }
}

// ============================================================
// PHASE 2 — Generate data baru (1 Mei – 31 Mei 2026)
// ============================================================

const generateNewData = async () => {
  console.log("\n🔧 Phase 2: Generate data baru (1 Mei – 31 Mei 2026)...")

  // Excel berakhir 30 Apr 23:59:55 WIB = 30 Apr 16:59:55 UTC
  // Mulai generate dari 1 Mei 00:00:00 WIB = 30 Apr 17:00:00 UTC
  const GEN_START = new Date("2026-04-30T17:00:00.000Z")
  const GEN_END   = new Date("2026-05-31T16:59:59.999Z") // 31 Mei 23:59:59 WIB

  const dates  = []
  const cursor = new Date("2026-05-01T00:00:00.000Z")
  while (cursor <= new Date("2026-05-31T00:00:00.000Z")) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  console.log(`  📆 Generate ${dates.length} hari: 1 Mei – 31 Mei 2026`)

  let totalData = 0
  let totalLogs = 0

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i]
    const records = generateDayRecords(dateStr, 0)
      .filter(r => r.recordedAt >= GEN_START && r.recordedAt <= GEN_END)

    const inserted = await insertBatch(records)
    totalData += inserted
    totalLogs += inserted * 3

    process.stdout.write(`\r  ✅ ${dateStr} | data: ${totalData.toLocaleString()} | logs: ${totalLogs.toLocaleString()}`)
  }

  console.log(`\n  ✅ Phase 2 selesai: ${totalData.toLocaleString()} data, ${totalLogs.toLocaleString()} logs`)
  return { totalData, totalLogs }
}

// ============================================================
// MAIN SEED
// ============================================================

const seed = async () => {
  const FULL_START = new Date("2026-04-05T03:00:00.000Z") // 5 Apr 10:00 WIB
  const FULL_END   = new Date("2026-05-31T16:59:59.999Z") // 31 Mei 23:59:59 WIB

  console.log("🌱 Mulai seeding...")
  console.log(`📅 Range: 5 Apr 2026 10:00 WIB → 31 Mei 2026 23:59 WIB\n`)

  // ── Hapus data lama di range yang akan di-seed ─────────────
  console.log("🗑  Menghapus data lama di range 5 Apr – 31 Mei 2026...")
  const delLog  = await prisma.actuatorLog.deleteMany({ where: { recordedAt: { gte: FULL_START, lte: FULL_END } } })
  const delData = await prisma.data.deleteMany({        where: { recordedAt: { gte: FULL_START, lte: FULL_END } } })
  console.log(`   ActuatorLog deleted : ${delLog.count.toLocaleString()}`)
  console.log(`   Data deleted        : ${delData.count.toLocaleString()}\n`)

  // ── Phase 1: Import Excel ──────────────────────────────────
  const p1 = await importFromExcel()

  // ── Phase 2: Generate data baru ────────────────────────────
  const p2 = await generateNewData()

  // ── Ringkasan ──────────────────────────────────────────────
  const totalData = p1.totalData + p2.totalData
  const totalLogs = p1.totalLogs + p2.totalLogs

  console.log("\n")
  console.log("🎉 Seeding selesai!")
  console.log(`📦 Total Data inserted        : ${totalData.toLocaleString()}`)
  console.log(`📋 Total ActuatorLog inserted : ${totalLogs.toLocaleString()}`)

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
    WHERE recordedAt >= ${FULL_START}
    AND   recordedAt <= ${FULL_END}
  `

  const logStats = await prisma.$queryRaw`
    SELECT mode, COUNT(*) AS total
    FROM actuator_log
    WHERE recordedAt >= ${FULL_START}
    AND   recordedAt <= ${FULL_END}
    GROUP BY mode
  `

  const s = stats[0]
  console.log("\n📊 Statistik sensor:")
  console.log(`   Total         : ${s.total}`)
  console.log(`   Avg Temp      : ${s.avg_temp}°C`)
  console.log(`   Min/Max Temp  : ${s.min_temp}°C / ${s.max_temp}°C`)
  console.log(`   Spike Count   : ${s.spike_count}`)
  console.log(`   Avg Humidity  : ${s.avg_hum}%`)
  console.log(`   Low Hum Count : ${s.low_hum_count}`)

  console.log("\n📋 Statistik actuator log per mode:")
  logStats.forEach(r => console.log(`   ${String(r.mode).padEnd(8)}: ${r.total}`))
}

seed()
  .catch(e => { console.error("❌ Seeder error:", e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })