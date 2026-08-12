import { prisma } from './prisma';
import { sendNotificationEmail, sendRawEmail } from './email';
import { calculateOpportunityProbability } from './opportunity-probability';
import { recordStageEntry } from './stage-history';

// Roles that are "global" - all users with these roles get notified regardless of assignment
const GLOBAL_ROLES = ['Admin'];
const BUDGET_ASSUMPTIONS_KEY = 'budget_assumptions';

function getEnvironmentLabel(): 'QA' | 'UAT' | null {
  const envHints = [
    process.env.APP_ENV,
    process.env.DEPLOY_ENV,
    process.env.NODE_ENV,
    process.env.FRONTEND_URL,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  if (envHints.some((v) => v.includes('uat'))) return 'UAT';
  if (envHints.some((v) => v.includes('qa'))) return 'QA';
  return null;
}

async function getTimeDrivenReminderOverrideEmail(): Promise<string | null> {
  const envLabel = getEnvironmentLabel();
  if (!envLabel) return null;

  const config = await prisma.systemConfig.findUnique({
    where: { key: BUDGET_ASSUMPTIONS_KEY },
    select: { value: true },
  });
  const value = (config?.value as any)?.nonProdTimeDrivenReminderEmail;
  const email = typeof value === 'string' ? value.trim() : '';
  return email || null;
}

/**
 * Resolve the set of user IDs assigned to an opportunity, keyed by role.
 * Only users assigned to the opportunity in a matching role will be notified.
 * Admin roles are exempt and always receive notifications.
 */
async function resolveAssignedRecipients(
  opportunityId: string,
  recipientRoles: string[],
  recipientUsers: Record<string, string[]> | null
): Promise<{ id: string; email: string; name: string; muteNotification: boolean; roles: { name: string }[] }[]> {
  // Fetch the opportunity with owner info
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      ownerId: true,
      owner: { select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } } },
      salesRepName: true,
      managerName: true,
      presalesAssigneeName: true,
    },
  });
  if (!opp) return [];

  // Split roles into global (Admin) and opportunity-scoped
  const globalRoles = recipientRoles.filter(r => GLOBAL_ROLES.includes(r));
  const scopedRoles = recipientRoles.filter(r => !GLOBAL_ROLES.includes(r));

  let allRecipients: { id: string; email: string; name: string; muteNotification: boolean; roles: { name: string }[] }[] = [];

  // Global roles (Admin etc.) — all active users with that role get notified
  if (globalRoles.length > 0) {
    const globalUsers = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { name: { in: globalRoles } } } },
      select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } },
    });
    allRecipients.push(...globalUsers);
  }

  // Scoped roles map to opportunity assignment SLOTS — not any user with the
  // matching role. This prevents the salesperson (who may also carry a
  // Manager/Presales role) from being addressed as the assigned manager when
  // a different person is in the manager slot.
  //   role 'Sales'    → owner OR user matching salesRepName
  //   role 'Manager'  → user matching managerName
  //   role 'Presales' → user matching presalesAssigneeName
  if (scopedRoles.length > 0) {
    const slotNames = new Set<string>();
    const slotIds = new Set<string>();
    for (const role of scopedRoles) {
      if (role === 'Sales') {
        if (opp.owner) slotIds.add(opp.owner.id);
        if (opp.salesRepName) slotNames.add(opp.salesRepName);
      } else if (role === 'Manager') {
        if (opp.managerName) slotNames.add(opp.managerName);
      } else if (role === 'Presales') {
        if (opp.presalesAssigneeName) slotNames.add(opp.presalesAssigneeName);
      }
    }

    if (slotNames.size > 0) {
      // Case-insensitive name match — assignment-field strings ("Kunjana Roy")
      // are user-entered and don't always match the User.name casing exactly.
      // A case-sensitive `in:` query silently drops them.
      const namedUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: Array.from(slotNames).map(n => ({ name: { equals: n, mode: 'insensitive' as const } })),
        },
        select: { id: true },
      });
      namedUsers.forEach(u => slotIds.add(u.id));
    }

    if (slotIds.size > 0) {
      const slotUsers = await prisma.user.findMany({
        where: { isActive: true, id: { in: Array.from(slotIds) } },
        select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } },
      });
      slotUsers.forEach(u => {
        if (!allRecipients.find(r => r.id === u.id)) {
          allRecipients.push(u);
        }
      });
    }
  }

  // Apply per-user filtering from rule if present
  if (recipientUsers) {
    allRecipients = allRecipients.filter(u => u.roles.some((r: any) => {
      if (!recipientRoles.includes(r.name)) return false;
      const specific = recipientUsers[r.name];
      if (!specific || specific.length === 0) return true;
      return specific.includes(u.id);
    }));
  }

  return allRecipients;
}

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
  currency?: string;
  probability?: number | null;
  region?: string;
  technology?: string;
  comment?: string;
  adjustedEstimatedValue?: string;
  reEstimateCount?: number;
}

interface OpportunityCreatedContext {
  opportunityId: string;
  opportunityTitle: string;
  clientName: string;
  stageName: string;
  ownerName: string;
  ownerEmail: string;
  salesRepName: string;
  managerName?: string;
  presalesAssigneeName?: string;
  createdByName: string;
  value?: number | null;
  currency?: string;
  probability?: number | null;
  region?: string;
  technology?: string;
  practice?: string;
  projectType?: string;
  pricingModel?: string;
  description?: string;
  tentativeStartDate?: string;
  tentativeDuration?: string;
  expectedCloseDate?: string;
  expectedDayRate?: number | null;
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

    const createdProbability = calculateOpportunityProbability({
      stage: { name: ctx.stageName },
      currentStage: ctx.stageName,
      description: ctx.description,
      tentativeDuration: ctx.tentativeDuration,
      expectedCloseDate: ctx.expectedCloseDate,
      expectedDayRate: ctx.expectedDayRate,
    });

