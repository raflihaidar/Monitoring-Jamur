-- CreateTable
CREATE TABLE `actuator_log` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` ENUM('pump', 'fan', 'humidifier') NOT NULL,
    `status` ENUM('VERYLOW', 'LOW', 'NORMAL', 'HIGH', 'VERYHIGH') NOT NULL,
    `mode` ENUM('Fuzzy', 'Timer', 'Manual') NOT NULL,
    `dataId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `actuator_log` ADD CONSTRAINT `actuator_log_dataId_fkey` FOREIGN KEY (`dataId`) REFERENCES `data`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
