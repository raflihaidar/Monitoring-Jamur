/*
  Warnings:

  - The values [ON,OFF] on the enum `data_humidifier` will be removed. If these variants are still used in the database, this will fail.
  - The values [ON,OFF] on the enum `data_humidifier` will be removed. If these variants are still used in the database, this will fail.
  - The values [ON,OFF] on the enum `data_humidifier` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `data` MODIFY `pump` ENUM('VERYLOW', 'LOW', 'NORMAL', 'HIGH', 'VERYHIGH') NOT NULL,
    MODIFY `fan` ENUM('VERYLOW', 'LOW', 'NORMAL', 'HIGH', 'VERYHIGH') NOT NULL,
    MODIFY `humidifier` ENUM('VERYLOW', 'LOW', 'NORMAL', 'HIGH', 'VERYHIGH') NOT NULL;
