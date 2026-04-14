/*
  Warnings:

  - The values [OF] on the enum `data_humidifier` will be removed. If these variants are still used in the database, this will fail.
  - The values [OF] on the enum `data_humidifier` will be removed. If these variants are still used in the database, this will fail.
  - The values [OF] on the enum `data_humidifier` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `data` MODIFY `pump` ENUM('ON', 'OFF') NOT NULL,
    MODIFY `fan` ENUM('ON', 'OFF') NOT NULL,
    MODIFY `humidifier` ENUM('ON', 'OFF') NOT NULL;