    for (const rule of rules) {
      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const recipientRolesCc = ((rule as any).recipientRolesCc as string[]) || [];
      const channels = (rule.channels as string[]) || [];

      if (recipientRoles.length === 0 || channels.length === 0) continue;

      const recipientUsers = rule.recipientUsers as Record<string, string[]> | null;

      // Only notify assigned users per role (Admin gets all)
      let toUsers = await resolveAssignedRecipients(ctx.opportunityId, recipientRoles, recipientUsers);

      let ccUsers = recipientRolesCc.length > 0
        ? await resolveAssignedRecipients(ctx.opportunityId, recipientRolesCc, recipientUsers)
        : [];
      // Exclude users already in To list from CC
      ccUsers = ccUsers.filter(u => !toUsers.find(t => t.id === u.id));

      const _oppCurrency = ctx.currency || 'USD';
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
        manager: ctx.managerName || '',
        managerName: ctx.managerName || '',
        presales: ctx.presalesAssigneeName || '',
        presalesAssigneeName: ctx.presalesAssigneeName || '',
        createdBy: ctx.createdByName,
        updatedBy: ctx.createdByName,
        value: ctx.value != null ? fmtNum(Number(ctx.value)) : '',
        currency: _oppCurrency,
        'opportunity.currency': _oppCurrency,
        probability: String(createdProbability),
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
      variables['calc:probability'] = String(createdProbability);
      variables.probability = String(createdProbability);
      variables['opportunity.probability'] = String(createdProbability);

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

    // Sort rules: specific rules (with fromStage) first, then generic (fromStage=null)
    // This way we can track which toStage values already had a specific match
    const sortedRules = [...rules].sort((a, b) => {
      if (a.fromStage && !b.fromStage) return -1;
      if (!a.fromStage && b.fromStage) return 1;
      return 0;
    });

    const matchedToStages = new Set<string>();

    for (const rule of sortedRules) {
      // Check if stage transition matches
      if (rule.fromStage && rule.fromStage !== ctx.previousStage) continue;
      if (rule.toStage && rule.toStage !== ctx.newStage) continue;

      // Skip generic rule if a specific rule already matched this toStage
      if (!rule.fromStage && rule.toStage && matchedToStages.has(rule.toStage)) {
        console.log(`[NotificationEngine] Skipping generic rule "${rule.name}" — specific rule already matched for toStage="${rule.toStage}"`);
        continue;
      }

      // Track that this toStage has been matched by a specific rule
      if (rule.fromStage && rule.toStage) {
        matchedToStages.add(rule.toStage);
      }

      // Get recipient users based on roles
      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const recipientRolesCc = ((rule as any).recipientRolesCc as string[]) || [];
      const channels = (rule.channels as string[]) || [];

      if (recipientRoles.length === 0 || channels.length === 0) continue;

      const recipientUsers = rule.recipientUsers as Record<string, string[]> | null;

      // Only notify assigned users per role (Admin gets all)
      const toUsers = await resolveAssignedRecipients(ctx.opportunityId, recipientRoles, recipientUsers);
      let ccUsers = recipientRolesCc.length > 0
        ? await resolveAssignedRecipients(ctx.opportunityId, recipientRolesCc, recipientUsers)
        : [];
      // Exclude users already in To list from CC
      ccUsers = ccUsers.filter(u => !toUsers.find(t => t.id === u.id));

      // Template variables for message rendering
      const _stageCurrency = ctx.currency || 'USD';
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
        value: ctx.value != null ? fmtNum(Number(ctx.value)) : '',
        currency: _stageCurrency,
        'opportunity.currency': _stageCurrency,
        probability: ctx.probability != null ? String(ctx.probability) : '',
        region: ctx.region || '',
        technology: ctx.technology || '',
        comment: ctx.comment || '',
        reason: ctx.comment || '',
        adjustedEstimatedValue: ctx.adjustedEstimatedValue
          ? fmtMoney(_stageCurrency, Number(ctx.adjustedEstimatedValue))
          : '',
        reEstimateCount: ctx.reEstimateCount != null ? String(ctx.reEstimateCount) : '0',
        opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${ctx.opportunityId}`,
      };

      // Merge calculated fields
      const calcFields = await resolveCalculatedFields(ctx.opportunityId);
      Object.assign(variables, calcFields);
      if (calcFields['opportunity.probability']) {
        variables.probability = calcFields['opportunity.probability'];
      }

      // Build notification title and message from templates or defaults
      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Stage Change: ${ctx.previousStage} → ${ctx.newStage}`;

      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `Opportunity "${ctx.opportunityTitle}" moved from ${ctx.previousStage} to ${ctx.newStage}`;

      // In-app notifications: one per user (To + CC combined)
      if (channels.includes('in_app')) {
        for (const user of [...toUsers, ...ccUsers]) {
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
      }

      // Email: single message with all To recipients + CC recipients
      if (channels.includes('email') && rule.emailTemplateKey) {
        const toEmails = toUsers.filter(u => !u.muteNotification).map(u => u.email);
        const ccEmails = ccUsers.filter(u => !u.muteNotification).map(u => u.email);
        if (toEmails.length > 0 || ccEmails.length > 0) {
          const primaryName = toUsers[0]?.name || ccUsers[0]?.name || 'Recipient';
          sendNotificationEmail(rule.emailTemplateKey, toEmails, primaryName, variables, ccEmails);
        }
      }

      console.log(`[NotificationEngine] Rule "${rule.name}" matched: ${ctx.previousStage} → ${ctx.newStage}, notified ${toUsers.length} To + ${ccUsers.length} CC via [${channels.join(', ')}]`);
    }
  } catch (error) {
    console.error('[NotificationEngine] Error evaluating stage change rules:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Assignment change events                                            */
/* ------------------------------------------------------------------ */

export type AssignmentField = 'sales_rep' | 'manager' | 'presales';

interface AssignmentChangeContext {
  opportunityId: string;
  opportunityTitle: string;
  field: AssignmentField;
  previousValue: string;
  newValue: string;
  clientName: string;
  stageName: string;
  ownerName: string;
  updatedByName: string;
  value?: number | null;
  currency?: string;
  region?: string;
  technology?: string;
  salesRepName: string;
  managerName: string;
  presalesAssigneeName: string;
}

const ASSIGNMENT_DEFAULT_TEMPLATE: Record<AssignmentField, string> = {
  sales_rep: 'sales_rep_reassigned',
  manager: 'manager_reassigned',
  presales: 'presales_assigned',
};

/**
 * Evaluate notification rules for an assignment change event.
 * Notifies the newly-assigned person (and any matching rule's role recipients).
 * Fire-and-forget: errors are caught and logged.
 */
export async function evaluateAssignmentChangeRules(ctx: AssignmentChangeContext): Promise<void> {
  try {
    const rules = await prisma.notificationRule.findMany({
      where: { isActive: true, triggerType: 'assignment_change' },
    });

    // Filter rules to ones that target this assignment field. We piggy-back on
    // the existing toStage column to store the field key ('sales_rep' | 'manager' | 'presales').
    // A rule with toStage = null applies to all assignment changes.
    const matched = rules.filter(r => !r.toStage || r.toStage === ctx.field);

    // Look up the newly-assigned user so we can email them directly even when
    // no NotificationRule explicitly targets their role. Case-insensitive
    // because the assignment-field string is user-entered and doesn't always
    // match the User.name casing exactly.
    const newAssignee = ctx.newValue
      ? await prisma.user.findFirst({
          where: { isActive: true, name: { equals: ctx.newValue, mode: 'insensitive' } },
          select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } },
        })
      : null;

    const _currency = ctx.currency || 'USD';
    const fieldLabel: Record<AssignmentField, string> = {
      sales_rep: 'Sales Rep',
      manager: 'Manager',
      presales: 'Presales Assignee',
    };
    const variables: Record<string, string> = {
      dealName: ctx.opportunityTitle,
      opportunityTitle: ctx.opportunityTitle,
      opportunityId: ctx.opportunityId,
      assignmentField: fieldLabel[ctx.field],
      assignmentFieldKey: ctx.field,
      previousAssignee: ctx.previousValue || '(unassigned)',
      newAssignee: ctx.newValue || '(unassigned)',
      stage: ctx.stageName,
      stageName: ctx.stageName,
      client: ctx.clientName,
      clientName: ctx.clientName,
      owner: ctx.ownerName,
      ownerName: ctx.ownerName,
      salesRep: ctx.salesRepName,
      salesRepName: ctx.salesRepName,
      manager: ctx.managerName,
      managerName: ctx.managerName,
      presalesAssigneeName: ctx.presalesAssigneeName,
      updatedBy: ctx.updatedByName,
      userName: ctx.updatedByName,
      value: ctx.value != null ? fmtNum(Number(ctx.value)) : '',
      currency: _currency,
      'opportunity.currency': _currency,
      region: ctx.region || '',
      technology: ctx.technology || '',
      opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${ctx.opportunityId}`,
    };

    const calcFields = await resolveCalculatedFields(ctx.opportunityId);
    Object.assign(variables, calcFields);

    // Fallback path: no rules at all → still email the newly-assigned user
    // using the default template, so the feature works out-of-the-box.
    if (matched.length === 0 && newAssignee && !newAssignee.muteNotification) {
      const templateKey = ASSIGNMENT_DEFAULT_TEMPLATE[ctx.field];
      sendNotificationEmail(templateKey, newAssignee.email, newAssignee.name, variables);
      await prisma.notification.create({
        data: {
          type: 'assignment_change',
          title: `You were assigned as ${fieldLabel[ctx.field]} on "${ctx.opportunityTitle}"`,
          message: `${ctx.updatedByName} assigned you as ${fieldLabel[ctx.field]} for ${ctx.clientName}.`,
          link: `/dashboard/opportunities/${ctx.opportunityId}`,
          userId: newAssignee.id,
        },
      });
      console.log(`[NotificationEngine] assignment_change (no rules) ${ctx.field}: notified new assignee ${newAssignee.email}`);
      return;
    }

    for (const rule of matched) {
      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const recipientRolesCc = ((rule as any).recipientRolesCc as string[]) || [];
      const channels = (rule.channels as string[]) || [];
      if (channels.length === 0) continue;

      const recipientUsers = rule.recipientUsers as Record<string, string[]> | null;
      const toUsers = recipientRoles.length > 0
        ? await resolveAssignedRecipients(ctx.opportunityId, recipientRoles, recipientUsers)
        : [];

      // Always include the new assignee in To (deduped) so they're notified
      // even if their role isn't currently in recipientRoles for this rule.
      if (newAssignee && !toUsers.find(u => u.id === newAssignee.id)) {
        toUsers.push(newAssignee);
      }

      let ccUsers = recipientRolesCc.length > 0
        ? await resolveAssignedRecipients(ctx.opportunityId, recipientRolesCc, recipientUsers)
        : [];
      ccUsers = ccUsers.filter(u => !toUsers.find(t => t.id === u.id));

      if (toUsers.length === 0 && ccUsers.length === 0) continue;

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Assignment change: ${fieldLabel[ctx.field]} → ${ctx.newValue || '(unassigned)'}`;
      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `${ctx.updatedByName} set ${fieldLabel[ctx.field]} of "${ctx.opportunityTitle}" to ${ctx.newValue || '(unassigned)'}.`;

      if (channels.includes('in_app')) {
        for (const user of [...toUsers, ...ccUsers]) {
          await prisma.notification.create({
            data: {
              type: 'assignment_change',
              title,
              message,
              link: `/dashboard/opportunities/${ctx.opportunityId}`,
              userId: user.id,
            },
          });
        }
      }
      if (channels.includes('email')) {
        const templateKey = rule.emailTemplateKey || ASSIGNMENT_DEFAULT_TEMPLATE[ctx.field];
        const toEmails = toUsers.filter(u => !u.muteNotification).map(u => u.email);
        const ccEmails = ccUsers.filter(u => !u.muteNotification).map(u => u.email);
        if (toEmails.length > 0 || ccEmails.length > 0) {
          const primaryName = toUsers[0]?.name || ccUsers[0]?.name || 'Recipient';
          sendNotificationEmail(templateKey, toEmails, primaryName, variables, ccEmails);
        }
      }
      console.log(`[NotificationEngine] assignment_change rule "${rule.name}" (${ctx.field}): notified ${toUsers.length} To + ${ccUsers.length} CC via [${channels.join(', ')}]`);
    }
  } catch (error) {
    console.error('[NotificationEngine] Error evaluating assignment_change rules:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Opportunity change notice — fired when pipeline/sales/presales      */
/* fields are edited on an opportunity that has already moved past     */
/* Discovery. Stage transitions and assignment changes are handled by  */
/* their own evaluators; this covers everything else (description,     */
/* value, region, technology, pricing model, presalesData, salesData…).*/
/* Recipients:                                                          */
/*   To: assigned manager (offshore) + assigned presales (if any)      */
/*   Cc: salesperson (opp owner + named sales rep)                     */
/* The actor (the user making the change) is excluded from both lists  */
/* so they don't get a copy of their own edit.                         */
/* ------------------------------------------------------------------ */

interface OpportunityChangeNoticeContext {
  opportunityId: string;
  opportunityTitle: string;
  clientName: string;
  stageName: string;
  changes: string[];
  updatedByUserId: string;
  updatedByName: string;
  value?: number | null;
  currency?: string;
}

async function resolveUserByName(name: string | null | undefined) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  return prisma.user.findFirst({
    where: { isActive: true, name: { equals: trimmed, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, muteNotification: true },
  });
}

export async function evaluateOpportunityChangeNotice(
  ctx: OpportunityChangeNoticeContext
): Promise<void> {
  try {
    if (!ctx.changes || ctx.changes.length === 0) return;

    const opp = await prisma.opportunity.findUnique({
      where: { id: ctx.opportunityId },
      select: {
        ownerId: true,
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        salesRepName: true,
        managerName: true,
        presalesAssigneeName: true,
      },
    });
    if (!opp) return;

    // Resolve To: manager + all presales assignees (comma-separated)
    const toUsers: { id: string; email: string; name: string }[] = [];
    const managerUser = await resolveUserByName(opp.managerName);
    if (managerUser && !managerUser.muteNotification) {
      toUsers.push({ id: managerUser.id, email: managerUser.email, name: managerUser.name });
    }
    const presalesNames = (opp.presalesAssigneeName || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    for (const pname of presalesNames) {
      const pUser = await resolveUserByName(pname);
      if (pUser && !pUser.muteNotification && !toUsers.find(u => u.id === pUser.id)) {
        toUsers.push({ id: pUser.id, email: pUser.email, name: pUser.name });
      }
    }

    // Resolve Cc: owner (creator/salesperson) + named sales rep, deduped vs To
    const ccUsers: { id: string; email: string; name: string }[] = [];
    if (opp.owner && !opp.owner.muteNotification) {
      ccUsers.push({ id: opp.owner.id, email: opp.owner.email, name: opp.owner.name });
    }
    const salesRepUser = await resolveUserByName(opp.salesRepName);
    if (salesRepUser
      && !salesRepUser.muteNotification
      && !ccUsers.find(u => u.id === salesRepUser.id)) {
      ccUsers.push({ id: salesRepUser.id, email: salesRepUser.email, name: salesRepUser.name });
    }

    // Exclude the actor from both lists — they made the change, no self-notify
    const actorId = ctx.updatedByUserId;
    const toFiltered = toUsers.filter(u => u.id !== actorId);
    const ccFiltered = ccUsers
      .filter(u => u.id !== actorId)
      .filter(u => !toFiltered.find(t => t.id === u.id));

    if (toFiltered.length === 0 && ccFiltered.length === 0) {
      console.log(`[NotificationEngine] change_notice: no eligible recipients for opp ${ctx.opportunityId} — skipping`);
      return;
    }

    const currency = ctx.currency || 'USD';
    const valueStr = ctx.value != null ? `${currency} ${fmtNum(Number(ctx.value))}` : '';
    const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${ctx.opportunityId}`;

    const escape = (s: string) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const changesHtml = `<ul style="margin:8px 0 0 0;padding-left:20px;font-size:14px;line-height:1.6">${
      ctx.changes.map(c => `<li>${escape(c)}</li>`).join('')
    }</ul>`;

    const subject = `Q-CRM: Update on "${ctx.opportunityTitle}" (${ctx.stageName})`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5;margin:0 0 16px">Opportunity Updated</h2>
<p><strong>${escape(ctx.updatedByName)}</strong> updated the following opportunity that is currently in <strong>${escape(ctx.stageName)}</strong>:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Title</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(ctx.opportunityTitle)}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(ctx.clientName)}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(ctx.stageName)}</td></tr>
${valueStr ? `<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Value</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(valueStr)}</td></tr>` : ''}
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Updated by</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(ctx.updatedByName)}</td></tr>
</table>
<h3 style="font-size:15px;margin:16px 0 4px 0;color:#1f2937">Changes</h3>
${changesHtml}
<p style="margin-top:20px"><a href="${oppLink}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM. Sales (in CC) has updated pipeline/sales details on an opportunity that is no longer in the Pipeline stage.</p>
</div>`;

    await sendRawEmail(
      toFiltered.map(u => u.email),
      ccFiltered.map(u => u.email),
      subject,
      html,
      'change_notice'
    );

    // In-app notification for each To + Cc recipient
    for (const user of [...toFiltered, ...ccFiltered]) {
      await prisma.notification.create({
        data: {
          type: 'opportunity_change_notice',
          title: `Update on "${ctx.opportunityTitle}"`,
          message: `${ctx.updatedByName} updated ${ctx.changes.length} field(s): ${ctx.changes.slice(0, 3).join('; ')}${ctx.changes.length > 3 ? '…' : ''}`,
          link: `/dashboard/opportunities/${ctx.opportunityId}`,
          userId: user.id,
        },
      });
    }

    console.log(`[NotificationEngine] change_notice for opp ${ctx.opportunityId}: To=${toFiltered.length} Cc=${ccFiltered.length}, ${ctx.changes.length} change(s)`);
  } catch (error) {
    console.error('[NotificationEngine] Error sending opportunity change notice:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Comment added — fired when a team member posts a comment on an      */
/* opportunity. Notifies the assigned deal team and every active Admin */
/* so the responsible people see activity on their deals. The comment  */
/* author is excluded from all lists (no self-notify).                 */
/*   To: owner (salesperson) + sales rep + manager + presales assignee */
/*   Cc: all active Admins                                             */
/* Delivered via in-app notification (every recipient) and email.      */
/* Fire-and-forget: errors are caught and logged, never block the      */
/* comment write.                                                      */
/* ------------------------------------------------------------------ */

interface CommentNotificationContext {
  opportunityId: string;
  commentContent: string;
  commentStage?: string | null;
  authorUserId: string;
  authorName: string;
}

export async function evaluateCommentNotification(
  ctx: CommentNotificationContext
): Promise<void> {
  try {
    const content = (ctx.commentContent || '').trim();
    if (!content) return;

    const opp = await prisma.opportunity.findUnique({
      where: { id: ctx.opportunityId },
      select: {
        title: true,
        currentStage: true,
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        salesRepName: true,
        managerName: true,
        presalesAssigneeName: true,
        client: { select: { name: true } },
        stage: { select: { name: true } },
      },
    });
    if (!opp) return;

    type Recipient = { id: string; email: string; name: string; muteNotification: boolean };

    // Deal team (To). Dedupe by user id; never include the comment author.
    const toUsers: Recipient[] = [];
    const seen = new Set<string>([ctx.authorUserId]);
    const addTo = (u: Recipient | null) => {
      if (!u || seen.has(u.id)) return;
      seen.add(u.id);
      toUsers.push(u);
    };
    if (opp.owner) addTo(opp.owner);
    addTo(await resolveUserByName(opp.salesRepName));
    addTo(await resolveUserByName(opp.managerName));
    for (const pname of (opp.presalesAssigneeName || '').split(',').map(s => s.trim()).filter(Boolean)) {
      addTo(await resolveUserByName(pname));
    }

    // Cc = every active Admin (global role), deduped vs the To list + author.
    const admins = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { name: { in: GLOBAL_ROLES } } } },
      select: { id: true, email: true, name: true, muteNotification: true },
    });
    const ccUsers = admins.filter(a => !seen.has(a.id));
    ccUsers.forEach(a => seen.add(a.id));

    if (toUsers.length === 0 && ccUsers.length === 0) {
      console.log(`[NotificationEngine] comment_added: no eligible recipients for opp ${ctx.opportunityId} — skipping`);
      return;
    }

    const stageName = opp.stage?.name || opp.currentStage || ctx.commentStage || '';
    const clientName = opp.client?.name || '';
    const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${ctx.opportunityId}`;

    const escape = (s: string) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const commentHtml = escape(content).replace(/\n/g, '<br/>');
    const subject = `Q-CRM: New comment on "${opp.title}"${stageName ? ` (${stageName})` : ''}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5;margin:0 0 16px">New Comment</h2>
<p><strong>${escape(ctx.authorName)}</strong> added a comment on the following opportunity${stageName ? ` (currently in <strong>${escape(stageName)}</strong>)` : ''}:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(opp.title)}</td></tr>
${clientName ? `<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(clientName)}</td></tr>` : ''}
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Comment by</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escape(ctx.authorName)}</td></tr>
</table>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;font-size:14px;line-height:1.6;color:#1f2937">${commentHtml}</div>
<p style="margin-top:20px"><a href="${oppLink}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM. You are receiving it because you are assigned to this opportunity or are an administrator.</p>
</div>`;

    const toEmails = toUsers.filter(u => !u.muteNotification).map(u => u.email);
    const ccEmails = ccUsers.filter(u => !u.muteNotification).map(u => u.email);
    await sendRawEmail(toEmails, ccEmails, subject, html, 'comment_added');

    // In-app notification for every To + Cc recipient.
    const preview = content.length > 140 ? `${content.slice(0, 140)}…` : content;
    for (const user of [...toUsers, ...ccUsers]) {
      await prisma.notification.create({
        data: {
          type: 'comment_added',
          title: `New comment on "${opp.title}"`,
          message: `${ctx.authorName} commented: "${preview}"`,
          link: `/dashboard/opportunities/${ctx.opportunityId}`,
          userId: user.id,
        },
      });
    }

    console.log(`[NotificationEngine] comment_added for opp ${ctx.opportunityId}: To=${toUsers.length} Cc=${ccUsers.length}`);
  } catch (error) {
    console.error('[NotificationEngine] Error sending comment notification:', error);
  }
}

/**
 * Stale-opportunity reminders.
 *
 * Fully admin-controlled via NotificationRule rows (triggerType='stalled_deal',
 * ruleType='time_driven', isActive=true) and an EmailTemplate keyed by the
 * rule's emailTemplateKey. The job is a no-op if no active rule exists.
 *
 * Per rule, the function:
 *  - reads thresholdDays from rule.conditions (looks for field='daysSinceUpdate',
 *    falls back to 'daysInStage', then to 3)
 *  - scans open opportunities (not Closed Won / Lost / Delivered) whose
 *    updatedAt is older than the threshold
 *  - resolves the current stage's owner -> TO and other involved parties ->
 *    Cc. The rule's recipientRolesCc adds additional Cc users (e.g. all
 *    Admins). The rule's recipientRoles are advisory; the stage-owner-in-TO
 *    policy is the canonical recipient strategy.
 *  - delivers via the rule's channels (in_app and/or email). For email it
 *    renders the rule's emailTemplateKey template; for in_app it renders the
 *    rule's titleTemplate / messageTemplate.
 *
 * A 20-hour cooldown stamp on opportunity.metadata.lastStaleReminderAt keeps
 * the same deal from being re-notified if the job fires more than once in
 * the same window.
 */
const CLOSED_STAGES_FOR_REMINDER = new Set<string>([
  'Closed Won',
  'Closed-Won',
  'Closed Lost',
  'Proposal Lost',
  'Delivered',
]);

function pickStageOwnerRole(stageName: string): 'sales' | 'presales' | 'owner' {
  const s = (stageName || '').trim();
  if (s === 'Qualification' || s === 'Presales') return 'presales';
  if (s === 'Pipeline' || s === 'Discovery' || s === 'Proposal' || s === 'Sales' || s === 'Negotiation') return 'sales';
  return 'owner';
}

function extractThresholdDays(conditions: any, fallback: number): number {
  if (!Array.isArray(conditions)) return fallback;
  const dayCond = conditions.find((c: any) => c?.field === 'daysSinceUpdate')
    || conditions.find((c: any) => c?.field === 'daysInStage');
  if (!dayCond) return fallback;
  const n = Number(dayCond.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface StaleReminderOptions {
  cooldownHours?: number;          // skip if reminded within this window (default 20h)
  dryRun?: boolean;                // log only, do not send
}

export interface StaleReminderResult {
  rulesEvaluated: number;
  scanned: number;
  reminded: number;
  skippedClosed: number;
  skippedOnHold: number;
  skippedRecent: number;
  skippedNoRecipients: number;
}

export async function evaluateStaleOpportunityReminders(
  options: StaleReminderOptions = {}
): Promise<StaleReminderResult> {
  const cooldownHours = Number.isFinite(options.cooldownHours) && (options.cooldownHours as number) > 0
    ? (options.cooldownHours as number)
    : 20;
  const dryRun = !!options.dryRun;

  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true, triggerType: 'stalled_deal' },
  });

  const result: StaleReminderResult = {
    rulesEvaluated: rules.length,
    scanned: 0,
    reminded: 0,
    skippedClosed: 0,
    skippedOnHold: 0,
    skippedRecent: 0,
    skippedNoRecipients: 0,
  };

  if (rules.length === 0) {
    console.log('[StaleReminder] no active stalled_deal rules — skipping');
    return result;
  }

  const now = new Date();
  const cooldownDate = new Date(now.getTime() - cooldownHours * 3600000);
  const timeDrivenOverrideEmail = await getTimeDrivenReminderOverrideEmail();

  for (const rule of rules) {
    const thresholdDays = extractThresholdDays(rule.conditions, 3);
    const channels = (rule.channels as string[]) || [];
    const sendEmail = channels.includes('email');
    const sendInApp = channels.includes('in_app');
    const ccRoles = ((rule as any).recipientRolesCc as string[]) || [];

    const thresholdDate = new Date(now.getTime() - thresholdDays * 86400000);
    const stale = await prisma.opportunity.findMany({
      where: { updatedAt: { lt: thresholdDate } },
      select: {
        id: true, title: true, currentStage: true, ownerId: true, updatedAt: true,
        detailedStatus: true, isStalled: true,
        metadata: true, salesRepName: true, managerName: true, presalesAssigneeName: true,
        currency: true, value: true, expectedCloseDate: true,
        client: { select: { name: true } },
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        stage: { select: { name: true } },
      },
    });
    result.scanned += stale.length;

    // Additional CC pool — users matching the rule's recipientRolesCc (e.g. all Admins)
    const extraCcUsers = ccRoles.length > 0
      ? await resolveAssignedRecipients('__none__', ccRoles, null).catch(() => [])
      : [];
    // resolveAssignedRecipients filters by opportunity, but Admin role is global
    // there, so we pass a dummy opportunityId and only keep global hits. For
    // non-admin CC roles we re-resolve per-opportunity below.

    for (const opp of stale) {
      const stageName = opp.stage?.name || opp.currentStage || '';
      if (CLOSED_STAGES_FOR_REMINDER.has(stageName)) {
        result.skippedClosed += 1;
        continue;
      }

      // On Hold deals are intentionally paused, so the "no update in N days"
      // nag does not apply. The On Hold toggle sets both isStalled and
      // detailedStatus='On Hold' together (opportunity detail page), but we
      // check both defensively in case only one was set on legacy rows.
      if (opp.isStalled || opp.detailedStatus === 'On Hold') {
        result.skippedOnHold += 1;
        continue;
      }

      const meta = (opp.metadata as any) || {};
      const lastSent = meta?.lastStaleReminderAt ? new Date(meta.lastStaleReminderAt) : null;
      if (lastSent && lastSent > cooldownDate) {
        result.skippedRecent += 1;
        continue;
      }

      const involved: { id: string; email: string; name: string; role: 'owner' | 'sales' | 'manager' | 'presales' }[] = [];
      const seen = new Set<string>();
      const addInvolved = (u: { id: string; email: string; name: string; muteNotification?: boolean } | null, role: 'owner' | 'sales' | 'manager' | 'presales') => {
        if (!u || u.muteNotification || seen.has(u.id)) return;
        seen.add(u.id);
        involved.push({ id: u.id, email: u.email, name: u.name, role });
      };
      addInvolved(opp.owner, 'owner');
      addInvolved(await resolveUserByName(opp.salesRepName), 'sales');
      addInvolved(await resolveUserByName(opp.managerName), 'manager');
      const presalesNames = (opp.presalesAssigneeName || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      for (const pname of presalesNames) {
        addInvolved(await resolveUserByName(pname), 'presales');
      }
      if (involved.length === 0) {
        result.skippedNoRecipients += 1;
        continue;
      }

      // Stage owner -> TO; everyone else involved -> Cc
      const ownerRole = pickStageOwnerRole(stageName);
      let toUsers = involved.filter(u => u.role === ownerRole);
      if (toUsers.length === 0) {
        if (ownerRole === 'presales') toUsers = involved.filter(u => u.role === 'sales');
        if (toUsers.length === 0) toUsers = involved.filter(u => u.role === 'owner');
        if (toUsers.length === 0) toUsers = [involved[0]];
      }
      const toIds = new Set(toUsers.map(u => u.id));
      const ccUsers = involved.filter(u => !toIds.has(u.id));

      // Per-opp Cc roles (Manager/Presales/Sales) — re-resolve so the rule's
      // CC selection actually targets opp-assigned users, not the org pool.
      let perOppCcUsers: typeof ccUsers = [];
      const oppScopedCcRoles = ccRoles.filter(r => r !== 'Admin');
      if (oppScopedCcRoles.length > 0) {
        try {
          const extra = await resolveAssignedRecipients(opp.id, oppScopedCcRoles, null);
          perOppCcUsers = extra
            .filter(u => !toIds.has(u.id))
            .filter(u => !ccUsers.find(c => c.id === u.id))
            .map(u => ({ id: u.id, email: u.email, name: u.name, role: 'owner' as const }));
        } catch { /* ignore */ }
      }
      const allCcUsers = [...ccUsers, ...perOppCcUsers, ...extraCcUsers
        .filter(u => !toIds.has(u.id))
        .filter(u => !ccUsers.find(c => c.id === u.id))
        .filter(u => !perOppCcUsers.find(c => c.id === u.id))
        .map(u => ({ id: u.id, email: u.email, name: u.name, role: 'owner' as const }))];

      if (toUsers.length === 0) {
        result.skippedNoRecipients += 1;
        continue;
      }

      const daysIdle = Math.floor((now.getTime() - opp.updatedAt.getTime()) / 86400000);
      const lastUpdatedDate = opp.updatedAt.toISOString().slice(0, 10);
      const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opp.id}`;
      const oppCurrency = opp.currency || 'USD';

      const variables: Record<string, string> = {
        opportunityTitle: opp.title,
        dealName: opp.title,
        opportunityId: opp.id,
        client: opp.client?.name || '',
        clientName: opp.client?.name || '',
        stage: stageName,
        stageName,
        currentStage: stageName,
        owner: opp.owner?.name || '',
        ownerName: opp.owner?.name || '',
        salesRep: opp.salesRepName || '',
        salesRepName: opp.salesRepName || '',
        manager: opp.managerName || '',
        managerName: opp.managerName || '',
        presales: opp.presalesAssigneeName || '',
        presalesAssigneeName: opp.presalesAssigneeName || '',
        daysIdle: String(daysIdle),
        daysSinceUpdate: String(daysIdle),
        lastUpdatedDate,
        value: opp.value != null ? fmtNum(Number(opp.value)) : '',
        currency: oppCurrency,
        'opportunity.currency': oppCurrency,
        expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().slice(0, 10) : '',
        opportunityLink: oppLink,
        stageOwner: toUsers.map(u => u.name).join(', '),
      };

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `No update in ${daysIdle} day${daysIdle === 1 ? '' : 's'}: "${opp.title}"`;
      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `${stageName} stage — last updated ${lastUpdatedDate}.`;

      if (dryRun) {
        console.log(`[StaleReminder][dry] rule="${rule.name}" opp=${opp.id} "${opp.title}" stage=${stageName} idle=${daysIdle}d to=${toUsers.map(u => u.name).join(',')} cc=${allCcUsers.map(u => u.name).join(',')}`);
      } else {
        if (sendEmail) {
          const eventKey = rule.emailTemplateKey || 'stalled_opportunity';
          const toEmails = timeDrivenOverrideEmail ? [timeDrivenOverrideEmail] : toUsers.map(u => u.email);
          const toNames = timeDrivenOverrideEmail ? timeDrivenOverrideEmail : toUsers.map(u => u.name).join(', ');
          const ccEmails = timeDrivenOverrideEmail ? [] : allCcUsers.map(u => u.email);
          await sendNotificationEmail(
            eventKey,
            toEmails,
            toNames,
            variables,
            ccEmails,
            { isTimeDriven: true }
          ).catch(err => console.error('[StaleReminder] email send failed:', err));
        }
        if (sendInApp) {
          for (const u of [...toUsers, ...allCcUsers]) {
            await prisma.notification.create({
              data: {
                type: 'stale_opportunity_reminder',
                title,
                message,
                link: `/dashboard/opportunities/${opp.id}`,
                userId: u.id,
              },
            });
          }
        }

        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { metadata: { ...meta, lastStaleReminderAt: now.toISOString() } },
        });

        result.reminded += 1;
        console.log(`[StaleReminder] rule="${rule.name}" opp=${opp.id} "${opp.title}" stage=${stageName} idle=${daysIdle}d to=${toUsers.length} cc=${allCcUsers.length}`);
      }
    }
  }

  console.log(`[StaleReminder] scan complete: rules=${result.rulesEvaluated} scanned=${result.scanned} reminded=${result.reminded} skippedClosed=${result.skippedClosed} skippedOnHold=${result.skippedOnHold} skippedRecent=${result.skippedRecent} skippedNoRecipients=${result.skippedNoRecipients}`);
  return result;
}

