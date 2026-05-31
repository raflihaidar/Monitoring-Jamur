import { Router } from "express";
import {getActuatorStatus, getLastData, getChartData, getHistoryData, exportExcel, getActuatorLog, controlActuatorHandler} from "../controllers/data.controller.js";
import { exportActuatorLogToExcel } from "../services/data.service.js";

const router = Router();

router.post("/actuator/control", controlActuatorHandler)
router.get("/last-data", getLastData);
router.get("/chart-data", getChartData);
router.get("/history", getHistoryData);
router.get("/export", exportExcel);
router.get('/actuator/log', getActuatorLog)
router.get ("/actuator/status",  getActuatorStatus)
router.get('/actuator-log/export', async (req, res) => {
  try {
    const { type, mode, dateFrom, dateTo } = req.query
    await exportActuatorLogToExcel({ type, mode, dateFrom, dateTo }, res)
  } catch (err) {
    console.error('[Export] exportActuatorLogToExcel error:', err)
    res.status(500).json({ message: 'Gagal export log aktuator' })
  }
})

export default router;