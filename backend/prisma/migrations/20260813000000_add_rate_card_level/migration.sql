-- Cost card grade (L2..L8), stored because the business quotes the level
-- even though it moves in lockstep with the experience band.
ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT '';
