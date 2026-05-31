/*
  Warnings:

  - The primary key for the `actuator_lock` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `actuator_lock` table. All the data in the column will be lost.
  - The primary key for the `actuator_log` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `dataId` on the `actuator_log` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `actuator_log` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `actuator_log` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `BigInt`.
  - The primary key for the `data` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `date` on the `data` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `data` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `BigInt`.

*/
-- DropForeignKey
ALTER TABLE `actuator_log` DROP FOREIGN KEY `actuator_log_dataId_fkey`;

-- DropIndex
DROP INDEX `actuator_lock_type_key` ON `actuator_lock`;

-- DropIndex
DROP INDEX `actuator_log_dataId_type_date_idx` ON `actuator_log`;

-- DropIndex
DROP INDEX `data_date_idx` ON `data`;

-- AlterTable
ALTER TABLE `actuator_lock` DROP PRIMARY KEY,
    DROP COLUMN `id`,
    ADD PRIMARY KEY (`type`);

-- AlterTable
ALTER TABLE `actuator_log` DROP PRIMARY KEY,
    DROP COLUMN `dataId`,
    DROP COLUMN `date`,
    ADD COLUMN `humidity` DOUBLE NULL,
    ADD COLUMN `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `soil` DOUBLE NULL,
    ADD COLUMN `temperature` DOUBLE NULL,
    MODIFY `id` BIGINT NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `data` DROP PRIMARY KEY,
    DROP COLUMN `date`,
    ADD COLUMN `mode` ENUM('Fuzzy', 'Timer', 'Manual') NOT NULL DEFAULT 'Fuzzy',
    ADD COLUMN `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `id` BIGINT NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE INDEX `actuator_log_recordedAt_idx` ON `actuator_log`(`recordedAt`);

-- CreateIndex
CREATE INDEX `actuator_log_type_recordedAt_idx` ON `actuator_log`(`type`, `recordedAt`);

-- CreateIndex
CREATE INDEX `actuator_log_mode_recordedAt_idx` ON `actuator_log`(`mode`, `recordedAt`);

-- CreateIndex
CREATE INDEX `data_recordedAt_idx` ON `data`(`recordedAt`);

-- CreateIndex
CREATE INDEX `data_recordedAt_id_idx` ON `data`(`recordedAt`, `id`);
