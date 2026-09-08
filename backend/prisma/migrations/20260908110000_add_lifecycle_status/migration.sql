-- CR-07: lifecycle status override, independent of the commercial stage.
-- Won/Lost/Archived derive from stage + isArchived and are never stored here;
-- this column only holds the manual On Hold / Future/Deferred overrides.
ALTER TABLE "opportunities" ADD COLUMN "lifecycleStatus" TEXT;
CREATE INDEX "opportunities_lifecycleStatus_idx" ON "opportunities"("lifecycleStatus");
