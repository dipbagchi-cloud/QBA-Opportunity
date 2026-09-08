-- CR-10: dedicated RFP tracking + CR-11: parent-child link to opportunities.
CREATE TABLE "rfps" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Identified',
    "receivedDate" TIMESTAMP(3),
    "submissionDueDate" TIMESTAMP(3),
    "internalTargetDate" TIMESTAMP(3),
    "clarificationDate" TIMESTAMP(3),
    "preBidDate" TIMESTAMP(3),
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "rfps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rfps_submissionDueDate_idx" ON "rfps"("submissionDueDate");
CREATE INDEX "rfps_status_idx" ON "rfps"("status");

ALTER TABLE "opportunities" ADD COLUMN "rfpId" TEXT;
CREATE INDEX "opportunities_rfpId_idx" ON "opportunities"("rfpId");
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "rfps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
