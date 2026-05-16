-- Adds structured-template support to ProgressEntry.
-- Existing rows keep entryKind = 'LEGACY' and structured = NULL.
-- Prisma's `Json?` field is stored as TEXT under SQLite; the application
-- layer (Prisma client) handles JSON.stringify/parse, so we just declare TEXT here.
ALTER TABLE "ProgressEntry" ADD COLUMN "entryKind" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "ProgressEntry" ADD COLUMN "structured" TEXT;
CREATE INDEX "ProgressEntry_entryKind_date_idx" ON "ProgressEntry" ("entryKind", "date");
