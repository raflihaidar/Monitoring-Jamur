import { prisma } from "../config/prisma.js";
import ExcelJS from 'exceljs'

export const mappingSensorValue = (temperature, humidity, soil) => {
  let soil_state = "low"
  let temp_state = "low"
  let hum_state = "low"

  if (soil > 2600)
    soil_state = "low";
  else if (soil > 1800)
    soil_state = "normal";
  else
    soil_state = "high";

  if(temperature < 22)
    temp_state = "cold";
  else if (temperature <= 25)
    temp_state = "normal";
  else
    temp_state = "hot";

  if (humidity < 80)
    hum_state = "low";
  else if (humidity <= 90)
    hum_state = "normal";
  else
    hum_state = "high";
  return {
    soil_state,
    temp_state,
    hum_state
  }
}

const fuzzyRule = (soil_state, temp_state, hum_state) => {

  let pump_state = "OFF";
  let fan_state = "OFF";
  let diffuser_state = "OFF";

  if (soil_state=="high" && temp_state=="cold" && hum_state=="high"){
    pump_state="OFF"; diffuser_state="OFF"; fan_state="OFF";
  }
  else if (soil_state=="high" && temp_state=="cold" && hum_state=="normal"){
    pump_state="OFF"; diffuser_state="ON"; fan_state="OFF";
  }
  else if (soil_state=="high" && temp_state=="cold" && hum_state=="low"){
    pump_state="OFF"; diffuser_state="ON"; fan_state="OFF";
  }
  else if (soil_state=="normal" && temp_state=="cold" && hum_state=="high"){
    pump_state="ON"; diffuser_state="OFF"; fan_state="OFF";
  }
  else if (soil_state=="normal" && temp_state=="normal" && hum_state=="normal"){
    pump_state="OFF"; diffuser_state="OFF"; fan_state="OFF";
  }
  else if (soil_state=="normal" && temp_state=="hot" && hum_state=="low"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }
  else if (soil_state=="low" && temp_state=="hot" && hum_state=="low"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }
  else if (soil_state=="low" && temp_state=="cold" && hum_state=="high"){
    pump_state="ON"; diffuser_state="ON"; fan_state="OFF";
  }
  else if (soil_state=="low" && temp_state=="normal" && hum_state=="normal"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }
  else if (soil_state=="normal" && temp_state=="hot" && hum_state=="normal"){
    pump_state="OFF"; diffuser_state="OFF"; fan_state="ON";
  }
  else if (soil_state=="normal" && temp_state=="hot" && hum_state=="high"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }

  return {
    pump: pump_state,
    fan: fan_state,
    humidifier: diffuser_state
  };
};

export const saveData = async (payload) => {

    const actuator = fuzzyRule(
        payload.soil_state,
        payload.temp_state,
        payload.hum_state
    );

    console.log("status actuator : ", actuator)

    const data = await prisma.data.create({
        data : {
            temperature : payload.temperature,
            humidity : payload.humidity,
            soil : payload.soil,
            pump: actuator.pump,
            fan: actuator.fan,
            humidifier: actuator.humidifier,
            date : new Date()
        }
    })

    return data
}

export const getLastData = async () => {
  const lastData = await prisma.data.findFirst({
    orderBy: {
      date: "desc",
    },
  });

  return lastData;
};

export const getChartData = async () => {
  const rows = await prisma.data.findMany({
    orderBy: {
      date: "desc"
    },
    take: 7
  })

  const reversed = rows.reverse()

  return {
    labels: reversed.map(item =>
      new Date(item.date).getHours().toString()
    ),
    temp: reversed.map(item => item.temperature),
    hum: reversed.map(item => item.humidity),
    soil: reversed.map(item => item.soil)
  }
}