/* -------------------------------------------------------------------------
 * Start-date approaching reminders (time-driven, triggerType="start_date_approaching")
 *
 * Daily scan. For every active rule with triggerType=start_date_approaching,
 * read the day window from conditions (field="daysToStartDate", operator="lte"
 * or "lt"; default 7) and find every open opportunity whose tentativeStartDate
 * falls between today and today + N days. Send a reminder asking sales to
 * confirm or update the start date.
 *
 * Recipients (dynamic; rule.recipientRolesCc adds extras):
 *   To: Sales rep (falls back to owner)
 *   Cc: manager + presales assignees + owner (deduped)
 *
 * Cooldown stamp lives at opportunity.metadata.lastStartDateReminderAt so we
 * don't double-send within a 20h window.
 * ------------------------------------------------------------------------- */

function extractDaysWindow(conditions: any, fieldName: string, fallback: number): number {
  if (!Array.isArray(conditions)) return fallback;
  const cond = conditions.find((c: any) => c?.field === fieldName);
  if (!cond) return fallback;
  const n = Number(cond.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface StartDateReminderResult {
  rulesEvaluated: number;
  scanned: number;
  reminded: number;
  skippedClosed: number;
  skippedNoStartDate: number;
  skippedRecent: number;
  skippedNoRecipients: number;
}

export async function evaluateStartDateApproachingReminders(): Promise<StartDateReminderResult> {
  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true, triggerType: 'start_date_approaching' },
  });

  const result: StartDateReminderResult = {
    rulesEvaluated: rules.length,
    scanned: 0,
    reminded: 0,
    skippedClosed: 0,
    skippedNoStartDate: 0,
    skippedRecent: 0,
    skippedNoRecipients: 0,
  };

  if (rules.length === 0) {
    console.log('[StartDateReminder] no active start_date_approaching rules — skipping');
    return result;
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const cooldownDate = new Date(now.getTime() - 20 * 3600000);
  const timeDrivenOverrideEmail = await getTimeDrivenReminderOverrideEmail();

  for (const rule of rules) {
    const daysWindow = extractDaysWindow(rule.conditions, 'daysToStartDate', 7);
    const channels = (rule.channels as string[]) || [];
    const sendEmail = channels.includes('email');
    const sendInApp = channels.includes('in_app');
    const ccRoles = ((rule as any).recipientRolesCc as string[]) || [];

    const windowEnd = new Date(today.getTime() + daysWindow * 86400000);
    const approaching = await prisma.opportunity.findMany({
      where: {
        tentativeStartDate: { gte: today, lte: windowEnd },
      },
      select: {
        id: true, title: true, currentStage: true, ownerId: true,
        metadata: true, salesRepName: true, managerName: true, presalesAssigneeName: true,
        currency: true, value: true, tentativeStartDate: true, expectedCloseDate: true,
        client: { select: { name: true } },
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        stage: { select: { name: true } },
      },
    });
    result.scanned += approaching.length;

    for (const opp of approaching) {
      const stageName = opp.stage?.name || opp.currentStage || '';
      if (CLOSED_STAGES_FOR_REMINDER.has(stageName)) {
        result.skippedClosed += 1;
        continue;
      }
      if (!opp.tentativeStartDate) {
        result.skippedNoStartDate += 1;
        continue;
      }

      const meta = (opp.metadata as any) || {};
      const lastSent = meta?.lastStartDateReminderAt ? new Date(meta.lastStartDateReminderAt) : null;
      if (lastSent && lastSent > cooldownDate) {
        result.skippedRecent += 1;
        continue;
      }

      // Build "involved" set
      const involved: { id: string; email: string; name: string; role: 'owner' | 'sales' | 'manager' | 'presales' }[] = [];
      const seen = new Set<string>();
      const addInvolved = (u: { id: string; email: string; name: string; muteNotification?: boolean } | null, role: 'owner' | 'sales' | 'manager' | 'presales') => {
        if (!u || u.muteNotification || seen.has(u.id)) return;
        seen.add(u.id);
        involved.push({ id: u.id, email: u.email, name: u.name, role });
      };
      addInvolved(opp.owner, 'owner');
      addInvolved(await resolveUserByName(opp.salesRepName), 'sales');
      addInvolved(await resolveUserByName(opp.managerName), 'manager');
      for (const pname of (opp.presalesAssigneeName || '').split(',').map(s => s.trim()).filter(Boolean)) {
        addInvolved(await resolveUserByName(pname), 'presales');
      }
      if (involved.length === 0) {
        result.skippedNoRecipients += 1;
        continue;
      }

      // To = Sales rep (fallback owner); Cc = the rest
      let toUsers = involved.filter(u => u.role === 'sales');
      if (toUsers.length === 0) toUsers = involved.filter(u => u.role === 'owner');
      if (toUsers.length === 0) toUsers = [involved[0]];
      const toIds = new Set(toUsers.map(u => u.id));
      const ccUsers = involved.filter(u => !toIds.has(u.id));

      // rule.recipientRolesCc -> extra opp-scoped CCs (e.g. Admin global pool)
      let extraCcUsers: typeof ccUsers = [];
      if (ccRoles.length > 0) {
        try {
          const extra = await resolveAssignedRecipients(opp.id, ccRoles, null);
          extraCcUsers = extra
            .filter(u => !toIds.has(u.id))
            .filter(u => !ccUsers.find(c => c.id === u.id))
            .map(u => ({ id: u.id, email: u.email, name: u.name, role: 'owner' as const }));
        } catch { /* ignore */ }
      }
      const allCcUsers = [...ccUsers, ...extraCcUsers];

      const startDateStr = opp.tentativeStartDate.toISOString().slice(0, 10);
      const daysToStart = Math.max(0, Math.ceil((opp.tentativeStartDate.getTime() - today.getTime()) / 86400000));
      const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opp.id}`;
      const oppCurrency = opp.currency || 'USD';

      const variables: Record<string, string> = {
        opportunityTitle: opp.title,
        opportunityId: opp.id,
        client: opp.client?.name || '',
        clientName: opp.client?.name || '',
        stage: stageName,
        stageName,
        currentStage: stageName,
        owner: opp.owner?.name || '',
        ownerName: opp.owner?.name || '',
        salesRep: opp.salesRepName || '',
        salesRepName: opp.salesRepName || '',
        manager: opp.managerName || '',
        managerName: opp.managerName || '',
        presales: opp.presalesAssigneeName || '',
        tentativeStartDate: startDateStr,
        daysToStartDate: String(daysToStart),
        expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().slice(0, 10) : '',
        value: opp.value != null ? fmtNum(Number(opp.value)) : '',
        currency: oppCurrency,
        opportunityLink: oppLink,
      };

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Start date in ${daysToStart} day${daysToStart === 1 ? '' : 's'}: "${opp.title}"`;
      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `Tentative Start Date ${startDateStr} is approaching — confirm or update.`;

      if (sendEmail) {
        const eventKey = rule.emailTemplateKey || 'start_date_approaching';
        const toEmails = timeDrivenOverrideEmail ? [timeDrivenOverrideEmail] : toUsers.map(u => u.email);
        const toNames = timeDrivenOverrideEmail ? timeDrivenOverrideEmail : toUsers.map(u => u.name).join(', ');
        const ccEmails = timeDrivenOverrideEmail ? [] : allCcUsers.map(u => u.email);
        await sendNotificationEmail(
          eventKey,
          toEmails,
          toNames,
          variables,
          ccEmails,
          { isTimeDriven: true }
        ).catch(err => console.error('[StartDateReminder] email send failed:', err));
      }
      if (sendInApp) {
        for (const u of [...toUsers, ...allCcUsers]) {
          await prisma.notification.create({
            data: {
              type: 'start_date_approaching',
              title,
              message,
              link: `/dashboard/opportunities/${opp.id}`,
              userId: u.id,
            },
          });
        }
      }

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { metadata: { ...meta, lastStartDateReminderAt: now.toISOString() } },
      });

      result.reminded += 1;
      console.log(`[StartDateReminder] rule="${rule.name}" opp=${opp.id} "${opp.title}" startsIn=${daysToStart}d to=${toUsers.length} cc=${allCcUsers.length}`);
    }
  }

  console.log(`[StartDateReminder] scan complete: rules=${result.rulesEvaluated} scanned=${result.scanned} reminded=${result.reminded} skippedClosed=${result.skippedClosed} skippedNoStartDate=${result.skippedNoStartDate} skippedRecent=${result.skippedRecent} skippedNoRecipients=${result.skippedNoRecipients}`);
  return result;
}

