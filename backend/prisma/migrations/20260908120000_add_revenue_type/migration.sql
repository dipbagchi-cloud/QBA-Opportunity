-- CR-09: revenue / engagement motion type classification.
ALTER TABLE "opportunities" ADD COLUMN "revenueType" TEXT;
CREATE INDEX "opportunities_revenueType_idx" ON "opportunities"("revenueType");
