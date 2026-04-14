-- CreateTable
CREATE TABLE `data` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `temperature` DOUBLE NOT NULL,
    `humidity` DOUBLE NOT NULL,
    `soil` DOUBLE NOT NULL,
    `pump` ENUM('ON', 'OF') NOT NULL,
    `fan` ENUM('ON', 'OF') NOT NULL,
    `humidifier` ENUM('ON', 'OF') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
