-- Drop the "pinned user" flag.
--
-- It existed to shield hand-granted roles from the QPeople sync. The sync no
-- longer writes roles to existing users at all, so a per-user opt-out is dead
-- weight: nobody can lose a role to a refresh any more.
ALTER TABLE "users" DROP COLUMN IF EXISTS "rolesManuallyAssigned";
