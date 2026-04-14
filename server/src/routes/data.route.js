import { Router } from "express";
import {getLastData, getChartData} from "../controllers/data.controller.js";

const router = Router();

router.get("/last-data", getLastData);
router.get("/chart-data", getChartData);

export default router;