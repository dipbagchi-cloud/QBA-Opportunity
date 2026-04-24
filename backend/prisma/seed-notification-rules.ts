/**
 * Seed notification rules for all email templates on the VM database.
 * Run: npx ts-node prisma/seed-notification-rules.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rules = [
  // ── opportunity_created (already exists, upsert) ──
  {
    name: 'New Opportunity → Admin & Manager',
    description: 'Notifies Admins and Managers whenever a new opportunity is created.',
    triggerType: 'opportunity_created',
    recipientRoles: ['Admin', 'Manager'],
    recipientRolesCc: ['Sales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'opportunity_created',
    titleTemplate: 'New Opportunity: {{opportunityTitle}}',
    messageTemplate: '{{createdBy}} created "{{opportunityTitle}}" for {{clientName}} (Value: {{value}})',
  },

  // ── stage_change: Pipeline / Discovery ──
  {
    name: 'Pipeline Saved → Owner',
    description: 'Notifies Sales when an opportunity is saved in Pipeline/Discovery.',
    triggerType: 'stage_change',
    toStage: 'Discovery',
    recipientRoles: ['Sales'],
    recipientRolesCc: ['Admin'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'pipeline_saved',
    titleTemplate: 'Pipeline Update: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} saved in {{stageName}} by {{updatedBy}}',
  },

  // ── stage_change: → Qualification / Presales ──
  {
    name: 'Moved to Presales → Manager',
    description: 'Notifies Managers and Presales when an opportunity moves to Qualification/Presales.',
    triggerType: 'stage_change',
    toStage: 'Qualification',
    recipientRoles: ['Manager', 'Presales'],
    recipientRolesCc: ['Admin'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'moved_to_presales',
    titleTemplate: 'Presales Assignment: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} moved to {{stageName}} — please begin presales activities.',
  },

  // ── stage_change: → Proposal ──
  {
    name: 'Presales Complete → Sales',
    description: 'Notifies Sales when presales work is done and opportunity moves to Proposal.',
    triggerType: 'stage_change',
    toStage: 'Proposal',
    recipientRoles: ['Sales'],
    recipientRolesCc: ['Manager'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'presales_submitted_back',
    titleTemplate: 'Presales Complete: {{opportunityTitle}}',
    messageTemplate: 'Presales for "{{opportunityTitle}}" ({{clientName}}) is complete. Moved to {{stageName}}.',
  },

  // ── stage_change: → Negotiation (moved_to_sales) ──
  {
    name: 'Moved to Negotiation → Sales & Manager',
    description: 'Notifies Sales and Manager when an opportunity enters Negotiation.',
    triggerType: 'stage_change',
    toStage: 'Negotiation',
    recipientRoles: ['Sales', 'Manager'],
    recipientRolesCc: ['Admin'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'moved_to_sales',
    titleTemplate: 'Negotiation: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} is now in Negotiation stage (Value: {{value}}).',
  },

  // ── stage_change: → Closed Won ──
  {
    name: 'Proposal Won → All Teams',
    description: 'Notifies everyone when a deal is won.',
    triggerType: 'stage_change',
    toStage: 'Closed Won',
    recipientRoles: ['Admin', 'Manager', 'Sales', 'Presales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'proposal_won',
    titleTemplate: '🎉 Deal Won: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} has been Closed Won! Deal value: {{value}}.',
  },

  // ── stage_change: → Closed Lost ──
  {
    name: 'Deal Lost → Admin & Manager',
    description: 'Notifies Admin and Managers when a deal is lost.',
    triggerType: 'stage_change',
    toStage: 'Closed Lost',
    recipientRoles: ['Admin', 'Manager'],
    recipientRolesCc: ['Sales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'proposal_lost',
    titleTemplate: 'Deal Lost: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} has been marked as Closed Lost.',
  },

  // ── stage_change: → Proposal Lost ──
  {
    name: 'Proposal Lost → Admin & Manager',
    description: 'Notifies Admin and Managers when a proposal is lost.',
    triggerType: 'stage_change',
    toStage: 'Proposal Lost',
    recipientRoles: ['Admin', 'Manager'],
    recipientRolesCc: ['Sales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'proposal_lost',
    titleTemplate: 'Proposal Lost: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} has been marked as Proposal Lost.',
  },

  // ── stage_change: sent_to_client (generic — any stage where proposal goes to client) ──
  {
    name: 'Proposal Sent to Client → All Teams',
    description: 'Notifies teams when a proposal is sent to the client.',
    triggerType: 'stage_change',
    fromStage: 'Proposal',
    toStage: 'Negotiation',
    recipientRoles: ['Admin', 'Manager', 'Sales'],
    recipientRolesCc: ['Presales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'sent_to_client',
    titleTemplate: 'Proposal Sent: {{opportunityTitle}}',
    messageTemplate: 'The proposal for "{{opportunityTitle}}" has been sent to {{clientName}}.',
  },

  // ── stage_change: sent_back_to_reestimate (Proposal → Qualification) ──
  {
    name: 'Sent Back for Re-Estimation → Presales',
    description: 'Notifies Presales when an opportunity is sent back for re-estimation.',
    triggerType: 'stage_change',
    fromStage: 'Proposal',
    toStage: 'Qualification',
    recipientRoles: ['Presales', 'Manager'],
    recipientRolesCc: ['Sales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: 'sent_back_to_reestimate',
    titleTemplate: 'Re-Estimation Required: {{opportunityTitle}}',
    messageTemplate: '"{{opportunityTitle}}" for {{clientName}} has been sent back for re-estimation.',
  },
];

async function main() {
  console.log('Seeding notification rules...\n');

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    // Check if a rule with same triggerType + emailTemplateKey + toStage already exists
    const existing = await prisma.notificationRule.findFirst({
      where: {
        triggerType: rule.triggerType,
        emailTemplateKey: rule.emailTemplateKey,
        toStage: rule.toStage || null,
        fromStage: rule.fromStage || null,
      },
    });

    if (existing) {
      // Update existing rule
      await prisma.notificationRule.update({
        where: { id: existing.id },
        data: {
          name: rule.name,
          description: rule.description,
          isActive: true,
          recipientRoles: rule.recipientRoles,
          recipientRolesCc: rule.recipientRolesCc || [],
          channels: rule.channels,
          emailTemplateKey: rule.emailTemplateKey,
          titleTemplate: rule.titleTemplate,
          messageTemplate: rule.messageTemplate,
        },
      });
      console.log(`  ♻️  Updated: ${rule.name}`);
      skipped++;
    } else {
      await prisma.notificationRule.create({
        data: {
          name: rule.name,
          description: rule.description,
          isActive: true,
          triggerType: rule.triggerType,
          fromStage: rule.fromStage || null,
          toStage: rule.toStage || null,
          recipientRoles: rule.recipientRoles,
          recipientRolesCc: rule.recipientRolesCc || [],
          channels: rule.channels,
          emailTemplateKey: rule.emailTemplateKey,
          titleTemplate: rule.titleTemplate,
          messageTemplate: rule.messageTemplate,
        },
      });
      console.log(`  ✅ Created: ${rule.name}`);
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} updated (${rules.length} total rules).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
