-- Adds the "Eligible for Escalation" flag to opportunities.
--
-- Purely additive with a default, so it is safe to apply while the previous
-- build is still serving: existing rows get false and older code that does not
-- select the column is unaffected.
--
-- NOTE: CI runs `prisma generate`, not `prisma migrate deploy`, so this file is
-- a record of the change — it was applied to the prod, QA and UAT databases
-- directly with the same statement.
ALTER TABLE "opportunities"
    ADD COLUMN IF NOT EXISTS "eligibleForEscalation" BOOLEAN NOT NULL DEFAULT false;
