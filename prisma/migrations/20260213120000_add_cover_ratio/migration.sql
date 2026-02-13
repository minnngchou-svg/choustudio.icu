-- Add cover ratio metadata for front-end rendering
ALTER TABLE `Post`
  ADD COLUMN `coverRatio` VARCHAR(10) NOT NULL DEFAULT '3:4';

ALTER TABLE `Work`
  ADD COLUMN `coverRatio` VARCHAR(10) NOT NULL DEFAULT '3:4';

ALTER TABLE `VideoTutorial`
  ADD COLUMN `coverRatio` VARCHAR(10) NOT NULL DEFAULT '3:4';
