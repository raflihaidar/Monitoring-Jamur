import { Router } from "express";
import {getActuatorStatus, getLastData, getChartData, getHistoryData, exportExcel, getActuatorLog, controlActuatorHandler} from "../controllers/data.controller.js";

const router = Router();

router.post("/actuator/control", controlActuatorHandler)
router.get("/last-data", getLastData);
router.get("/chart-data", getChartData);
router.get("/history", getHistoryData);
router.get("/export", exportExcel);
router.get('/actuator/log', getActuatorLog)
router.get ("/actuator/status",  getActuatorStatus)

export default router;