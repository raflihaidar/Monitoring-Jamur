-- CreateTable
CREATE TABLE `actuator_lock` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('pump', 'fan', 'humidifier') NOT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `actuator_lock_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
