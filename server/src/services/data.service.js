import { prisma } from "../config/prisma.js";
import ExcelJS from 'exceljs'

// ─────────────────────────────────────────────────────────────
// BIGINT SERIALIZER
// Prisma mengembalikan id bertipe BigInt. Fungsi ini mengubah
// semua BigInt dalam objek/array menjadi string secara rekursif
// sehingga JSON.stringify tidak melempar error.
// ─────────────────────────────────────────────────────────────

const serializeBigInt = (data) => {
  if (data === null || data === undefined) return data
  if (typeof data === 'bigint') return data.toString()
  if (Array.isArray(data)) return data.map(serializeBigInt)
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, serializeBigInt(v)])
    )
  }
  return data
}

// ─────────────────────────────────────────────────────────────
// MAPPING & FUZZY
// ─────────────────────────────────────────────────────────────

export const mappingSensorValue = (temperature, humidity, soil) => {
  let soil_state = "low"
  let temp_state = "low"
  let hum_state  = "low"

  if (soil > 2600)       soil_state = "low";
  else if (soil > 1800)  soil_state = "normal";
  else                   soil_state = "high";

  if (temperature < 22)       temp_state = "cold";
  else if (temperature <= 25) temp_state = "normal";
  else                        temp_state = "hot";

  if (humidity < 80)       hum_state = "low";
  else if (humidity <= 90) hum_state = "normal";
  else                     hum_state = "high";

  return { soil_state, temp_state, hum_state }
}

const fuzzyRule = (soil_state, temp_state, hum_state) => {
  let pump_state     = "VERYLOW"
  let fan_state      = "VERYLOW"
  let diffuser_state = "VERYLOW"

  if      (soil_state === "high"   && temp_state === "cold"   && hum_state === "high")   { pump_state = "VERYLOW";  fan_state = "VERYLOW"; diffuser_state = "VERYLOW" }
  else if (soil_state === "high"   && temp_state === "cold"   && hum_state === "normal") { pump_state = "VERYLOW";  fan_state = "VERYLOW"; diffuser_state = "VERYLOW" }
  else if (soil_state === "high"   && temp_state === "cold"   && hum_state === "low")    { pump_state = "VERYLOW";  fan_state = "VERYLOW"; diffuser_state = "HIGH"    }
  else if (soil_state === "normal" && temp_state === "cold"   && hum_state === "high")   { pump_state = "VERYLOW";  fan_state = "VERYLOW"; diffuser_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "normal" && hum_state === "normal") { pump_state = "VERYLOW";  fan_state = "VERYLOW"; diffuser_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "hot"    && hum_state === "low")    { pump_state = "VERYLOW";  fan_state = "HIGH";    diffuser_state = "HIGH"    }
  else if (soil_state === "low"    && temp_state === "hot"    && hum_state === "low")    { pump_state = "VERYHIGH"; fan_state = "HIGH";    diffuser_state = "VERYHIGH"}
  else if (soil_state === "low"    && temp_state === "cold"   && hum_state === "high")   { pump_state = "HIGH";     fan_state = "VERYLOW"; diffuser_state = "VERYLOW" }
  else if (soil_state === "low"    && temp_state === "normal" && hum_state === "normal") { pump_state = "HIGH";     fan_state = "VERYLOW"; diffuser_state = "VERYLOW" }
  else if (soil_state === "normal" && temp_state === "hot"    && hum_state === "high")   { pump_state = "VERYLOW";  fan_state = "HIGH";    diffuser_state = "VERYLOW" }

  return { pump: pump_state, fan: fan_state, humidifier: diffuser_state }
}

// ─────────────────────────────────────────────────────────────
// SAVE DATA (simpan sensor + log fuzzy ke ActuatorLog)
// ─────────────────────────────────────────────────────────────

