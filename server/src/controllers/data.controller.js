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