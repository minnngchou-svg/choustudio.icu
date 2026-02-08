-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `theme` JSON NULL,
    MODIFY `siteName` VARCHAR(255) NOT NULL DEFAULT 'Fan''s Studio';
