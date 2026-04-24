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

interface OpportunityCreatedContext {
  opportunityId: string;
  opportunityTitle: string;
  clientName: string;
  stageName: string;
  ownerName: string;
  ownerEmail: string;
  salesRepName: string;
  createdByName: string;
  value?: number | null;
  probability?: number | null;
  region?: string;
  technology?: string;
  practice?: string;
  projectType?: string;
  pricingModel?: string;
  description?: string;
  tentativeStartDate?: string;
  tentativeDuration?: string;
}

/**
 * Evaluate all active notification rules for a new opportunity creation event.
 * Creates in-app notifications and sends emails as configured.
 */
export async function evaluateOpportunityCreatedRules(ctx: OpportunityCreatedContext): Promise<void> {
  try {
    const rules = await prisma.notificationRule.findMany({
      where: {
        isActive: true,
        triggerType: 'opportunity_created',
      },
    });

    for (const rule of rules) {
      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const recipientRolesCc = ((rule as any).recipientRolesCc as string[]) || [];
      const channels = (rule.channels as string[]) || [];

      if (recipientRoles.length === 0 || channels.length === 0) continue;

      const toUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { name: { in: recipientRoles } } },
        },
        select: { id: true, email: true, name: true, muteNotification: true },
      });

      const ccUsers = recipientRolesCc.length > 0
        ? await prisma.user.findMany({
            where: {
              isActive: true,
              roles: { some: { name: { in: recipientRolesCc } } },
              // Exclude users already in To list
              NOT: { id: { in: toUsers.map(u => u.id) } },
            },
            select: { id: true, email: true, name: true, muteNotification: true },
          })
        : [];

      const variables: Record<string, string> = {
        dealName: ctx.opportunityTitle,
        opportunityTitle: ctx.opportunityTitle,
        opportunityId: ctx.opportunityId,
        stage: ctx.stageName,
        stageName: ctx.stageName,
        client: ctx.clientName,
        clientName: ctx.clientName,
        owner: ctx.ownerName,
        ownerName: ctx.ownerName,
        ownerEmail: ctx.ownerEmail,
        salesRep: ctx.salesRepName,
        salesRepName: ctx.salesRepName,
        createdBy: ctx.createdByName,
        updatedBy: ctx.createdByName,
        value: ctx.value != null ? String(ctx.value) : '',
        probability: ctx.probability != null ? String(ctx.probability) : '',
        region: ctx.region || '',
        technology: ctx.technology || '',
        practice: ctx.practice || '',
        projectType: ctx.projectType || '',
        pricingModel: ctx.pricingModel || '',
        description: ctx.description || '',
        tentativeStartDate: ctx.tentativeStartDate || '',
        tentativeDuration: ctx.tentativeDuration || '',
        opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${ctx.opportunityId}`,
      };

      // Merge calculated fields
      const calcFields = await resolveCalculatedFields(ctx.opportunityId);
      Object.assign(variables, calcFields);

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `New Opportunity: ${ctx.opportunityTitle}`;

      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `A new opportunity "${ctx.opportunityTitle}" for ${ctx.clientName} was created by ${ctx.createdByName}`;

      // In-app notifications: one per user (To + CC combined)
      if (channels.includes('in_app')) {
        for (const user of [...toUsers, ...ccUsers]) {
          await prisma.notification.create({
            data: {
              type: 'opportunity_created',
              title,
              message,
              link: `/dashboard/opportunities/${ctx.opportunityId}`,
              userId: user.id,
            },
          });
        }
      }

      // Email: single message with all To recipients + CC recipients
      if (channels.includes('email') && rule.emailTemplateKey) {
        const toEmails = toUsers.filter(u => !u.muteNotification).map(u => u.email);
        const ccEmails = ccUsers.filter(u => !u.muteNotification).map(u => u.email);
        if (toEmails.length > 0 || ccEmails.length > 0) {
          const primaryName = toUsers[0]?.name || 'Recipient';
          sendNotificationEmail(rule.emailTemplateKey, toEmails, primaryName, variables, ccEmails);
        }
      }

      console.log(`[NotificationEngine] opportunity_created rule "${rule.name}" matched: ${toUsers.length} To + ${ccUsers.length} CC via [${channels.join(', ')}]`);
    }
  } catch (error) {
    console.error('[NotificationEngine] Error evaluating opportunity_created rules:', error);
  }
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
        opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${ctx.opportunityId}`,
      };

      // Merge calculated fields
      const calcFields = await resolveCalculatedFields(ctx.opportunityId);
      Object.assign(variables, calcFields);

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
        opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opportunity.id}`,
      };

      // Merge calculated fields
      const calcFields = await resolveCalculatedFields(opportunity.id);
      Object.assign(variables, calcFields);

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
  return template.replace(/\{\{([\w.:]+)\}\}/g, (_, key) => variables[key] ?? '');
}

/**
 * Resolve calculated fields (calc:xxx) for an opportunity.
 * Fetches the opportunity with relations and computes derived values.
 */
export async function resolveCalculatedFields(opportunityId: string): Promise<Record<string, string>> {
  const calc: Record<string, string> = {};
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        stage: true,
        stageHistory: { orderBy: { enteredAt: 'desc' }, take: 1 },
      },
    }) as any;
    if (!opp) return calc;

    const now = new Date();

    // calc:opportunityAge — days since created
    const createdAt = new Date(opp.createdAt);
    const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
    calc['calc:opportunityAge'] = String(ageDays);

    // calc:daysInStage — days since last stage change (or creation if no history)
    const lastStageChange = opp.stageHistory?.[0]?.enteredAt;
    const stageStart = lastStageChange ? new Date(lastStageChange) : createdAt;
    const daysInStage = Math.floor((now.getTime() - stageStart.getTime()) / 86400000);
    calc['calc:daysInStage'] = String(daysInStage);

    // calc:daysUntilClose — days until expected close
    if (opp.expectedCloseDate) {
      const closeDate = new Date(opp.expectedCloseDate);
      const daysUntil = Math.ceil((closeDate.getTime() - now.getTime()) / 86400000);
      calc['calc:daysUntilClose'] = String(daysUntil);
    } else {
      calc['calc:daysUntilClose'] = 'N/A';
    }

    // calc:formattedValue — value with currency
    const currency = (opp as any).currency || 'USD';
    const value = opp.value != null ? Number(opp.value) : null;
    calc['calc:formattedValue'] = value != null
      ? `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : 'N/A';

    // calc:weightedValue — value × probability / 100
    const prob = opp.probability ?? 0;
    calc['calc:weightedValue'] = value != null
      ? `${currency} ${Math.round(value * prob / 100).toLocaleString('en-US')}`
      : 'N/A';

    // calc:stageProgress — current stage order / total stages as percentage
    if (opp.stage) {
      const totalStages = await prisma.stage.count();
      const progress = totalStages > 0 ? Math.round((opp.stage.order / totalStages) * 100) : 0;
      calc['calc:stageProgress'] = `${progress}%`;
    } else {
      calc['calc:stageProgress'] = 'N/A';
    }

    // calc:stageSLA — SLA status (On Track / Overdue)
    if (opp.stage && opp.stage.slaHours) {
      const slaHours = opp.stage.slaHours;
      const hoursInStage = (now.getTime() - stageStart.getTime()) / 3600000;
      calc['calc:stageSLA'] = hoursInStage <= slaHours ? 'On Track' : 'Overdue';
    } else {
      calc['calc:stageSLA'] = 'N/A';
    }

    // calc:currentDate — today formatted
    calc['calc:currentDate'] = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // calc:currentTime — now formatted with time
    calc['calc:currentTime'] = now.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // calc:expectedCloseFormatted — expected close date formatted
    if (opp.expectedCloseDate) {
      calc['calc:expectedCloseFormatted'] = new Date(opp.expectedCloseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      calc['calc:expectedCloseFormatted'] = 'N/A';
    }

    // calc:createdDateFormatted — created date formatted
    calc['calc:createdDateFormatted'] = createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  } catch (error) {
    console.error('[NotificationEngine] Error resolving calculated fields:', error);
  }
  return calc;
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