/* -------------------------------------------------------------------------
 * Start-date overdue workflow (time-driven, triggerType="start_date_overdue")
 *
 * Daily scan. For every active rule with triggerType=start_date_overdue, find
 * every opportunity whose tentativeStartDate has slipped past today AND is
 * still open (any stage other than Closed Won / Closed-Won / Closed Lost /
 * Proposal Lost / Delivered).
 *
 * Workflow actions when an overdue is detected and the opportunity is not
 * already in Qualification + Extended:
 *   - currentStage      -> Qualification
 *   - detailedStatus    -> "Extended"
 *   - gomApproved       -> false (re-approval required after re-estimation)
 *   - reEstimateCount++
 *   - tentativeDuration / tentativeDurationUnit untouched (per spec:
 *     "reevaluate of the same duration")
 *
 * Then send a daily notification asking Sales to update the revised start
 * date. Recipients (dynamic; rule.recipientRolesCc adds extras):
 *   To: Sales rep (fallback owner)
 *   Cc: manager + presales assignees + owner (deduped)
 *
 * Cooldown lives at opportunity.metadata.lastOverdueStartReminderAt so we
 * don't re-notify within a 20h window if the job runs more than once a day.
 * ------------------------------------------------------------------------- */

export interface StartDateOverdueResult {
  rulesEvaluated: number;
  scanned: number;
  reverted: number;
  notified: number;
  skippedClosed: number;
  skippedNoStartDate: number;
  skippedRecent: number;
  skippedNoRecipients: number;
}

