import { Router } from "express";
import {getLastData, getChartData, getHistoryData, exportExcel} from "../controllers/data.controller.js";

const router = Router();

router.get("/last-data", getLastData);
router.get("/chart-data", getChartData);
router.get("/history", getHistoryData);
router.get("/export", exportExcel);

export default router;