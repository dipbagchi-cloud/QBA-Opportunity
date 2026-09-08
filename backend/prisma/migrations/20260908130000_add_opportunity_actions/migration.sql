-- CR-08: structured next-action / decision tracking.
CREATE TABLE "opportunity_actions" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    CONSTRAINT "opportunity_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "opportunity_actions_opportunityId_idx" ON "opportunity_actions"("opportunityId");
CREATE INDEX "opportunity_actions_status_idx" ON "opportunity_actions"("status");
CREATE INDEX "opportunity_actions_dueDate_idx" ON "opportunity_actions"("dueDate");
ALTER TABLE "opportunity_actions" ADD CONSTRAINT "opportunity_actions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
