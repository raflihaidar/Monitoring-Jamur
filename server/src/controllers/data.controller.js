import * as dataService from "../services/data.service.js";


export const getLastData = async (req, res, next) => {
    try {
        const result = await dataService.getLastData();

        return res.status(200).json({
            status: "success",
            message: "Data terbaru berhasil didapatkan",
            data: result,
        });
    } catch (error) {
        next(error)
    }
}

export const getChartData = async (req, res, next) => {
    try {
        const result = await dataService.getChartData();

        return res.status(200).json({
            status: "success",
            message: "Data chart berhasil didapatkan",
            data: result,
        });
    } catch (error) {
        next(error)
    }
}

export const getHistoryData = async (req, res) => {
  try {
    const { page = 1, limit = 20, dateFrom, dateTo } = req.query
    const result = await dataService.getHistoryData({
      page: parseInt(page),
      limit: parseInt(limit),
      dateFrom,
      dateTo,
    })
    res.json({ statusCode: 200, message: 'OK', ...result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: 'Internal Server Error' })
  }
}

export const exportExcel = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query
    await dataService.exportHistoryToExcel({ dateFrom, dateTo }, res)
  } catch (err) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: 'Gagal export data.' })
  }
}

export const getActuatorLog = async (req, res) => {
    try {
    const { page, limit, type, mode, dateFrom, dateTo } = req.query
    const result = await dataService.getActuatorLogHistory({ page: +page, limit: +limit, type, mode, dateFrom, dateTo })
    res.json({ statusCode: 200, message: 'OK', ...result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: 'Internal Server Error' })
  }
}

export const controlActuatorHandler = async (req, res) => {
  try {
    const { type, status } = req.body
 
    if (!type || !status) {
      return res.status(400).json({
        success: false,
        message: "Field 'type' dan 'status' wajib diisi",
      })
    }
 
    const result = await dataService.controlActuator(type, status)
 
    return res.status(200).json({
      success: true,
      message: `Aktuator '${type}' berhasil diset ke '${status.toUpperCase()}'`,
      data:    result,
    })
  } catch (err) {
    console.error("[ActuatorController] controlActuatorHandler:", err)
    const isValidation = err.message.startsWith("Invalid") || err.message.includes("Tidak ada")
    return res.status(isValidation ? 400 : 500).json({
      success: false,
      message: err.message,
    })
  }
}

export const getActuatorStatus = async (req, res) => {
  try {
    const status = await dataService.getLastStatusActuator()
 
    return res.status(200).json({
      success: true,
      data:    status,
    })
  } catch (err) {
    console.error("[ActuatorController] getActuatorStatus:", err)
    return res.status(500).json({ success: false, message: "Internal server error" })
  }
}
 
