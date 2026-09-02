-- Adds "rolesManuallyAssigned" to users: roles this user was given by hand,
-- which the QPeople sync must not overwrite.
--
-- Background: syncQPeopleUsers, upsertQPeopleMapping's auto-apply and
-- applyQPeopleMappings all write `roles: { set: [...] }`, which replaces a
-- user's entire role list with whatever their QPeople designation maps to.
-- Only 1 of 98 designation mappings contains Admin, so every hand-granted
-- Admin was being dropped on the next sync run (confirmed in audit_logs:
-- SYNC_QPEOPLE on 2026-07-27 and 2026-08-27 each rewrote 333 users).
--
-- Purely additive with a default, so it is safe to apply while the previous
-- build is still serving: existing rows get false and older code that does not
-- select the column is unaffected.
--
-- NOTE: CI runs `prisma generate`, not `prisma migrate deploy`, so this file is
-- a record of the change — it was applied to the prod, QA and UAT databases
-- directly with the same statements.
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "rolesManuallyAssigned" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: everyone who currently holds Admin got it from an admin editing
-- them by hand (the Admin role is reachable from exactly one designation
-- mapping, "Delivery Manager - ADM", and those users are unharmed by being
-- flagged). This protects the existing admins on the very first deploy,
-- before anyone edits them again.
UPDATE "users" u
SET "rolesManuallyAssigned" = true
FROM "_RoleToUser" ru
JOIN "roles" r ON r.id = ru."A"
WHERE ru."B" = u.id
  AND r.name = 'Admin'
  AND u."rolesManuallyAssigned" = false;