export const saveData = async (payload) => {
  const actuator = fuzzyRule(payload.soil_state, payload.temp_state, payload.hum_state)

  // Cek lock per aktuator
  const locks = await prisma.actuatorLock.findMany({
    where: { type: { in: ['pump', 'fan', 'humidifier'] } }
  })
  const lockMap = Object.fromEntries(locks.map(l => [l.type, l.locked]))

  // Ambil status aktuator terbaru untuk yang sedang terkunci
  const [latestPump, latestFan, latestHumidifier] = await Promise.all([
    lockMap['pump']       ? prisma.actuatorLog.findFirst({ where: { type: 'pump' },       orderBy: { recordedAt: 'desc' } }) : null,
    lockMap['fan']        ? prisma.actuatorLog.findFirst({ where: { type: 'fan' },        orderBy: { recordedAt: 'desc' } }) : null,
    lockMap['humidifier'] ? prisma.actuatorLog.findFirst({ where: { type: 'humidifier' }, orderBy: { recordedAt: 'desc' } }) : null,
  ])

  // Kalau locked, pakai status terakhir. Kalau tidak, pakai hasil fuzzy
  const finalPump       = lockMap['pump']       ? latestPump?.status       : actuator.pump
  const finalFan        = lockMap['fan']        ? latestFan?.status        : actuator.fan
  const finalHumidifier = lockMap['humidifier'] ? latestHumidifier?.status : actuator.humidifier

  // Simpan ke Data — mode Fuzzy karena dari sensor otomatis
  const data = await prisma.data.create({
    data: {
      temperature: payload.temperature,
      humidity:    payload.humidity,
      soil:        payload.soil,
      pump:        finalPump,
      fan:         finalFan,
      humidifier:  finalHumidifier,
      mode:        lockMap['pump'] || lockMap['fan'] || lockMap['humidifier'] ? 'Manual' : 'Fuzzy',
    }
  })

  // Simpan ActuatorLog dengan snapshot sensor langsung (tidak ada dataId)
  await prisma.actuatorLog.createMany({
    data: [
      {
        type:        'pump',
        status:      finalPump,
        mode:        lockMap['pump']       ? 'Manual' : 'Fuzzy',
        temperature: payload.temperature,
        humidity:    payload.humidity,
        soil:        payload.soil,
      },
      {
        type:        'fan',
        status:      finalFan,
        mode:        lockMap['fan']        ? 'Manual' : 'Fuzzy',
        temperature: payload.temperature,
        humidity:    payload.humidity,
        soil:        payload.soil,
      },
      {
        type:        'humidifier',
        status:      finalHumidifier,
        mode:        lockMap['humidifier'] ? 'Manual' : 'Fuzzy',
        temperature: payload.temperature,
        humidity:    payload.humidity,
        soil:        payload.soil,
      },
    ]
  })

  return serializeBigInt(data)
}

// ─────────────────────────────────────────────────────────────
// SAVE MANUAL ACTUATOR CONTROL
// ─────────────────────────────────────────────────────────────

