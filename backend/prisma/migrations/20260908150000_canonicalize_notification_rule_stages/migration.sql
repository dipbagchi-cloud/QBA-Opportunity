-- CR-03 Phase 5: canonicalize stored notification-rule stage values, collapsing
-- the workflow vocabulary. Scoped to stage_change rules only, so assignment_change
-- rules (which store a field key like 'presales' in toStage) are untouched.
-- Seeded rules are already canonical, so this only affects any hand-configured rule.
UPDATE "notification_rules" SET "fromStage" = 'Discovery'     WHERE "triggerType" = 'stage_change' AND "fromStage" = 'Pipeline';
UPDATE "notification_rules" SET "fromStage" = 'Qualification' WHERE "triggerType" = 'stage_change' AND "fromStage" = 'Presales';
UPDATE "notification_rules" SET "fromStage" = 'Proposal'      WHERE "triggerType" = 'stage_change' AND "fromStage" = 'Sales';
UPDATE "notification_rules" SET "toStage"   = 'Discovery'     WHERE "triggerType" = 'stage_change' AND "toStage"   = 'Pipeline';
UPDATE "notification_rules" SET "toStage"   = 'Qualification' WHERE "triggerType" = 'stage_change' AND "toStage"   = 'Presales';
UPDATE "notification_rules" SET "toStage"   = 'Proposal'      WHERE "triggerType" = 'stage_change' AND "toStage"   = 'Sales';
