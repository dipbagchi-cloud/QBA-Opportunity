-- Temporary employee skillset/experience bridge, sourced from the HR
-- "Associate Mapping" workbook while Q-People's custom_skillset_gom is empty.
-- Q-People wins whenever it has a value, so this table self-retires.

CREATE TABLE "associate_skill_overrides" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT,
    "skillset" TEXT,
    "experienceBand" TEXT,
    "experienceYears" DOUBLE PRECISION,
    "domain" TEXT,
    "jobLevel" TEXT,
    "status" TEXT,
    "source" TEXT NOT NULL DEFAULT 'excel',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associate_skill_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "associate_skill_overrides_employeeId_key" ON "associate_skill_overrides"("employeeId");
CREATE INDEX "associate_skill_overrides_skillset_idx" ON "associate_skill_overrides"("skillset");