export async function evaluateStartDateOverdueWorkflow(): Promise<StartDateOverdueResult> {
  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true, triggerType: 'start_date_overdue' },
  });

  const result: StartDateOverdueResult = {
    rulesEvaluated: rules.length,
    scanned: 0,
    reverted: 0,
    notified: 0,
    skippedClosed: 0,
    skippedNoStartDate: 0,
    skippedRecent: 0,
    skippedNoRecipients: 0,
  };

  if (rules.length === 0) {
    console.log('[StartDateOverdue] no active start_date_overdue rules — skipping');
    return result;
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const cooldownDate = new Date(now.getTime() - 20 * 3600000);
  const timeDrivenOverrideEmail = await getTimeDrivenReminderOverrideEmail();

  // Resolve Qualification stage once per run.
  const qualStage = await prisma.stage.findFirst({ where: { name: 'Qualification' } });
  if (!qualStage) {
    console.warn('[StartDateOverdue] Qualification stage not found — cannot perform auto-revert; skipping rule run');
    return result;
  }

  for (const rule of rules) {
    const channels = (rule.channels as string[]) || [];
    const sendEmail = channels.includes('email');
    const sendInApp = channels.includes('in_app');
    const ccRoles = ((rule as any).recipientRolesCc as string[]) || [];

    const overdue = await prisma.opportunity.findMany({
      where: { tentativeStartDate: { lt: today, not: null } },
      select: {
        id: true, title: true, currentStage: true, detailedStatus: true,
        gomApproved: true, reEstimateCount: true, ownerId: true, metadata: true,
        salesRepName: true, managerName: true, presalesAssigneeName: true,
        currency: true, value: true, tentativeStartDate: true, expectedCloseDate: true,
        tentativeDuration: true, tentativeDurationUnit: true,
        client: { select: { name: true } },
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        stage: { select: { name: true } },
      },
    });
    result.scanned += overdue.length;

    for (const opp of overdue) {
      const stageName = opp.stage?.name || opp.currentStage || '';
      if (CLOSED_STAGES_FOR_REMINDER.has(stageName)) {
        result.skippedClosed += 1;
        continue;
      }
      if (!opp.tentativeStartDate) {
        result.skippedNoStartDate += 1;
        continue;
      }

      const meta = (opp.metadata as any) || {};
      const lastSent = meta?.lastOverdueStartReminderAt ? new Date(meta.lastOverdueStartReminderAt) : null;
      if (lastSent && lastSent > cooldownDate) {
        result.skippedRecent += 1;
        continue;
      }

      const daysOverdue = Math.max(1, Math.ceil((today.getTime() - opp.tentativeStartDate.getTime()) / 86400000));
      const previousStage = stageName;

      // Workflow auto-revert: move to Qualification + Extended status unless
      // already there. Always reset gomApproved on detection (a passed start
      // date invalidates any prior approval).
      const alreadyExtendedInQual = stageName === 'Qualification' && opp.detailedStatus === 'Extended';
      if (!alreadyExtendedInQual) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            stageId: qualStage.id,
            currentStage: 'Qualification',
            detailedStatus: 'Extended',
            gomApproved: false,
            reEstimateCount: (opp.reEstimateCount ?? 0) + 1,
          },
        });
        // The auto-revert is a real stage move — keep the timeline honest.
        await recordStageEntry(opp.id, qualStage.id);
        result.reverted += 1;
        console.log(`[StartDateOverdue] reverted opp=${opp.id} "${opp.title}" prev=${previousStage} overdueBy=${daysOverdue}d`);
      }

      // Build "involved" set for notification dispatch
      const involved: { id: string; email: string; name: string; role: 'owner' | 'sales' | 'manager' | 'presales' }[] = [];
      const seen = new Set<string>();
      const addInvolved = (u: { id: string; email: string; name: string; muteNotification?: boolean } | null, role: 'owner' | 'sales' | 'manager' | 'presales') => {
        if (!u || u.muteNotification || seen.has(u.id)) return;
        seen.add(u.id);
        involved.push({ id: u.id, email: u.email, name: u.name, role });
      };
      addInvolved(opp.owner, 'owner');
      addInvolved(await resolveUserByName(opp.salesRepName), 'sales');
      addInvolved(await resolveUserByName(opp.managerName), 'manager');
      for (const pname of (opp.presalesAssigneeName || '').split(',').map(s => s.trim()).filter(Boolean)) {
        addInvolved(await resolveUserByName(pname), 'presales');
      }
      if (involved.length === 0) {
        result.skippedNoRecipients += 1;
        continue;
      }

      // To = Sales rep (fallback owner); Cc = the rest
      let toUsers = involved.filter(u => u.role === 'sales');
      if (toUsers.length === 0) toUsers = involved.filter(u => u.role === 'owner');
      if (toUsers.length === 0) toUsers = [involved[0]];
      const toIds = new Set(toUsers.map(u => u.id));
      const ccUsers = involved.filter(u => !toIds.has(u.id));

      let extraCcUsers: typeof ccUsers = [];
      if (ccRoles.length > 0) {
        try {
          const extra = await resolveAssignedRecipients(opp.id, ccRoles, null);
          extraCcUsers = extra
            .filter(u => !toIds.has(u.id))
            .filter(u => !ccUsers.find(c => c.id === u.id))
            .map(u => ({ id: u.id, email: u.email, name: u.name, role: 'owner' as const }));
        } catch { /* ignore */ }
      }
      const allCcUsers = [...ccUsers, ...extraCcUsers];

      const startDateStr = opp.tentativeStartDate.toISOString().slice(0, 10);
      const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opp.id}`;
      const oppCurrency = opp.currency || 'USD';
      const durationStr = opp.tentativeDuration
        ? `${opp.tentativeDuration} ${opp.tentativeDurationUnit || ''}`.trim()
        : '';

      const variables: Record<string, string> = {
        opportunityTitle: opp.title,
        opportunityId: opp.id,
        client: opp.client?.name || '',
        clientName: opp.client?.name || '',
        stage: 'Qualification',
        stageName: 'Qualification',
        currentStage: 'Qualification',
        previousStage,
        detailedStatus: 'Extended',
        owner: opp.owner?.name || '',
        ownerName: opp.owner?.name || '',
        salesRep: opp.salesRepName || '',
        salesRepName: opp.salesRepName || '',
        manager: opp.managerName || '',
        managerName: opp.managerName || '',
        presales: opp.presalesAssigneeName || '',
        tentativeStartDate: startDateStr,
        oldStartDate: startDateStr,
        daysOverdue: String(daysOverdue),
        tentativeDuration: opp.tentativeDuration || '',
        tentativeDurationUnit: opp.tentativeDurationUnit || '',
        duration: durationStr,
        reEstimateCount: String(opp.reEstimateCount ?? 0),
        expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().slice(0, 10) : '',
        value: opp.value != null ? fmtNum(Number(opp.value)) : '',
        currency: oppCurrency,
        opportunityLink: oppLink,
      };

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Start date overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}: "${opp.title}"`;
      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `Start date ${startDateStr} has passed — please update with revised date. Opportunity moved back to Qualification for re-estimation.`;

      if (sendEmail) {
        const eventKey = rule.emailTemplateKey || 'start_date_overdue';
        const toEmails = timeDrivenOverrideEmail ? [timeDrivenOverrideEmail] : toUsers.map(u => u.email);
        const toNames = timeDrivenOverrideEmail ? timeDrivenOverrideEmail : toUsers.map(u => u.name).join(', ');
        const ccEmails = timeDrivenOverrideEmail ? [] : allCcUsers.map(u => u.email);
        await sendNotificationEmail(
          eventKey,
          toEmails,
          toNames,
          variables,
          ccEmails,
          { isTimeDriven: true }
        ).catch(err => console.error('[StartDateOverdue] email send failed:', err));
      }
      if (sendInApp) {
        for (const u of [...toUsers, ...allCcUsers]) {
          await prisma.notification.create({
            data: {
              type: 'start_date_overdue',
              title,
              message,
              link: `/dashboard/opportunities/${opp.id}`,
              userId: u.id,
            },
          });
        }
      }

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { metadata: { ...meta, lastOverdueStartReminderAt: now.toISOString() } },
      });
      result.notified += 1;
    }
  }

  console.log(`[StartDateOverdue] scan complete: rules=${result.rulesEvaluated} scanned=${result.scanned} reverted=${result.reverted} notified=${result.notified} skippedClosed=${result.skippedClosed} skippedNoStartDate=${result.skippedNoStartDate} skippedRecent=${result.skippedRecent} skippedNoRecipients=${result.skippedNoRecipients}`);
  return result;
}