export const saveActuatorControl = async (type, status, mode = 'Manual') => {
  try {
    const validStatus = ["VERYLOW", "LOW", "NORMAL", "HIGH", "VERYHIGH"]
    const normalized  = status?.toUpperCase()

    if (!validStatus.includes(normalized)) {
      throw new Error(`Invalid ActuatorStatus: ${status}`)
    }

    // Ambil snapshot sensor terbaru untuk dicatat di log
    const latest = await prisma.data.findFirst({
      orderBy: { recordedAt: 'desc' }
    })

    const data = await prisma.actuatorLog.create({
      data: {
        type,
        status:      normalized,
        mode,
        temperature: latest?.temperature ?? null,
        humidity:    latest?.humidity    ?? null,
        soil:        latest?.soil        ?? null,
      }
    })

    return serializeBigInt(data)
  } catch (err) {
    console.error(`[ActuatorService] saveActuatorControl error:`, err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────
// UNLOCK ACTUATOR
// ─────────────────────────────────────────────────────────────

export const unlockActuator = async (type) => {
  const normalizedType = type?.toLowerCase()
  await prisma.actuatorLock.upsert({
    where:  { type: normalizedType },
    update: { locked: false },
    create: { type: normalizedType, locked: false },
  })
}

// ─────────────────────────────────────────────────────────────
// CONTROL ACTUATOR MANUAL
// ─────────────────────────────────────────────────────────────

export const controlActuator = async (type, status) => {
  const validTypes    = ["pump", "fan", "humidifier"]
  const validStatuses = ["VERYLOW", "LOW", "NORMAL", "HIGH", "VERYHIGH"]
  const normalizedType   = type?.toLowerCase()
  const normalizedStatus = status?.toUpperCase()

  if (!validTypes.includes(normalizedType)) {
    throw new Error(`Invalid ActuatorType: "${type}". Harus salah satu dari: ${validTypes.join(", ")}`)
  }
  if (!validStatuses.includes(normalizedStatus)) {
    throw new Error(`Invalid ActuatorStatus: "${status}". Harus salah satu dari: ${validStatuses.join(", ")}`)
  }

  // Ambil data sensor terbaru sebagai referensi & snapshot
  const latest = await prisma.data.findFirst({ orderBy: { recordedAt: "desc" } })

  // Ambil status aktuator terbaru untuk masing-masing type
  const [latestPump, latestFan, latestHumidifier] = await Promise.all([
    prisma.actuatorLog.findFirst({ where: { type: 'pump' },       orderBy: { recordedAt: 'desc' } }),
    prisma.actuatorLog.findFirst({ where: { type: 'fan' },        orderBy: { recordedAt: 'desc' } }),
    prisma.actuatorLog.findFirst({ where: { type: 'humidifier' }, orderBy: { recordedAt: 'desc' } }),
  ])

  // Override type yang dikontrol, sisanya pakai status terbaru
  const actuatorValues = {
    pump:       normalizedType === 'pump'       ? normalizedStatus : (latestPump?.status       ?? latest?.pump       ?? 'VERYLOW'),
    fan:        normalizedType === 'fan'        ? normalizedStatus : (latestFan?.status        ?? latest?.fan        ?? 'VERYLOW'),
    humidifier: normalizedType === 'humidifier' ? normalizedStatus : (latestHumidifier?.status ?? latest?.humidifier ?? 'VERYLOW'),
  }

  const [newData, log] = await prisma.$transaction(async (tx) => {
    // Set lock untuk aktuator yang dikontrol
    await tx.actuatorLock.upsert({
      where:  { type: normalizedType },
      update: { locked: true },
      create: { type: normalizedType, locked: true },
    })

    // Buat record Data baru dengan mode Manual
    const newData = await tx.data.create({
      data: {
        temperature: latest?.temperature ?? 0,
        humidity:    latest?.humidity    ?? 0,
        soil:        latest?.soil        ?? 0,
        pump:        actuatorValues.pump,
        fan:         actuatorValues.fan,
        humidifier:  actuatorValues.humidifier,
        mode:        'Manual',
      }
    })

    // Buat ActuatorLog dengan snapshot sensor (tanpa dataId)
    const log = await tx.actuatorLog.create({
      data: {
        type:        normalizedType,
        status:      normalizedStatus,
        mode:        'Manual',
        temperature: latest?.temperature ?? null,
        humidity:    latest?.humidity    ?? null,
        soil:        latest?.soil        ?? null,
      }
    })

    return [newData, log]
  })

  return serializeBigInt({ newData, log })
}

// ─────────────────────────────────────────────────────────────
// GET LAST DATA
// ─────────────────────────────────────────────────────────────

export const getLastData = async () => {
  const result = await prisma.data.findFirst({
    orderBy: { recordedAt: 'desc' },
  })
  return serializeBigInt(result)
}

export const getLastStatusActuator = async () => {
  const [pump, fan, humidifier] = await Promise.all([
    prisma.actuatorLog.findFirst({
      where:   { type: 'pump' },
      orderBy: { recordedAt: 'desc' },
      select:  { status: true, mode: true, recordedAt: true },
    }),
    prisma.actuatorLog.findFirst({
      where:   { type: 'fan' },
      orderBy: { recordedAt: 'desc' },
      select:  { status: true, mode: true, recordedAt: true },
    }),
    prisma.actuatorLog.findFirst({
      where:   { type: 'humidifier' },
      orderBy: { recordedAt: 'desc' },
      select:  { status: true, mode: true, recordedAt: true },
    }),
  ])

  return serializeBigInt({ pump, fan, humidifier })
}

// ─────────────────────────────────────────────────────────────
// GET CHART DATA
// ─────────────────────────────────────────────────────────────

export const getChartData = async () => {
  const rows = await prisma.data.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 7,
  })

  const reversed = rows.reverse()
  return {
    labels: reversed.map(item => {
      // Konversi UTC → WIB (+7) untuk label jam
      const hourWib = (new Date(item.recordedAt).getUTCHours() + 7) % 24
      return hourWib.toString()
    }),
    temp:   reversed.map(item => item.temperature),
    hum:    reversed.map(item => item.humidity),
    soil:   reversed.map(item => item.soil),
  }
}

// ─────────────────────────────────────────────────────────────
// GET HISTORY SENSOR (tab Sensor)
// ─────────────────────────────────────────────────────────────

export const getHistoryData = async ({ cursor, limit = 20, dateFrom, dateTo, pump, fan, humidifier } = {}) => {
  const dateFilter = buildDateWhere(dateFrom, dateTo)

  const where = { ...dateFilter }
  if (pump)       where.pump       = pump
  if (fan)        where.fan        = fan
  if (humidifier) where.humidifier = humidifier

  if (cursor) {
    const cursorDate = new Date(cursor)
    where.recordedAt = {
      ...where.recordedAt,
      lt: cursorDate,
    }
  }

  const t1   = Date.now()
  const rows = await prisma.data.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: limit + 1,
  })
  console.log(`[getHistoryData] findMany: ${Date.now() - t1}ms | cursor: ${cursor} | rows: ${rows.length}`)

  const hasNextPage = rows.length > limit
  const data        = rows.slice(0, limit)

  return {
    data: data.map(r => ({ ...r, id: r.id.toString() })),
    pagination: {
      limit,
      hasNextPage,
      // cursor berikutnya = recordedAt row terakhir (ISO string, aman di JSON)
      nextCursor: hasNextPage ? data[data.length - 1].recordedAt.toISOString() : null,
      prevCursor: cursor ?? null,
    }
  }
}