export const getHistoryData = async ({ page = 1, limit = 20, dateFrom, dateTo } = {}) => {
  const skip = (page - 1) * limit

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
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const exportHistoryToExcel = async ({ dateFrom, dateTo } = {}, res) => {
  // ── Build filter ──────────────────────────────────────────
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

  const rows = await prisma.data.findMany({
    where,
    orderBy: { date: 'desc' },
  })

  // ── Workbook setup ────────────────────────────────────────
  const workbook  = new ExcelJS.Workbook()
  workbook.creator  = 'Sistem Monitoring Jamur Kuping'
  workbook.created  = new Date()

  const sheet = workbook.addWorksheet('Riwayat Data', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })

  // ── Header metadata ───────────────────────────────────────
  sheet.mergeCells('A1:G1')
  sheet.getCell('A1').value = 'RIWAYAT DATA MONITORING JAMUR KUPING'
  sheet.getCell('A1').font  = { bold: true, size: 14 }
  sheet.getCell('A1').alignment = { horizontal: 'center' }

  sheet.mergeCells('A2:G2')
  const rangeLabel = dateFrom || dateTo
    ? `Periode: ${dateFrom || '-'} s/d ${dateTo || '-'}`
    : 'Periode: Semua Data'
  sheet.getCell('A2').value = rangeLabel
  sheet.getCell('A2').font  = { size: 10, color: { argb: 'FF888888' } }
  sheet.getCell('A2').alignment = { horizontal: 'center' }

  sheet.addRow([]) // baris kosong

  // ── Column definition ─────────────────────────────────────
  sheet.columns = [
    { key: 'no',          width: 6  },
    { key: 'date',        width: 22 },
    { key: 'temperature', width: 16 },
    { key: 'humidity',    width: 18 },
    { key: 'soil',        width: 18 },
    { key: 'pump',        width: 12 },
    { key: 'fan',         width: 12 },
    { key: 'humidifier',  width: 14 },
  ]

  // ── Column header (row 4) ─────────────────────────────────
  const headerRow = sheet.addRow([
    'No',
    'Waktu',
    'Suhu (°C)',
    'Kelembapan (%)',
    'Substrat',
    'Pump',
    'Fan',
    'Humidifier',
  ])

  const HEADER_COLOR = '2D6A4F' // hijau tua
  const HEADER_FONT  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_COLOR },
    }
    cell.font      = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF1B4332' } },
      bottom: { style: 'thin', color: { argb: 'FF1B4332' } },
      left:   { style: 'thin', color: { argb: 'FF1B4332' } },
      right:  { style: 'thin', color: { argb: 'FF1B4332' } },
    }
  })
  headerRow.height = 24

  // ── Helper: warna berdasarkan state ──────────────────────
  const tempColor = (val) => {
    if (val < 22)  return 'FF3B82F6' // cold  → biru
    if (val <= 25) return 'FF16A34A' // normal → hijau
    return 'FFEF4444'                // hot   → merah
  }

  const humColor = (val) => {
    if (val < 80)  return 'FFF97316' // low  → orange
    if (val <= 90) return 'FF16A34A' // normal → hijau
    return 'FF3B82F6'                // high → biru
  }

  const soilColor = (val) => {
    if (val > 2600) return 'FFF97316' // low  → orange
    if (val > 1800) return 'FF16A34A' // normal → hijau
    return 'FF3B82F6'                 // high → biru
  }

  const actuatorColor = (val) => val === 'ON' ? 'FF16A34A' : 'FF9CA3AF'

  const coloredFont = (argb) => ({ color: { argb }, bold: true, size: 10 })

  // ── Data rows ─────────────────────────────────────────────
  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow({
      no:          idx + 1,
      date:        new Date(row.date).toLocaleString('id-ID', {
                     day: '2-digit', month: 'short', year: 'numeric',
                     hour: '2-digit', minute: '2-digit', second: '2-digit',
                   }),
      temperature: Number(row.temperature.toFixed(1)),
      humidity:    Number(row.humidity.toFixed(1)),
      soil:        Math.round(row.soil),
      pump:        row.pump,
      fan:         row.fan,
      humidifier:  row.humidifier,
    })

    // Zebra stripe
    const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4'

    dataRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFD1FAE5' } },
        left:   { style: 'hair', color: { argb: 'FFD1FAE5' } },
        right:  { style: 'hair', color: { argb: 'FFD1FAE5' } },
      }

      // Warna per kolom
      if (colNumber === 3) cell.font = coloredFont(tempColor(row.temperature))
      if (colNumber === 4) cell.font = coloredFont(humColor(row.humidity))
      if (colNumber === 5) cell.font = coloredFont(soilColor(row.soil))
      if (colNumber === 6) cell.font = coloredFont(actuatorColor(row.pump))
      if (colNumber === 7) cell.font = coloredFont(actuatorColor(row.fan))
      if (colNumber === 8) cell.font = coloredFont(actuatorColor(row.humidifier))
    })

    dataRow.height = 20
  })

  // ── Summary row ───────────────────────────────────────────
  if (rows.length > 0) {
    sheet.addRow([])

    const temps = rows.map(r => r.temperature)
    const hums  = rows.map(r => r.humidity)
    const soils = rows.map(r => r.soil)

    const avg = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
    const min = (arr) => Math.min(...arr).toFixed(1)
    const max = (arr) => Math.max(...arr).toFixed(1)

    const summaryData = [
      ['', 'Rata-rata', avg(temps), avg(hums), avg(soils), '', '', ''],
      ['', 'Min',       min(temps), min(hums), min(soils), '', '', ''],
      ['', 'Max',       max(temps), max(hums), max(soils), '', '', ''],
    ]

    summaryData.forEach((s) => {
      const r = sheet.addRow(s)
      r.getCell(2).font = { bold: true, size: 10, color: { argb: 'FF374151' } }
      r.getCell(2).alignment = { horizontal: 'right' }
      ;[3, 4, 5].forEach((col) => {
        r.getCell(col).font      = { bold: true, size: 10 }
        r.getCell(col).alignment = { horizontal: 'center' }
      })
    })
  }

  // ── Stream response ───────────────────────────────────────
  const fileName = `history_jamur_${Date.now()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

  await workbook.xlsx.write(res)
  res.end()
}