/* -------------------------------------------------------------------------
 * "Opportunity Extended" event notification (event-driven,
 * triggerType="opportunity_extended").
 *
 * Fired by the opportunities PATCH handler when a Sales-role user updates
 * tentativeStartDate on an opportunity whose stage is post-proposal
 * (Proposal / Negotiation). The PATCH handler is responsible for the workflow
 * changes (stage->Qualification, detailedStatus='Extended', gomApproved=false,
 * reEstimateCount++, close-date auto-bump). This function only handles the
 * notification side.
 *
 * Recipients (dynamic; rule.recipientRolesCc adds extras):
 *   To: Presales assignee(s) (fallback Manager, then Sales rep, then Owner)
 *   Cc: Sales rep + Manager + Owner (the rest of the involved set)
 * ------------------------------------------------------------------------- */

export async function evaluateExtendedNotification(opportunityId: string, updatedByName: string, previousStage: string): Promise<void> {
  try {
    const rules = await prisma.notificationRule.findMany({
      where: { isActive: true, triggerType: 'opportunity_extended' },
    });
    if (rules.length === 0) {
      console.log('[ExtendedNotice] no active opportunity_extended rules — skipping');
      return;
    }

    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true, title: true, currentStage: true, detailedStatus: true,
        salesRepName: true, managerName: true, presalesAssigneeName: true,
        currency: true, value: true, tentativeStartDate: true, expectedCloseDate: true,
        reEstimateCount: true,
        client: { select: { name: true } },
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        stage: { select: { name: true } },
      },
    });
    if (!opp) return;

    for (const rule of rules) {
      const channels = (rule.channels as string[]) || [];
      const sendEmail = channels.includes('email');
      const sendInApp = channels.includes('in_app');
      const ccRoles = ((rule as any).recipientRolesCc as string[]) || [];

      // Build "involved" set
      const involved: { id: string; email: string; name: string; role: 'owner' | 'sales' | 'manager' | 'presales' }[] = [];
      const seen = new Set<string>();
      const addInvolved = (u: { id: string; email: string; name: string; muteNotification?: boolean } | null, role: 'owner' | 'sales' | 'manager' | 'presales') => {
        if (!u || u.muteNotification || seen.has(u.id)) return;
        seen.add(u.id);
        involved.push({ id: u.id, email: u.email, name: u.name, role });
      };
      addInvolved(opp.owner, 'owner');
      addInvolved(await resolveUserByName(opp.salesRepName), 'sales');
      addInvolved(await resolveUserByName(opp.managerName), 'manager');
      for (const pname of (opp.presalesAssigneeName || '').split(',').map(s => s.trim()).filter(Boolean)) {
        addInvolved(await resolveUserByName(pname), 'presales');
      }
      if (involved.length === 0) continue;

      // To = Presales (fallback Manager, Sales, Owner); Cc = the rest
      let toUsers = involved.filter(u => u.role === 'presales');
      if (toUsers.length === 0) toUsers = involved.filter(u => u.role === 'manager');
      if (toUsers.length === 0) toUsers = involved.filter(u => u.role === 'sales');
      if (toUsers.length === 0) toUsers = involved.filter(u => u.role === 'owner');
      if (toUsers.length === 0) toUsers = [involved[0]];
      const toIds = new Set(toUsers.map(u => u.id));
      const ccUsers = involved.filter(u => !toIds.has(u.id));

      let extraCcUsers: typeof ccUsers = [];
      if (ccRoles.length > 0) {
        try {
          const extra = await resolveAssignedRecipients(opp.id, ccRoles, null);
          extraCcUsers = extra
            .filter(u => !toIds.has(u.id))
            .filter(u => !ccUsers.find(c => c.id === u.id))
            .map(u => ({ id: u.id, email: u.email, name: u.name, role: 'owner' as const }));
        } catch { /* ignore */ }
      }
      const allCcUsers = [...ccUsers, ...extraCcUsers];

      const stageName = opp.stage?.name || opp.currentStage || '';
      const newStartStr = opp.tentativeStartDate ? opp.tentativeStartDate.toISOString().slice(0, 10) : '';
      const closeStr = opp.expectedCloseDate ? opp.expectedCloseDate.toISOString().slice(0, 10) : '';
      const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opp.id}`;
      const oppCurrency = opp.currency || 'USD';

      const variables: Record<string, string> = {
        opportunityTitle: opp.title,
        opportunityId: opp.id,
        client: opp.client?.name || '',
        clientName: opp.client?.name || '',
        stage: stageName,
        stageName,
        currentStage: stageName,
        previousStage,
        detailedStatus: opp.detailedStatus || 'Extended',
        salesRep: opp.salesRepName || '',
        salesRepName: opp.salesRepName || '',
        manager: opp.managerName || '',
        managerName: opp.managerName || '',
        presales: opp.presalesAssigneeName || '',
        owner: opp.owner?.name || '',
        ownerName: opp.owner?.name || '',
        updatedBy: updatedByName,
        updatedByName,
        tentativeStartDate: newStartStr,
        newStartDate: newStartStr,
        expectedCloseDate: closeStr,
        reEstimateCount: String(opp.reEstimateCount ?? 0),
        value: opp.value != null ? fmtNum(Number(opp.value)) : '',
        currency: oppCurrency,
        opportunityLink: oppLink,
      };

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Opportunity Extended: "${opp.title}"`;
      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `${updatedByName} updated Tentative Start Date to ${newStartStr}. Status moved to Extended; please re-estimate to match GOM%.`;

      if (sendEmail) {
        const eventKey = rule.emailTemplateKey || 'opportunity_extended';
        await sendNotificationEmail(
          eventKey,
          toUsers.map(u => u.email),
          toUsers.map(u => u.name).join(', '),
          variables,
          allCcUsers.map(u => u.email)
        ).catch(err => console.error('[ExtendedNotice] email send failed:', err));
      }
      if (sendInApp) {
        for (const u of [...toUsers, ...allCcUsers]) {
          await prisma.notification.create({
            data: {
              type: 'opportunity_extended',
              title,
              message,
              link: `/dashboard/opportunities/${opp.id}`,
              userId: u.id,
            },
          });
        }
      }

      console.log(`[ExtendedNotice] rule="${rule.name}" opp=${opp.id} "${opp.title}" to=${toUsers.length} cc=${allCcUsers.length}`);
    }
  } catch (err) {
    console.error('[ExtendedNotice] error:', err);
  }
}

