ALTER TABLE "ProgressEntry" ADD COLUMN "entryKind" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "ProgressEntry" ADD COLUMN "structured" JSONB;
CREATE INDEX "ProgressEntry_entryKind_date_idx" ON "ProgressEntry" ("entryKind", "date");
