import { prisma } from './prisma';
import { sendNotificationEmail } from './email';

interface StageChangeContext {
  opportunityId: string;
  opportunityTitle: string;
  previousStage: string;
  newStage: string;
  clientName: string;
  ownerName: string;
  ownerEmail: string;
  salesRepName: string;
  managerName: string;
  updatedByName: string;
  value?: number | null;
  probability?: number | null;
  region?: string;
  technology?: string;
}

/**
 * Evaluate all active notification rules for a stage change event.
 * Creates in-app notifications and sends emails as configured.
 */
export async function evaluateStageChangeRules(ctx: StageChangeContext): Promise<void> {
  try {
    const rules = await prisma.notificationRule.findMany({
      where: {
        isActive: true,
        triggerType: 'stage_change',
      },
    });

    for (const rule of rules) {
      // Check if stage transition matches
      if (rule.fromStage && rule.fromStage !== ctx.previousStage) continue;
      if (rule.toStage && rule.toStage !== ctx.newStage) continue;

      // Get recipient users based on roles
      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const channels = (rule.channels as string[]) || [];

      if (recipientRoles.length === 0 || channels.length === 0) continue;

      const recipients = await prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { name: { in: recipientRoles } } },
        },
        select: { id: true, email: true, name: true, muteNotification: true },
      });

      // Template variables for message rendering
      const variables: Record<string, string> = {
        dealName: ctx.opportunityTitle,
        opportunityTitle: ctx.opportunityTitle,
        opportunityId: ctx.opportunityId,
        previousStage: ctx.previousStage,
        stage: ctx.newStage,
        stageName: ctx.newStage,
        client: ctx.clientName,
        clientName: ctx.clientName,
        owner: ctx.ownerName,
        ownerName: ctx.ownerName,
        salesRep: ctx.salesRepName,
        salesRepName: ctx.salesRepName,
        manager: ctx.managerName,
        managerName: ctx.managerName,
        userName: ctx.updatedByName,
        updatedBy: ctx.updatedByName,
        value: ctx.value != null ? String(ctx.value) : '',
        probability: ctx.probability != null ? String(ctx.probability) : '',
        region: ctx.region || '',
        technology: ctx.technology || '',
      };

      // Build notification title and message from templates or defaults
      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Stage Change: ${ctx.previousStage} → ${ctx.newStage}`;

      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `Opportunity "${ctx.opportunityTitle}" moved from ${ctx.previousStage} to ${ctx.newStage}`;

      for (const user of recipients) {
        // In-app notification
        if (channels.includes('in_app')) {
          await prisma.notification.create({
            data: {
              type: 'stage_change',
              title,
              message,
              link: `/dashboard/opportunities/${ctx.opportunityId}`,
              userId: user.id,
            },
          });
        }

        // Email notification (respects muteNotification)
        if (channels.includes('email') && rule.emailTemplateKey) {
          sendNotificationEmail(rule.emailTemplateKey, user.email, user.name, variables);
        }
      }

      console.log(`[NotificationEngine] Rule "${rule.name}" matched: ${ctx.previousStage} → ${ctx.newStage}, notified ${recipients.length} users via [${channels.join(', ')}]`);
    }
  } catch (error) {
    console.error('[NotificationEngine] Error evaluating stage change rules:', error);
  }
}

/**
 * Evaluate data condition rules against an opportunity.
 * Called after opportunity updates.
 */
export async function evaluateDataConditionRules(opportunity: {
  id: string;
  title: string;
  value?: number | null;
  probability?: number | null;
  currentStage?: string | null;
  region?: string | null;
  technology?: string | null;
  client?: { name: string } | null;
  owner?: { id: string; name: string; email: string } | null;
  salesRepName?: string | null;
  managerName?: string | null;
}): Promise<void> {
  try {
    const rules = await prisma.notificationRule.findMany({
      where: {
        isActive: true,
        triggerType: 'data_condition',
      },
    });

    for (const rule of rules) {
      const conditions = (rule.conditions as any[]) || [];
      if (conditions.length === 0) continue;

      // Check all conditions
      const allMatch = conditions.every((cond) => {
        const fieldValue = getFieldValue(opportunity, cond.field);
        return evaluateCondition(fieldValue, cond.operator, cond.value);
      });

      if (!allMatch) continue;

      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const channels = (rule.channels as string[]) || [];

      const recipients = await prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { name: { in: recipientRoles } } },
        },
        select: { id: true, email: true, name: true, muteNotification: true },
      });

      const variables: Record<string, string> = {
        dealName: opportunity.title,
        opportunityTitle: opportunity.title,
        opportunityId: opportunity.id,
        stage: opportunity.currentStage || '',
        stageName: opportunity.currentStage || '',
        client: opportunity.client?.name || '',
        clientName: opportunity.client?.name || '',
        owner: opportunity.owner?.name || '',
        ownerName: opportunity.owner?.name || '',
        salesRep: opportunity.salesRepName || '',
        salesRepName: opportunity.salesRepName || '',
        manager: opportunity.managerName || '',
        managerName: opportunity.managerName || '',
        value: opportunity.value != null ? String(opportunity.value) : '',
        probability: opportunity.probability != null ? String(opportunity.probability) : '',
        region: opportunity.region || '',
        technology: opportunity.technology || '',
        ruleName: rule.name,
      };

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Alert: ${rule.name}`;

      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `Opportunity "${opportunity.title}" matched condition rule "${rule.name}"`;

      for (const user of recipients) {
        if (channels.includes('in_app')) {
          await prisma.notification.create({
            data: {
              type: 'data_condition',
              title,
              message,
              link: `/dashboard/opportunities/${opportunity.id}`,
              userId: user.id,
            },
          });
        }

        if (channels.includes('email') && rule.emailTemplateKey) {
          sendNotificationEmail(rule.emailTemplateKey, user.email, user.name, variables);
        }
      }

      if (recipients.length > 0) {
        console.log(`[NotificationEngine] Data condition rule "${rule.name}" matched for "${opportunity.title}", notified ${recipients.length} users`);
      }
    }
  } catch (error) {
    console.error('[NotificationEngine] Error evaluating data condition rules:', error);
  }
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

function getFieldValue(opp: any, field: string): any {
  switch (field) {
    case 'value': return opp.value;
    case 'probability': return opp.probability;
    case 'stage': return opp.currentStage;
    case 'region': return opp.region;
    case 'technology': return opp.technology;
    case 'client': return opp.client?.name;
    case 'ownerName': return opp.owner?.name;
    case 'salesRepName': return opp.salesRepName;
    case 'managerName': return opp.managerName;
    default: return undefined;
  }
}

function evaluateCondition(fieldValue: any, operator: string, condValue: string): boolean {
  if (fieldValue === undefined || fieldValue === null) return false;

  const numField = Number(fieldValue);
  const numCond = Number(condValue);
  const isNumeric = !isNaN(numField) && !isNaN(numCond);

  switch (operator) {
    case 'eq': return String(fieldValue).toLowerCase() === condValue.toLowerCase();
    case 'neq': return String(fieldValue).toLowerCase() !== condValue.toLowerCase();
    case 'gt': return isNumeric && numField > numCond;
    case 'gte': return isNumeric && numField >= numCond;
    case 'lt': return isNumeric && numField < numCond;
    case 'lte': return isNumeric && numField <= numCond;
    case 'contains': return String(fieldValue).toLowerCase().includes(condValue.toLowerCase());
    default: return false;
  }
}
