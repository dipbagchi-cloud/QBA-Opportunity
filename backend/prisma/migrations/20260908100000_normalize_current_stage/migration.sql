-- CR-03 Phase 2: normalize the denormalized currentStage to the canonical
-- commercial stage names, collapsing the internal workflow vocabulary
-- (Pipeline/Presales/Sales). stageId already points at the canonical Stage row;
-- this brings the string column into line and flips the column default.
UPDATE "opportunities" SET "currentStage" = 'Discovery'     WHERE "currentStage" = 'Pipeline';
UPDATE "opportunities" SET "currentStage" = 'Qualification' WHERE "currentStage" = 'Presales';
UPDATE "opportunities" SET "currentStage" = 'Proposal'      WHERE "currentStage" = 'Sales';

ALTER TABLE "opportunities" ALTER COLUMN "currentStage" SET DEFAULT 'Discovery';
