-- Actual GOM: Q-People project mapping + delivery-side resource plan.

-- CreateTable
CREATE TABLE "qpeople_project_mappings" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "qpeopleProjectId" TEXT NOT NULL,
    "qpeopleProjectCode" TEXT NOT NULL,
    "qpeopleProjectName" TEXT NOT NULL,
    "qpeopleCustomer" TEXT,
    "mappedById" TEXT,
    "mappedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qpeople_project_mappings_pkey" PRIMARY KEY ("id")
);

-- One opportunity maps to at most one Q-People project, and a Q-People project
-- can be claimed by at most one opportunity. The second constraint is what makes
-- "already mapped projects must not be selectable" a database guarantee.
CREATE UNIQUE INDEX "qpeople_project_mappings_opportunityId_key" ON "qpeople_project_mappings"("opportunityId");
CREATE UNIQUE INDEX "qpeople_project_mappings_qpeopleProjectId_key" ON "qpeople_project_mappings"("qpeopleProjectId");
CREATE INDEX "qpeople_project_mappings_qpeopleProjectCode_idx" ON "qpeople_project_mappings"("qpeopleProjectCode");

-- CreateTable
CREATE TABLE "actual_resource_rows" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sourceRowId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'MATCHED',
    "skill" TEXT,
    "experienceBand" TEXT,
    "projectRole" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "originalSkill" TEXT,
    "originalExperienceBand" TEXT,
    "originalProjectRole" TEXT,
    "employeeId" TEXT,
    "employeeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actual_resource_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "actual_resource_rows_opportunityId_idx" ON "actual_resource_rows"("opportunityId");
CREATE INDEX "actual_resource_rows_origin_idx" ON "actual_resource_rows"("origin");

-- AddForeignKey
ALTER TABLE "qpeople_project_mappings" ADD CONSTRAINT "qpeople_project_mappings_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "actual_resource_rows" ADD CONSTRAINT "actual_resource_rows_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