/* -------------------------------------------------------------------------
 * "Start Date Changed (imminent)" event notification (event-driven,
 * triggerType="start_date_changed").
 *
 * Fired by the opportunities PATCH handler when a Sales-role user changes
 * tentativeStartDate while the start date is imminent — i.e. the previous
 * OR new start date is within 7 days of today (the window is read from the
 * rule's conditions field "daysToStartDate", default 7). Every person
 * involved in the opportunity is notified so a last-minute schedule change
 * doesn't surprise anyone.
 *
 * Recipients: ALL involved (owner / sales rep / manager / presales
 * assignees), minus the person who made the change. rule.recipientRolesCc
 * adds extra Cc users (e.g. all Admins).
 * ------------------------------------------------------------------------- */

export async function evaluateStartDateChangedNotification(params: {
  opportunityId: string;
  updatedByUserId: string;
  updatedByName: string;
  oldStartDate?: string | null;
  newStartDate?: string | null;
}): Promise<void> {
  try {
    const rules = await prisma.notificationRule.findMany({
      where: { isActive: true, triggerType: 'start_date_changed' },
    });
    if (rules.length === 0) {
      console.log('[StartDateChanged] no active start_date_changed rules — skipping');
      return;
    }

    const opp = await prisma.opportunity.findUnique({
      where: { id: params.opportunityId },
      select: {
        id: true, title: true, currentStage: true, detailedStatus: true,
        salesRepName: true, managerName: true, presalesAssigneeName: true,
        currency: true, value: true, tentativeStartDate: true, expectedCloseDate: true,
        client: { select: { name: true } },
        owner: { select: { id: true, email: true, name: true, muteNotification: true } },
        stage: { select: { name: true } },
      },
    });
    if (!opp) return;

    for (const rule of rules) {
      const channels = (rule.channels as string[]) || [];
      const sendEmail = channels.includes('email');
      const sendInApp = channels.includes('in_app');
      const ccRoles = ((rule as any).recipientRolesCc as string[]) || [];

      // Everyone involved — minus the actor (they made the change).
      const involved: { id: string; email: string; name: string }[] = [];
      const seen = new Set<string>();
      const addInvolved = (u: { id: string; email: string; name: string; muteNotification?: boolean } | null) => {
        if (!u || u.muteNotification || seen.has(u.id)) return;
        if (u.id === params.updatedByUserId) return; // no self-notify
        seen.add(u.id);
        involved.push({ id: u.id, email: u.email, name: u.name });
      };
      addInvolved(opp.owner);
      addInvolved(await resolveUserByName(opp.salesRepName));
      addInvolved(await resolveUserByName(opp.managerName));
      for (const pname of (opp.presalesAssigneeName || '').split(',').map(s => s.trim()).filter(Boolean)) {
        addInvolved(await resolveUserByName(pname));
      }

      // rule.recipientRolesCc -> extra opp-scoped CC users (e.g. Admin pool)
      let extraCc: { id: string; email: string; name: string }[] = [];
      if (ccRoles.length > 0) {
        try {
          const extra = await resolveAssignedRecipients(opp.id, ccRoles, null);
          extraCc = extra
            .filter(u => u.id !== params.updatedByUserId)
            .filter(u => !seen.has(u.id))
            .map(u => ({ id: u.id, email: u.email, name: u.name }));
          extraCc.forEach(u => seen.add(u.id));
        } catch { /* ignore */ }
      }

      const toUsers = involved;            // all involved in To
      const ccUsers = extraCc;             // admin/extra roles in Cc
      if (toUsers.length === 0 && ccUsers.length === 0) {
        console.log(`[StartDateChanged] no eligible recipients for opp ${opp.id} — skipping`);
        continue;
      }

      const stageName = opp.stage?.name || opp.currentStage || '';
      const oppLink = `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opp.id}`;
      const oppCurrency = opp.currency || 'USD';

      const variables: Record<string, string> = {
        opportunityTitle: opp.title,
        opportunityId: opp.id,
        client: opp.client?.name || '',
        clientName: opp.client?.name || '',
        stage: stageName,
        stageName,
        currentStage: stageName,
        owner: opp.owner?.name || '',
        ownerName: opp.owner?.name || '',
        salesRep: opp.salesRepName || '',
        salesRepName: opp.salesRepName || '',
        manager: opp.managerName || '',
        managerName: opp.managerName || '',
        presales: opp.presalesAssigneeName || '',
        updatedBy: params.updatedByName,
        updatedByName: params.updatedByName,
        oldStartDate: params.oldStartDate || '—',
        newStartDate: params.newStartDate || '—',
        tentativeStartDate: params.newStartDate || '',
        expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().slice(0, 10) : '',
        value: opp.value != null ? fmtNum(Number(opp.value)) : '',
        currency: oppCurrency,
        opportunityLink: oppLink,
      };

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Start date changed: "${opp.title}"`;
      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `${params.updatedByName} moved the start date from ${variables.oldStartDate} to ${variables.newStartDate}.`;

      if (sendEmail) {
        const eventKey = rule.emailTemplateKey || 'start_date_changed';
        await sendNotificationEmail(
          eventKey,
          toUsers.map(u => u.email),
          toUsers.map(u => u.name).join(', '),
          variables,
          ccUsers.map(u => u.email)
        ).catch(err => console.error('[StartDateChanged] email send failed:', err));
      }
      if (sendInApp) {
        for (const u of [...toUsers, ...ccUsers]) {
          await prisma.notification.create({
            data: {
              type: 'start_date_changed',
              title,
              message,
              link: `/dashboard/opportunities/${opp.id}`,
              userId: u.id,
            },
          });
        }
      }

      console.log(`[StartDateChanged] rule="${rule.name}" opp=${opp.id} "${opp.title}" to=${toUsers.length} cc=${ccUsers.length}`);
    }
  } catch (err) {
    console.error('[StartDateChanged] error:', err);
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
  presalesAssigneeName?: string | null;
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
      const recipientRolesCc = ((rule as any).recipientRolesCc as string[]) || [];
      const channels = (rule.channels as string[]) || [];

      const recipientUsers = rule.recipientUsers as Record<string, string[]> | null;

      // Only notify assigned users per role (Admin gets all)
      const toUsers = await resolveAssignedRecipients(opportunity.id, recipientRoles, recipientUsers);
      let ccUsers = recipientRolesCc.length > 0
        ? await resolveAssignedRecipients(opportunity.id, recipientRolesCc, recipientUsers)
        : [];
      ccUsers = ccUsers.filter(u => !toUsers.find(t => t.id === u.id));

      const _dataCurrency = (opportunity as any).currency || 'USD';
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
        value: opportunity.value != null ? fmtNum(Number(opportunity.value)) : '',
        currency: _dataCurrency,
        'opportunity.currency': _dataCurrency,
        probability: opportunity.probability != null ? String(opportunity.probability) : '',
        region: opportunity.region || '',
        technology: opportunity.technology || '',
        ruleName: rule.name,
        opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/${opportunity.id}`,
      };

      // Merge calculated fields
      const calcFields = await resolveCalculatedFields(opportunity.id);
      Object.assign(variables, calcFields);
      if (calcFields['opportunity.probability']) {
        variables.probability = calcFields['opportunity.probability'];
      }

      const title = rule.titleTemplate
        ? renderTemplate(rule.titleTemplate, variables)
        : `Alert: ${rule.name}`;

      const message = rule.messageTemplate
        ? renderTemplate(rule.messageTemplate, variables)
        : `Opportunity "${opportunity.title}" matched condition rule "${rule.name}"`;

      if (channels.includes('in_app')) {
        for (const user of [...toUsers, ...ccUsers]) {
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
      }

      if (channels.includes('email') && rule.emailTemplateKey) {
        const toEmails = toUsers.filter(u => !u.muteNotification).map(u => u.email);
        const ccEmails = ccUsers.filter(u => !u.muteNotification).map(u => u.email);
        if (toEmails.length > 0 || ccEmails.length > 0) {
          const primaryName = toUsers[0]?.name || ccUsers[0]?.name || 'Recipient';
          sendNotificationEmail(rule.emailTemplateKey, toEmails, primaryName, variables, ccEmails);
        }
      }

      if (toUsers.length > 0 || ccUsers.length > 0) {
        console.log(`[NotificationEngine] Data condition rule "${rule.name}" matched for "${opportunity.title}", notified ${toUsers.length} To + ${ccUsers.length} CC`);
      }
    }
  } catch (error) {
    console.error('[NotificationEngine] Error evaluating data condition rules:', error);
  }
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([\w.:]+)\}\}/g, (_, key) => variables[key] ?? '');
}

