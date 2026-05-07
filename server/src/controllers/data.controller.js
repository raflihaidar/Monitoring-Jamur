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