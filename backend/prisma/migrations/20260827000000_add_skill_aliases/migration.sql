-- Skill aliases: two names for one skill, across the cost card and Q-People.
-- Additive only.
CREATE TABLE "skill_aliases" (
    "id" TEXT NOT NULL,
    "aliasKey" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "aliasLabel" TEXT NOT NULL,
    "canonicalLabel" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_aliases_aliasKey_canonicalKey_key" ON "skill_aliases"("aliasKey", "canonicalKey");
CREATE INDEX "skill_aliases_aliasKey_idx" ON "skill_aliases"("aliasKey");
CREATE INDEX "skill_aliases_isActive_idx" ON "skill_aliases"("isActive");

-- Seed: only pairs reviewed as genuinely the same discipline under a different
-- name. Keys are skillKey() output (lowercased, leading "sap " stripped,
-- punctuation collapsed to single spaces).
--
-- Deliberately NOT seeded, because similarity flagged them but they are
-- different things: Tableau/SAP BW vs Power BI (different tools), Power Builder
-- and Power Platform vs Power Automate (different products), Project System
-- (the SAP PS module) vs Project Manager, Cloud Security vs Cloud Architect.
-- "QM" -> "SAP PP & QM" is a module inside a broader tag and was left out
-- pending a business decision rather than assumed.
INSERT INTO "skill_aliases"
    ("id", "aliasKey", "canonicalKey", "aliasLabel", "canonicalLabel", "note", "createdByName")
VALUES
    ('seed_alias_uiux', 'ui ux wp', 'ui ux development',
     'UI/ UX/ WP', 'UI/UX development',
     'Seeded: cost card and Q-People names for the same UI/UX discipline.', 'System (seed)'),
    ('seed_alias_powerbi', 'power bi', 'power bi along with business analysis data analysis skill sets',
     'Power BI', 'Power BI along with Business Analysis / Data Analysis Skill sets',
     'Seeded: short and long form of the same Power BI skill.', 'System (seed)'),
    ('seed_alias_sharepoint', 'sharepoint', 'sharepoint online o365 power platform developer',
     'SharePoint', 'SharePoint online / O365 / Power Platform developer',
     'Seeded: short and long form of the same SharePoint skill.', 'System (seed)'),
    ('seed_alias_delivery', 'delivery management', 'delivery lead head',
     'Delivery Management', 'Delivery Lead/Head',
     'Seeded: same delivery-leadership discipline under two names.', 'System (seed)'),
    ('seed_alias_projectmgmt', 'project management', 'project manager any it project technology agnostic',
     'Project Management', 'Project Manager - Any IT Project (Technology Agnostic)',
     'Seeded: same project-management discipline under two names.', 'System (seed)');
