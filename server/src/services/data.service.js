import { prisma } from "../config/prisma.js";
import ExcelJS from 'exceljs'

// ─────────────────────────────────────────────────────────────
// MAPPING & FUZZY (tidak diubah)
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
  const data = await prisma.data.create({
    data: {
      temperature: payload.temperature,
      humidity:    payload.humidity,
      soil:        payload.soil,
      pump:        actuator.pump,
      fan:         actuator.fan,
      humidifier:  actuator.humidifier,
      date:        new Date(),
    }
  })

  await prisma.actuatorLog.createMany({
    data: [
      { type: 'pump',       status: actuator.pump,       mode: 'Fuzzy', dataId: data.id },
      { type: 'fan',        status: actuator.fan,        mode: 'Fuzzy', dataId: data.id },
      { type: 'humidifier', status: actuator.humidifier, mode: 'Fuzzy', dataId: data.id },
    ]
  })

  return data
}

// ─────────────────────────────────────────────────────────────
// SAVE MANUAL ACTUATOR CONTROL
// ─────────────────────────────────────────────────────────────

export const saveActuatorControl = async (type, status, mode = 'Manual') => {
  try {
    const validStatus = ["VERYLOW", "LOW", "NORMAL", "HIGH", "VERYHIGH"]
    const normalized = status?.toUpperCase()

    if (!validStatus.includes(normalized)) {
      throw new Error(`Invalid ActuatorStatus: ${status}`)
    }

    const latest = await prisma.data.findFirst({
      orderBy: { date: 'desc' }
    })

    if (!latest) {
      throw new Error("Tidak ada data sensor untuk di-update")
    }

    const data = await prisma.actuatorLog.create({
      data: {
        type,
        status: normalized,
        mode,
        dataId: latest.id,
      }
    })

    return data
  } catch (err) {
    console.error(`[ActuatorService] saveActuatorControl error:`, err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────
// CONTROL ACTUATOR MANUAL
// ─────────────────────────────────────────────────────────────

export const controlActuator = async (type, status) => {
  const validTypes    = ["pump", "fan", "humidifier"]
  const validStatuses = ["VERYLOW", "LOW", "NORMAL", "HIGH", "VERYHIGH"]
  const normalizedType   = type?.toLowerCase()
  const normalizedStatus = status?.toUpperCase()

  // Validasi type & status
  if (!validTypes.includes(normalizedType)) {
    throw new Error(`Invalid ActuatorType: "${type}". Harus salah satu dari: ${validTypes.join(", ")}`)
  }
  if (!validStatuses.includes(normalizedStatus)) {
    throw new Error(`Invalid ActuatorStatus: "${status}". Harus salah satu dari: ${validStatuses.join(", ")}`)
  }

  // Ambil data sensor terbaru sebagai referensi
  const latest = await prisma.data.findFirst({ orderBy: { date: "desc" } })
  if (!latest) throw new Error("Tidak ada data sensor yang tersedia untuk dikontrol")

  // Jalankan update Data + insert ActuatorLog dalam satu transaksi
  const [log] = await prisma.$transaction([
    // prisma.data.update({
    //   where: { id: latest.id },
    //   data:  { [normalizedType]: normalizedStatus },
    // }),

    prisma.actuatorLog.create({
      data: {
        type:   normalizedType,
        status: normalizedStatus,
        mode:   "Manual",
        dataId: latest.id,
      },
    }),
  ])

  return { log }
}

// ─────────────────────────────────────────────────────────────
// GET LAST DATA
// ─────────────────────────────────────────────────────────────

export const getLastData = async () => {
  return prisma.data.findFirst({
    orderBy: { date: 'desc' },
    include: { actuatorLogs: { orderBy: { date: 'desc' }, take: 3 } }
  })
}

export const getLastStatusActuator = async () => {
  const [pump, fan, humidifier] = await Promise.all([
    prisma.actuatorLog.findFirst({
      where:   { type: 'pump' },
      orderBy: { date: 'desc' },
      select:  { status: true, mode: true, date: true },
    }),
    prisma.actuatorLog.findFirst({
      where:   { type: 'fan' },
      orderBy: { date: 'desc' },
      select:  { status: true, mode: true, date: true },
    }),
    prisma.actuatorLog.findFirst({
      where:   { type: 'humidifier' },
      orderBy: { date: 'desc' },
      select:  { status: true, mode: true, date: true },
    }),
  ])

  return { pump, fan, humidifier }
}

// ─────────────────────────────────────────────────────────────
// GET CHART DATA
// ─────────────────────────────────────────────────────────────

export const getChartData = async () => {
  const rows = await prisma.data.findMany({
    orderBy: { date: 'desc' },
    take: 7,
  })

  const reversed = rows.reverse()
  return {
    labels: reversed.map(item => new Date(item.date).getHours().toString()),
    temp:   reversed.map(item => item.temperature),
    hum:    reversed.map(item => item.humidity),
    soil:   reversed.map(item => item.soil),
  }
}

// ─────────────────────────────────────────────────────────────
// GET HISTORY SENSOR (tab Sensor)
// ─────────────────────────────────────────────────────────────

export const getHistoryData = async ({ page = 1, limit = 20, dateFrom, dateTo } = {}) => {
  const skip  = (page - 1) * limit
  const where = buildDateWhere(dateFrom, dateTo)

  const [rows, total] = await Promise.all([
    prisma.data.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.data.count({ where }),
  ])

  return {
    data: rows,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

// ─────────────────────────────────────────────────────────────
// GET HISTORY ACTUATOR LOG (tab Aktuator)
// ─────────────────────────────────────────────────────────────

export const getActuatorLogHistory = async ({
  page   = 1,
  limit  = 20,
  type,
  mode,
  dateFrom,
  dateTo,
} = {}) => {
  const skip  = (page - 1) * limit
  const where = {}

  if (type) where.type = type
  if (mode) where.mode = mode

  const dateWhere = buildDateWhere(dateFrom, dateTo)
  if (dateWhere.date) where.date = dateWhere.date

  const [rows, total] = await Promise.all([
    prisma.actuatorLog.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        data: {
          select: { temperature: true, humidity: true, soil: true }
        }
      }
    }),
    prisma.actuatorLog.count({ where }),
  ])

  return {
    data: rows,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORT EXCEL (2 sheet: Sensor + Aktuator Log)
// ─────────────────────────────────────────────────────────────

export const exportHistoryToExcel = async ({ dateFrom, dateTo } = {}, res) => {
  const where    = buildDateWhere(dateFrom, dateTo)
  const actWhere = {}
  if (where.date) actWhere.date = where.date

  const [sensorRows, actRows] = await Promise.all([
    prisma.data.findMany({ where, orderBy: { date: 'desc' } }),
    prisma.actuatorLog.findMany({
      where:   actWhere,
      orderBy: { date: 'desc' },
      include: { data: { select: { temperature: true, humidity: true, soil: true } } }
    }),
  ])

  const workbook       = new ExcelJS.Workbook()
  workbook.creator     = 'Sistem Monitoring Jamur Kuping'
  workbook.created     = new Date()

  // ── Sheet 1: Data Sensor ──────────────────────────────────
  const sheetSensor = workbook.addWorksheet('Data Sensor', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })

  addSheetTitle(sheetSensor, 'RIWAYAT DATA SENSOR JAMUR KUPING', 'A1:H1', dateFrom, dateTo, 'A2:H2')

  sheetSensor.columns = [
    { key: 'no',          width: 6  },
    { key: 'date',        width: 22 },
    { key: 'temperature', width: 16 },
    { key: 'humidity',    width: 18 },
    { key: 'soil',        width: 18 },
    { key: 'pump',        width: 12 },
    { key: 'fan',         width: 12 },
    { key: 'humidifier',  width: 14 },
  ]

  const sensorHeader = sheetSensor.addRow([
    'No', 'Waktu', 'Suhu (°C)', 'Kelembapan (%)', 'Substrat', 'Pump', 'Fan', 'Humidifier'
  ])
  styleHeader(sensorHeader, '2D6A4F')

  sensorRows.forEach((row, idx) => {
    const dr = sheetSensor.addRow({
      no:          idx + 1,
      date:        fmtDate(row.date),
      temperature: +row.temperature.toFixed(1),
      humidity:    +row.humidity.toFixed(1),
      soil:        Math.round(row.soil),
      pump:        row.pump,
      fan:         row.fan,
      humidifier:  row.humidifier,
    })
    styleDataRow(dr, idx, row)
  })

  // ── Sheet 2: Aktuator Log ────────────────────────────────
  const sheetAct = workbook.addWorksheet('Log Aktuator', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })

  addSheetTitle(sheetAct, 'LOG AKTUATOR JAMUR KUPING', 'A1:G1', dateFrom, dateTo, 'A2:G2')

  sheetAct.columns = [
    { key: 'no',     width: 6  },
    { key: 'date',   width: 22 },
    { key: 'type',   width: 14 },
    { key: 'status', width: 14 },
    { key: 'mode',   width: 12 },
    { key: 'temp',   width: 12 },
    { key: 'hum',    width: 14 },
  ]

  const actHeader = sheetAct.addRow([
    'No', 'Waktu', 'Aktuator', 'Status', 'Mode', 'Suhu (°C)', 'Kelembapan (%)'
  ])
  styleHeader(actHeader, '1B4F72')

  actRows.forEach((row, idx) => {
    const dr = sheetAct.addRow({
      no:     idx + 1,
      date:   fmtDate(row.date),
      type:   row.type,
      status: row.status,
      mode:   row.mode,
      temp:   row.data ? +row.data.temperature.toFixed(1) : '-',
      hum:    row.data ? +row.data.humidity.toFixed(1)    : '-',
    })

    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFEBf5FB'
    dr.eachCell((cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD1ECF1' } } }

      if (col === 5) {
        const modeColor = row.mode === 'Manual' ? 'FF854F0B' : row.mode === 'Timer' ? 'FF534AB7' : 'FF0C447C'
        cell.font = { bold: true, color: { argb: modeColor }, size: 10 }
      }
      if (col === 4) {
        const sc = actuatorStatusColor(row.status)
        cell.font = { bold: true, color: { argb: sc }, size: 10 }
      }
    })
    dr.height = 20
  })

  // ── Stream ────────────────────────────────────────────────
  const fileName = `history_jamur_${Date.now()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  await workbook.xlsx.write(res)
  res.end()
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const buildDateWhere = (dateFrom, dateTo) => {
  const where = {}
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      where.date.lte = end
    }
  }
  return where
}

const fmtDate = (d) =>
  new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

const addSheetTitle = (sheet, title, mergeCells1, dateFrom, dateTo, mergeCells2) => {
  sheet.mergeCells(mergeCells1)
  sheet.getCell(mergeCells1.split(':')[0]).value     = title
  sheet.getCell(mergeCells1.split(':')[0]).font      = { bold: true, size: 14 }
  sheet.getCell(mergeCells1.split(':')[0]).alignment = { horizontal: 'center' }

  sheet.mergeCells(mergeCells2)
  const rangeLabel = dateFrom || dateTo
    ? `Periode: ${dateFrom || '-'} s/d ${dateTo || '-'}`
    : 'Periode: Semua Data'
  sheet.getCell(mergeCells2.split(':')[0]).value     = rangeLabel
  sheet.getCell(mergeCells2.split(':')[0]).font      = { size: 10, color: { argb: 'FF888888' } }
  sheet.getCell(mergeCells2.split(':')[0]).alignment = { horizontal: 'center' }
  sheet.addRow([])
}

const styleHeader = (row, colorHex) => {
  row.eachCell((cell) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHex } }
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }
  })
  row.height = 24
}

const styleDataRow = (dataRow, idx, row) => {
  const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4'
  dataRow.eachCell((cell, col) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD1FAE5' } } }
    if (col === 3) cell.font = { bold: true, color: { argb: tempColor(row.temperature) },  size: 10 }
    if (col === 4) cell.font = { bold: true, color: { argb: humColor(row.humidity) },       size: 10 }
    if (col === 5) cell.font = { bold: true, color: { argb: soilColor(row.soil) },          size: 10 }
    if (col === 6) cell.font = { bold: true, color: { argb: actuatorStatusColor(row.pump) }, size: 10 }
    if (col === 7) cell.font = { bold: true, color: { argb: actuatorStatusColor(row.fan) },  size: 10 }
    if (col === 8) cell.font = { bold: true, color: { argb: actuatorStatusColor(row.humidifier) }, size: 10 }
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