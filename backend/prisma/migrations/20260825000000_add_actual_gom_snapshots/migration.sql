-- Nightly delivery-margin snapshots.
-- Additive only: one new table, no changes to existing ones.
CREATE TABLE "actual_gom_snapshots" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "contractedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedGomPercent" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetConsumedPercent" DOUBLE PRECISION,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "submittedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "draftHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overlapMonths" INTEGER NOT NULL DEFAULT 0,
    "overlapPlannedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overlapActualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "burnRatio" DOUBLE PRECISION,
    "unplannedSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedTotalCost" DOUBLE PRECISION,
    "projectedGomPercent" DOUBLE PRECISION,
    "gomDeltaPoints" DOUBLE PRECISION,
    "projectionReliable" BOOLEAN NOT NULL DEFAULT false,
    "submittedSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firm" BOOLEAN NOT NULL DEFAULT false,
    "unpricedPeople" INTEGER NOT NULL DEFAULT 0,
    "fallbackPricedPeople" INTEGER NOT NULL DEFAULT 0,
    "unplannedPeople" INTEGER NOT NULL DEFAULT 0,
    "caveats" TEXT NOT NULL DEFAULT '',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actual_gom_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "actual_gom_snapshots_opportunityId_asOf_key" ON "actual_gom_snapshots"("opportunityId", "asOf");
CREATE INDEX "actual_gom_snapshots_opportunityId_idx" ON "actual_gom_snapshots"("opportunityId");
CREATE INDEX "actual_gom_snapshots_asOf_idx" ON "actual_gom_snapshots"("asOf");

ALTER TABLE "actual_gom_snapshots" ADD CONSTRAINT "actual_gom_snapshots_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
