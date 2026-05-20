-- Add ProjectRole lookup table used by Resource Estimation project-role selection.

CREATE TABLE IF NOT EXISTS "project_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_roles_name_key" ON "project_roles"("name");

INSERT INTO "project_roles" ("id", "name") VALUES
    ('pr_seed_project_manager', 'Project Manager'),
    ('pr_seed_tech_lead', 'Tech Lead'),
    ('pr_seed_architect', 'Architect'),
    ('pr_seed_solution_architect', 'Solution Architect'),
    ('pr_seed_senior_developer', 'Senior Developer'),
    ('pr_seed_developer', 'Developer'),
    ('pr_seed_junior_developer', 'Junior Developer'),
    ('pr_seed_qa_engineer', 'QA Engineer'),
    ('pr_seed_business_analyst', 'Business Analyst'),
    ('pr_seed_scrum_master', 'Scrum Master'),
    ('pr_seed_devops_engineer', 'DevOps Engineer'),
    ('pr_seed_ux_designer', 'UX Designer'),
    ('pr_seed_functional_consult', 'Functional Consultant'),
    ('pr_seed_technical_consult', 'Technical Consultant'),
    ('pr_seed_database_admin', 'Database Administrator')
ON CONFLICT ("name") DO NOTHING;
