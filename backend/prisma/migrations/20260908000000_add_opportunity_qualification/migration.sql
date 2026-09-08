-- CR-02 Deal Qualification (BANT + Deliverability)
-- Outcome columns are indexed for filtering/analytics; detailed answers, notes
-- and history live in the JSONB column. isQualified feeds the Hot classifier.
ALTER TABLE "opportunities" ADD COLUMN "isQualified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "opportunities" ADD COLUMN "qualificationStatus" TEXT;
ALTER TABLE "opportunities" ADD COLUMN "qualificationScore" INTEGER;
ALTER TABLE "opportunities" ADD COLUMN "qualifiedAt" TIMESTAMP(3);
ALTER TABLE "opportunities" ADD COLUMN "qualifiedById" TEXT;
ALTER TABLE "opportunities" ADD COLUMN "qualificationData" JSONB;

CREATE INDEX "opportunities_qualificationStatus_idx" ON "opportunities"("qualificationStatus");
CREATE INDEX "opportunities_isQualified_idx" ON "opportunities"("isQualified");