// ─────────────────────────────────────────────────────────────
// GET HISTORY ACTUATOR LOG (tab Aktuator)
// ─────────────────────────────────────────────────────────────

export const getActuatorLogHistory = async ({
  cursor,
  limit = 20,
  type,
  mode,
  status,
  dateFrom,
  dateTo,
} = {}) => {
  const dateFilter = buildDateWhere(dateFrom, dateTo)
  const where      = { ...dateFilter }

  if (type)   where.type   = type
  if (mode)   where.mode   = mode
  if (status) where.status = status

  if (cursor) {
    const cursorDate = new Date(cursor)
    where.recordedAt = {
      ...where.recordedAt,
      lt: cursorDate,
    }
  }

  const rows = await prisma.actuatorLog.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: limit + 1,
  })

  const hasNextPage = rows.length > limit
  const data        = rows.slice(0, limit)

  return {
    data: data.map(r => ({ ...r, id: r.id.toString() })),
    pagination: {
      limit,
      hasNextPage,
      nextCursor: hasNextPage ? data[data.length - 1].recordedAt.toISOString() : null,
      prevCursor: cursor ?? null,
    }
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORT EXCEL — streaming per batch agar tidak OOM
// ─────────────────────────────────────────────────────────────

export const exportHistoryToExcel = async ({ dateFrom, dateTo } = {}, res) => {
  const where    = buildDateWhere(dateFrom, dateTo)
  const actWhere = {}
  if (where.recordedAt) actWhere.recordedAt = where.recordedAt

  const fileName = `history_jamur_${Date.now()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

  const workbook   = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res })
  workbook.creator = 'Sistem Monitoring Jamur Kuping'
  workbook.created = new Date()

  // ── Sheet 1: Data Sensor ──────────────────────────────────
  const sheetSensor = workbook.addWorksheet('Data Sensor', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })

  sheetSensor.columns = [
    { key: 'no',          width: 6  },
    { key: 'date',        width: 22 },
    { key: 'temperature', width: 16 },
    { key: 'humidity',    width: 18 },
    { key: 'soil',        width: 18 },
    { key: 'pump',        width: 12 },
    { key: 'fan',         width: 12 },
    { key: 'humidifier',  width: 14 },
    { key: 'mode',        width: 12 },
  ]

  addSheetTitleStream(sheetSensor, 'RIWAYAT DATA SENSOR JAMUR KUPING', dateFrom, dateTo)
  styleHeaderStream(sheetSensor.addRow(['No', 'Waktu', 'Suhu (°C)', 'Kelembapan (%)', 'Substrat', 'Pump', 'Fan', 'Humidifier', 'Mode']), '2D6A4F')

  const BATCH = 1000
  let skip = 0
  let idx  = 0

  while (true) {
    const rows = await prisma.data.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip,
      take: BATCH,
    })
    if (rows.length === 0) break

    for (const row of rows) {
      const dr = sheetSensor.addRow({
        no:          ++idx,
        date:        fmtDate(row.recordedAt),
        temperature: +row.temperature.toFixed(1),
        humidity:    +row.humidity.toFixed(1),
        soil:        Math.round(row.soil),
        pump:        row.pump,
        fan:         row.fan,
        humidifier:  row.humidifier,
        mode:        row.mode,
      })
      styleDataRowStream(dr, idx, row)
      dr.commit()
    }

    skip += BATCH
    if (rows.length < BATCH) break
  }

  await sheetSensor.commit()

  // ── Sheet 2: Aktuator Log ────────────────────────────────
  const sheetAct = workbook.addWorksheet('Log Aktuator', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })

  sheetAct.columns = [
    { key: 'no',     width: 6  },
    { key: 'date',   width: 22 },
    { key: 'type',   width: 14 },
    { key: 'status', width: 14 },
    { key: 'mode',   width: 12 },
    { key: 'temp',   width: 12 },
    { key: 'hum',    width: 14 },
    { key: 'soil',   width: 14 },
  ]

  addSheetTitleStream(sheetAct, 'LOG AKTUATOR JAMUR KUPING', dateFrom, dateTo)
  styleHeaderStream(sheetAct.addRow(['No', 'Waktu', 'Aktuator', 'Status', 'Mode', 'Suhu (°C)', 'Kelembapan (%)', 'Substrat']), '1B4F72')

  skip = 0
  idx  = 0

  while (true) {
    const rows = await prisma.actuatorLog.findMany({
      where:   actWhere,
      orderBy: { recordedAt: 'desc' },
      skip,
      take: BATCH,
    })
    if (rows.length === 0) break

    for (const row of rows) {
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFEBf5FB'
      const dr = sheetAct.addRow({
        no:     ++idx,
        date:   fmtDate(row.recordedAt),
        type:   row.type,
        status: row.status,
        mode:   row.mode,
        temp:   row.temperature != null ? +row.temperature.toFixed(1) : '-',
        hum:    row.humidity    != null ? +row.humidity.toFixed(1)    : '-',
        soil:   row.soil        != null ? Math.round(row.soil)        : '-',
      })

      dr.eachCell((cell, col) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD1ECF1' } } }
        if (col === 4) {
          cell.font = { bold: true, color: { argb: actuatorStatusColor(row.status) }, size: 10 }
        }
        if (col === 5) {
          const modeColor = row.mode === 'Manual' ? 'FF854F0B' : row.mode === 'Timer' ? 'FF534AB7' : 'FF0C447C'
          cell.font = { bold: true, color: { argb: modeColor }, size: 10 }
        }
      })

      dr.commit()
    }

    skip += BATCH
    if (rows.length < BATCH) break
  }

  await sheetAct.commit()
  await workbook.commit()
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const buildDateWhere = (dateFrom, dateTo) => {
  const where = {}
  if (dateFrom || dateTo) {
    where.recordedAt = {}
    if (dateFrom) {
      const start = new Date(dateFrom)
      start.setUTCHours(0, 0, 0, 0)
      start.setTime(start.getTime() - (7 * 60 * 60 * 1000))
      where.recordedAt.gte = start
    }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setUTCHours(0, 0, 0, 0)
      end.setTime(end.getTime() + (17 * 60 * 60 * 1000) - 1)
      where.recordedAt.lte = end
    }
  }
  return where
}

const fmtDate = (d) =>
  new Date(d).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

const addSheetTitleStream = (sheet, title, dateFrom, dateTo) => {
  const titleRow       = sheet.addRow([title])
  titleRow.font        = { bold: true, size: 14 }
  titleRow.alignment   = { horizontal: 'center' }
  titleRow.commit()

  const rangeLabel     = dateFrom || dateTo
    ? `Periode: ${dateFrom || '-'} s/d ${dateTo || '-'}`
    : 'Periode: Semua Data'
  const subRow         = sheet.addRow([rangeLabel])
  subRow.font          = { size: 10, color: { argb: 'FF888888' } }
  subRow.alignment     = { horizontal: 'center' }
  subRow.commit()

  sheet.addRow([]).commit()
}

const styleHeaderStream = (row, colorHex) => {
  row.eachCell((cell) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHex } }
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top:    { style: 'thin' },
      bottom: { style: 'thin' },
      left:   { style: 'thin' },
      right:  { style: 'thin' },
    }
  })
  row.height = 24
  row.commit()
}

const styleDataRowStream = (dataRow, idx, row) => {
  const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4'
  dataRow.eachCell((cell, col) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD1FAE5' } } }
    if (col === 3) cell.font = { bold: true, color: { argb: tempColor(row.temperature) },         size: 10 }
    if (col === 4) cell.font = { bold: true, color: { argb: humColor(row.humidity) },              size: 10 }
    if (col === 5) cell.font = { bold: true, color: { argb: soilColor(row.soil) },                 size: 10 }
    if (col === 6) cell.font = { bold: true, color: { argb: actuatorStatusColor(row.pump) },       size: 10 }
    if (col === 7) cell.font = { bold: true, color: { argb: actuatorStatusColor(row.fan) },        size: 10 }
    if (col === 8) cell.font = { bold: true, color: { argb: actuatorStatusColor(row.humidifier) }, size: 10 }
    if (col === 9) {
      const modeColor = row.mode === 'Manual' ? 'FF854F0B' : row.mode === 'Timer' ? 'FF534AB7' : 'FF0C447C'
      cell.font = { bold: true, color: { argb: modeColor }, size: 10 }
    }
  })
  dataRow.height = 20
}

const tempColor = (v) => v < 22 ? 'FF3B82F6' : v <= 25 ? 'FF16A34A' : 'FFEF4444'
const humColor  = (v) => v < 80 ? 'FFF97316' : v <= 90 ? 'FF16A34A' : 'FF3B82F6'
const soilColor = (v) => v > 2600 ? 'FFF97316' : v > 1800 ? 'FF16A34A' : 'FF3B82F6'

const actuatorStatusColor = (v) => {
  const map = {
    VERYLOW:  'FF9CA3AF',
    LOW:      'FF3B82F6',
    NORMAL:   'FF16A34A',
    HIGH:     'FFF97316',
    VERYHIGH: 'FFEF4444',
  }
  return map[v] ?? 'FF9CA3AF'
}

// ─────────────────────────────────────────────────────────────
// EXPORT EXCEL — Log Aktuator (streaming per batch)
// ─────────────────────────────────────────────────────────────

export const exportActuatorLogToExcel = async ({ type, mode, dateFrom, dateTo } = {}, res) => {
  const where = {}

  if (type) where.type = type
  if (mode) where.mode = mode

  const dateWhere = buildDateWhere(dateFrom, dateTo)
  if (dateWhere.recordedAt) where.recordedAt = dateWhere.recordedAt

  const fileName = `log_aktuator_${Date.now()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

  const workbook   = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res })
  workbook.creator = 'Sistem Monitoring Jamur Kuping'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Log Aktuator', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })

  sheet.columns = [
    { key: 'no',     width: 6  },
    { key: 'date',   width: 22 },
    { key: 'type',   width: 14 },
    { key: 'status', width: 14 },
    { key: 'mode',   width: 12 },
    { key: 'temp',   width: 14 },
    { key: 'hum',    width: 16 },
    { key: 'soil',   width: 14 },
  ]

  addSheetTitleStream(sheet, 'LOG AKTUATOR JAMUR KUPING', dateFrom, dateTo)
  styleHeaderStream(
    sheet.addRow(['No', 'Waktu', 'Aktuator', 'Status', 'Mode', 'Suhu (°C)', 'Kelembapan (%)', 'Substrat']),
    '1B4F72'
  )

  const BATCH = 1000
  let skip = 0
  let idx  = 0

  while (true) {
    const rows = await prisma.actuatorLog.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip,
      take: BATCH,
    })
    if (rows.length === 0) break

    for (const row of rows) {
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFEBf5FB'
      const dr = sheet.addRow({
        no:     ++idx,
        date:   fmtDate(row.recordedAt),
        type:   row.type,
        status: row.status,
        mode:   row.mode,
        temp:   row.temperature != null ? +row.temperature.toFixed(1) : '-',
        hum:    row.humidity    != null ? +row.humidity.toFixed(1)    : '-',
        soil:   row.soil        != null ? Math.round(row.soil)        : '-',
      })

      dr.eachCell((cell, col) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD1ECF1' } } }

        if (col === 4) {
          cell.font = { bold: true, color: { argb: actuatorStatusColor(row.status) }, size: 10 }
        }
        if (col === 5) {
          const modeColor = row.mode === 'Manual' ? 'FF854F0B' : row.mode === 'Timer' ? 'FF534AB7' : 'FF0C447C'
          cell.font = { bold: true, color: { argb: modeColor }, size: 10 }
        }
      })

      dr.commit()
    }

    skip += BATCH
    if (rows.length < BATCH) break
  }

  await sheet.commit()
  await workbook.commit()
}