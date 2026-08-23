-- Version each cost-card upload, so the 716 rows in the admin tab become a
-- legible history: one current card plus the ones it superseded.

CREATE TABLE "rate_card_batches" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceFile" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_card_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_card_batches_isCurrent_idx" ON "rate_card_batches"("isCurrent");
CREATE INDEX "rate_card_batches_uploadedAt_idx" ON "rate_card_batches"("uploadedAt");

ALTER TABLE "rate_cards" ADD COLUMN "batchId" TEXT;
CREATE INDEX "rate_cards_batchId_idx" ON "rate_cards"("batchId");
CREATE INDEX "rate_cards_isActive_idx" ON "rate_cards"("isActive");

ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "rate_card_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Existing rates carry no batch identity; the only thing separating one upload
-- from another is the day they were created (e.g. 393 rows on 2026-04-23 and
-- 323 on 2026-08-13). Group by that day rather than hardcoding dates, so this
-- produces the right result in every environment.
INSERT INTO "rate_card_batches" ("id", "label", "uploadedAt", "rowCount", "isCurrent", "notes", "createdAt", "updatedAt")
SELECT
    md5('ratecardbatch:' || d.day::text),
    'Cost Card - ' || to_char(d.day, 'DD Mon YYYY'),
    d.first_created,
    d.n,
    false,
    'Reconstructed from creation date when rate card versioning was introduced.',
    NOW(),
    NOW()
FROM (
    SELECT date_trunc('day', "createdAt") AS day,
           min("createdAt") AS first_created,
           count(*) AS n
    FROM "rate_cards"
    GROUP BY 1
) d;

UPDATE "rate_cards" rc
SET "batchId" = md5('ratecardbatch:' || date_trunc('day', rc."createdAt")::text);

-- The batch holding the active rates is the current one. Chosen by "has active
-- rows" rather than "is newest", so an upload that was loaded but never
-- activated cannot be mistaken for the live card.
UPDATE "rate_card_batches" b
SET "isCurrent" = true
WHERE b."id" = (
    SELECT rc."batchId"
    FROM "rate_cards" rc
    WHERE rc."isActive" = true AND rc."batchId" IS NOT NULL
    GROUP BY rc."batchId"
    ORDER BY max(rc."createdAt") DESC
    LIMIT 1
);