/** ICU-independent number formatter — works on any Node.js build. */
function fmtNum(n: number, decimals = 0): string {
  const fixed = n.toFixed(decimals);
  const [integer, decimal] = fixed.split('.');
  const intFormatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined && decimals > 0 ? `${intFormatted}.${decimal}` : intFormatted;
}

/** Format a monetary amount with currency prefix, e.g. "GBP 20,000" */
function fmtMoney(currency: string, amount: number): string {
  return `${currency} ${fmtNum(amount)}`;
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

    // calc:formattedValue — value with currency (ICU-independent formatting)
    const currency = (opp as any).currency || 'USD';
    const value = opp.value != null ? Number(opp.value) : null;
    calc['calc:formattedValue'] = value != null ? fmtMoney(currency, value) : 'N/A';

    // calc:weightedValue — value × probability / 100
    const prob = calculateOpportunityProbability(opp as any);
    calc['calc:probability'] = String(prob);
    calc['calc:weightedValue'] = value != null ? fmtMoney(currency, Math.round(value * prob / 100)) : 'N/A';

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

    // calc:currentDate / calc:currentTime — ICU-independent date formatting
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fmtDate = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    const fmtDateTime = (d: Date) => {
      const h = d.getHours(), m = d.getMinutes().toString().padStart(2, '0');
      return `${fmtDate(d)} ${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
    };
    calc['calc:currentDate'] = fmtDate(now);
    calc['calc:currentTime'] = fmtDateTime(now);
    calc['calc:expectedCloseFormatted'] = opp.expectedCloseDate ? fmtDate(new Date(opp.expectedCloseDate)) : 'N/A';
    calc['calc:createdDateFormatted'] = fmtDate(createdAt);

    // ── Populate all opportunity.* fields so templates using the Opportunity
    //    table catalog actually resolve. opportunity.value includes currency
    //    prefix (e.g. "GBP 20,000") so it matches what users see in the UI.
    calc['opportunity.title'] = opp.title || '';
    calc['opportunity.description'] = opp.description || '';
    calc['opportunity.value'] = value != null ? fmtMoney(currency, value) : '';
    calc['opportunity.currency'] = currency;
    calc['opportunity.probability'] = String(prob);
    calc['opportunity.currentStage'] = opp.currentStage || '';
    calc['opportunity.detailedStatus'] = opp.detailedStatus || '';
    calc['opportunity.region'] = opp.region || '';
    calc['opportunity.practice'] = opp.practice || '';
    calc['opportunity.technology'] = opp.technology || '';
    calc['opportunity.projectType'] = opp.projectType || '';
    calc['opportunity.pricingModel'] = opp.pricingModel || '';
    calc['opportunity.salesRepName'] = opp.salesRepName || '';
    calc['opportunity.managerName'] = opp.managerName || '';
    calc['opportunity.geolocation'] = opp.geolocation || '';
    calc['opportunity.reEstimateCount'] = String(opp.reEstimateCount ?? 0);
    calc['opportunity.gomApproved'] = opp.gomApproved ? 'Yes' : 'No';
    calc['opportunity.expectedDayRate'] = opp.expectedDayRate != null
      ? fmtNum(Number(opp.expectedDayRate), 2)
      : '';
    calc['opportunity.adjustedEstimatedValue'] = opp.adjustedEstimatedValue != null
      ? fmtMoney(currency, Number(opp.adjustedEstimatedValue))
      : '';
    calc['opportunity.tentativeDuration'] = opp.tentativeDuration != null
      ? `${opp.tentativeDuration} ${opp.tentativeDurationUnit || ''}`.trim()
      : '';
    calc['opportunity.tentativeDurationUnit'] = opp.tentativeDurationUnit || '';
    calc['opportunity.tentativeStartDate'] = opp.tentativeStartDate ? fmtDate(new Date(opp.tentativeStartDate)) : '';
    calc['opportunity.tentativeEndDate'] = opp.tentativeEndDate ? fmtDate(new Date(opp.tentativeEndDate)) : '';
    calc['opportunity.expectedCloseDate'] = opp.expectedCloseDate ? fmtDate(new Date(opp.expectedCloseDate)) : '';
    calc['opportunity.actualCloseDate'] = opp.actualCloseDate ? fmtDate(new Date(opp.actualCloseDate)) : '';

    // ── GOM profitability from presalesData
    // The "proposed value" sent to the client is the FINAL quote price the salesperson
    // committed to in the GOM Calculator — not the original Pipeline estimate. Field
    // priority: finalRevenue (committed quote) → gomSummary.totalRevenue
    // (calculated revenue) → opportunity.value. Re-estimate suggestions do not override revenue.
    if (opp.presalesData && typeof opp.presalesData === 'object' && !Array.isArray(opp.presalesData)) {
      const pData = opp.presalesData as any;
      const finalGomPercent = pData.finalGomPercent != null ? Number(pData.finalGomPercent) : (pData.gomPercent != null ? Number(pData.gomPercent) : null);
      calc['calc:gomPercent'] = finalGomPercent != null ? `${finalGomPercent.toFixed(1)}%` : 'N/A';

      // presalesData amounts are stored in pData.currency (typically INR base) — convert
      // to the opportunity's display currency before formatting, so the email shows
      // "USD 7,000" instead of "USD 670,371" when the opp is USD but GOM was saved in INR.
      const presalesCurr = (pData.currency as string) || currency;
      const ratesSnapshot = (opp as any).metadata?.exchangeRatesSnapshot as Record<string, number> | undefined;
      const toOppCurrency = (val: number): number => {
        if (presalesCurr === currency) return val;
        const rateToOpp = ratesSnapshot?.[currency];
        const rateFromPre = ratesSnapshot?.[presalesCurr];
        if (rateToOpp && rateFromPre) return (val * rateToOpp) / rateFromPre;
        return val;
      };

      const proposedRevenueRawSrc = pData.finalRevenue != null
        ? Number(pData.finalRevenue)
        : (pData.totalRevenue != null
            ? Number(pData.totalRevenue)
            : (pData.gomSummary?.totalRevenue != null
                ? Number(pData.gomSummary.totalRevenue)
                : null));
      // opp.value is already in opportunity currency — don't convert it.
      const proposedRevenueRaw = proposedRevenueRawSrc != null
        ? toOppCurrency(proposedRevenueRawSrc)
        : (opp.value != null ? Number(opp.value) : null);
      const proposedValueFormatted = proposedRevenueRaw != null ? fmtMoney(currency, proposedRevenueRaw) : 'N/A';
      calc['calc:totalRevenue'] = proposedValueFormatted;
      calc['calc:proposedValue'] = proposedValueFormatted;

      const totalCostRawSrc = pData.finalTotalCost != null
        ? Number(pData.finalTotalCost)
        : (pData.totalCost != null
            ? Number(pData.totalCost)
            : (pData.gomSummary?.totalCost != null ? Number(pData.gomSummary.totalCost) : null));
      const totalCostRaw = totalCostRawSrc != null ? toOppCurrency(totalCostRawSrc) : null;
      calc['calc:totalCost'] = totalCostRaw != null ? fmtMoney(currency, totalCostRaw) : 'N/A';

      const gomAbsoluteRawSrc = pData.finalProfit != null
        ? Number(pData.finalProfit)
        : (pData.gomFull != null
            ? Number(pData.gomFull)
            : null);
      const gomAbsoluteRaw = gomAbsoluteRawSrc != null
        ? toOppCurrency(gomAbsoluteRawSrc)
        : (proposedRevenueRaw != null && totalCostRaw != null ? proposedRevenueRaw - totalCostRaw : null);
      calc['calc:gomAbsolute'] = gomAbsoluteRaw != null ? fmtMoney(currency, gomAbsoluteRaw) : 'N/A';
    } else {
      calc['calc:gomPercent'] = 'N/A';
      calc['calc:totalRevenue'] = opp.value != null ? fmtMoney(currency, Number(opp.value)) : 'N/A';
      calc['calc:proposedValue'] = opp.value != null ? fmtMoney(currency, Number(opp.value)) : 'N/A';
      calc['calc:totalCost'] = 'N/A';
      calc['calc:gomAbsolute'] = 'N/A';
    }

  } catch (error) {
    console.error('[NotificationEngine] Error resolving calculated fields:', error);
  }
  return calc;
}

function getFieldValue(opp: any, field: string): any {
  switch (field) {
    case 'value': return opp.value;
    case 'probability': return calculateOpportunityProbability(opp as any);
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
