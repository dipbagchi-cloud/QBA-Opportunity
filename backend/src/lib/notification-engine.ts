import { prisma } from './prisma';
import { sendNotificationEmail, sendRawEmail } from './email';
import { calculateOpportunityProbability } from './opportunity-probability';

// Roles that are "global" - all users with these roles get notified regardless of assignment
const GLOBAL_ROLES = ['Admin'];

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
