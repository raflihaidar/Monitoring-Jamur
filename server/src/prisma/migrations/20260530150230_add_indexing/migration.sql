-- CreateIndex
CREATE INDEX `actuator_log_dataId_type_date_idx` ON `actuator_log`(`dataId`, `type`, `date`);

-- CreateIndex
CREATE INDEX `data_date_idx` ON `data`(`date`);
