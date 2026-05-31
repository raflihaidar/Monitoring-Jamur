import * as dataService from "../services/data.service.js";

// ─────────────────────────────────────────────────────────────
// GET LAST DATA
// ─────────────────────────────────────────────────────────────

export const getLastData = async (req, res, next) => {
  try {
    const result = await dataService.getLastData();
    return res.status(200).json({
      statusCode: 200,
      message:    "Data terbaru berhasil didapatkan",
      data:       result,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET CHART DATA
// ─────────────────────────────────────────────────────────────

export const getChartData = async (req, res, next) => {
  try {
    const result = await dataService.getChartData();
    return res.status(200).json({
      statusCode: 200,
      message:    "Data chart berhasil didapatkan",
      data:       result,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET HISTORY SENSOR
// ─────────────────────────────────────────────────────────────

export const getHistoryData = async (req, res, next) => {
  try {
    const { cursor, limit = 20, dateFrom, dateTo, pump, fan, humidifier } = req.query;
    const result = await dataService.getHistoryData({
      cursor:     cursor ?? null,
      limit:      parseInt(limit),
      dateFrom,
      dateTo,
      pump,
      fan,
      humidifier,
    });
    return res.status(200).json({
      statusCode: 200,
      message:    "OK",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET ACTUATOR LOG HISTORY
// ─────────────────────────────────────────────────────────────

export const getActuatorLog = async (req, res, next) => {
  try {
    const { cursor, limit = 20, type, mode, status, dateFrom, dateTo } = req.query;
    const result = await dataService.getActuatorLogHistory({
      cursor:   cursor ?? null,
      limit:    parseInt(limit),
      type,
      mode,
      status,
      dateFrom,
      dateTo,
    });
    return res.status(200).json({
      statusCode: 200,
      message:    "OK",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET LAST ACTUATOR STATUS
// ─────────────────────────────────────────────────────────────

export const getActuatorStatus = async (req, res, next) => {
  try {
    const result = await dataService.getLastStatusActuator();
    return res.status(200).json({
      statusCode: 200,
      message:    "Status aktuator berhasil didapatkan",
      data:       result,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROL ACTUATOR MANUAL
// ─────────────────────────────────────────────────────────────

export const controlActuatorHandler = async (req, res, next) => {
  try {
    const { type, status } = req.body;

    if (!type || !status) {
      return res.status(400).json({
        statusCode: 400,
        message:    "Field 'type' dan 'status' wajib diisi",
      });
    }

    const result = await dataService.controlActuator(type, status);
    return res.status(200).json({
      statusCode: 200,
      message:    `Aktuator '${type}' berhasil diset ke '${status.toUpperCase()}'`,
      data:       result,
    });
  } catch (error) {
    const isValidation =
      error.message?.startsWith("Invalid") ||
      error.message?.includes("Tidak ada");

    if (isValidation) {
      return res.status(400).json({
        statusCode: 400,
        message:    error.message,
      });
    }

    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// EXPORT EXCEL — sensor history
// ─────────────────────────────────────────────────────────────

export const exportExcel = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    await dataService.exportHistoryToExcel({ dateFrom, dateTo }, res);
  } catch (error) {
    // Header mungkin sudah terkirim (streaming), jangan kirim JSON lagi
    if (!res.headersSent) {
      next(error);
    }
  }
};

// ─────────────────────────────────────────────────────────────
// EXPORT EXCEL — actuator log
// ─────────────────────────────────────────────────────────────

export const exportActuatorLogExcel = async (req, res, next) => {
  try {
    const { type, mode, dateFrom, dateTo } = req.query;
    await dataService.exportActuatorLogToExcel({ type, mode, dateFrom, dateTo }, res);
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    }
  }
};