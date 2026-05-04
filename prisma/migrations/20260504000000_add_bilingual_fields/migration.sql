-- Adds optional Chinese translation columns to ProgressEntry.
-- Both columns are nullable so existing rows remain valid.

ALTER TABLE "ProgressEntry" ADD COLUMN "descriptionZh" TEXT;
ALTER TABLE "ProgressEntry" ADD COLUMN "remarksZh" TEXT;
