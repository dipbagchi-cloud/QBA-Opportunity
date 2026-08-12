import { PERMISSIONS, hasAnyPermission, hasPermission, WILDCARD } from './permissions';

type AuthUserLike = {
  userId: string;
  permissions: string[];
  roleName?: string;
};

type CurrentUserLike = {
  id: string;
  name: string | null;
};

type OpportunityLike = {
  ownerId: string;
  salesRepName?: string | null;
  managerName?: string | null;
  presalesAssigneeName?: string | null;
  stage?: { name?: string | null } | null;
  currentStage?: string | null;
};

// Opportunities in any of these stages are read-only for everyone except
// Admin (wildcard). The opportunities:edit-all permission does NOT bypass
// this lock — once a deal is won, lost, or delivered, the record is frozen.
const CLOSED_STAGE_NAMES = new Set<string>([
  'Closed Won',
  'Closed-Won',
  'Closed Lost',
  'Proposal Lost',
  'Delivered',
]);

type PendingApprovalLike = {
  reviewerId?: string | null;
};

function normalizeName(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export function extractAssignedNames(raw?: string | null): string[] {
  return (raw || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export function buildOpportunityAccess(params: {
  authUser: AuthUserLike;
  currentUser: CurrentUserLike | null;
  opportunity: OpportunityLike;
  pendingApproval?: PendingApprovalLike | null;
}) {
  const { authUser, currentUser, opportunity, pendingApproval } = params;
  const permissions = authUser.permissions || [];
  const currentUserName = normalizeName(currentUser?.name);
  const assignedPresalesNames = extractAssignedNames(opportunity.presalesAssigneeName);

  const permissionState = {
    pipeline: {
      view: hasAnyPermission(permissions, [PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PIPELINE_WRITE]),
      edit: hasPermission(permissions, PERMISSIONS.PIPELINE_WRITE),
    },
    presales: {
      view: hasAnyPermission(permissions, [PERMISSIONS.PRESALES_VIEW, PERMISSIONS.PRESALES_WRITE]),
      edit: hasPermission(permissions, PERMISSIONS.PRESALES_WRITE),
    },
    estimation: {
      manage: hasPermission(permissions, PERMISSIONS.ESTIMATION_MANAGE),
    },
    sales: {
      view: hasAnyPermission(permissions, [PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_WRITE]),
      edit: hasPermission(permissions, PERMISSIONS.SALES_WRITE),
    },
    approvals: {
      manage: hasPermission(permissions, PERMISSIONS.APPROVALS_MANAGE),
    },
    gom: {
      view: hasAnyPermission(permissions, [PERMISSIONS.GOM_VIEW, PERMISSIONS.APPROVALS_MANAGE]),
    },
    contacts: {
      view: hasAnyPermission(permissions, [PERMISSIONS.CONTACTS_VIEW, PERMISSIONS.CONTACTS_WRITE]),
      edit: hasPermission(permissions, PERMISSIONS.CONTACTS_WRITE),
    },
    analytics: {
      view: hasAnyPermission(permissions, [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_EXPORT]),
      export: hasPermission(permissions, PERMISSIONS.ANALYTICS_EXPORT),
    },
    agents: {
      execute: hasPermission(permissions, PERMISSIONS.AGENTS_EXECUTE),
    },
    settings: {
      view: hasAnyPermission(permissions, [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE]),
      manage: hasPermission(permissions, PERMISSIONS.SETTINGS_MANAGE),
    },
    sow: {
      view: hasAnyPermission(permissions, [PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE, PERMISSIONS.SOW_ADMIN]),
      edit: hasAnyPermission(permissions, [PERMISSIONS.SOW_WRITE, PERMISSIONS.SOW_ADMIN]),
      admin: hasPermission(permissions, PERMISSIONS.SOW_ADMIN),
    },
  };

  const isAdmin = permissions.includes(WILDCARD);

  // Stage check — closed deals (Won / Lost / Delivered) freeze for non-admin users.
  const stageName = opportunity.stage?.name || opportunity.currentStage || '';
  const isClosedStage = CLOSED_STAGE_NAMES.has(stageName);

  // Roles holding opportunities:edit-all (e.g. Management) get assignment-
  // bypass on any open opportunity. Admins always bypass regardless of stage.
  const hasEditAllPermission = hasPermission(permissions, PERMISSIONS.OPPORTUNITIES_EDIT_ALL);
  const editAllActive = hasEditAllPermission && !isClosedStage;

  const isOwner = !!currentUser && opportunity.ownerId === currentUser.id;
  const isSalesRep = !!currentUserName && normalizeName(opportunity.salesRepName) === currentUserName;
  const isManager = !!currentUserName && normalizeName(opportunity.managerName) === currentUserName;
  const isAssignedPresales = !!currentUserName && assignedPresalesNames.some((name) => normalizeName(name) === currentUserName);
  const isDirectlyAssigned = isOwner || isSalesRep || isManager || isAssignedPresales;

  const hasWorkflowEditPermission =
    permissionState.pipeline.edit ||
    permissionState.presales.edit ||
    permissionState.estimation.manage ||
    permissionState.sales.edit ||
    permissionState.approvals.manage ||
    permissionState.sow.edit;

  // Admin (wildcard *) always bypasses. edit-all holders bypass for open deals.
  const canEditAssignedOpportunity =
    isAdmin ||
    editAllActive ||
    (isDirectlyAssigned && hasWorkflowEditPermission);
  const canReviewPendingGom =
    (isAdmin || permissionState.approvals.manage) &&
    !!pendingApproval &&
    (!pendingApproval.reviewerId || pendingApproval.reviewerId === authUser.userId);

  let viewOnlyReason: string | null = null;
  if (!canEditAssignedOpportunity && hasWorkflowEditPermission) {
    if (hasEditAllPermission && isClosedStage) {
      viewOnlyReason = 'This opportunity is closed and is read-only.';
    } else {
      viewOnlyReason = 'You have screen access through your role, but only the assigned owner, sales rep, manager, or named presales assignees can edit this opportunity.';
    }
  }

  // Presales content editing requires both: being a named presales assignee AND having
  // general opportunity edit rights (canEditAssignedOpportunity). edit-all holders
  // also qualify — they act like admin on any open opportunity.
  const canEditPresalesContent = isAdmin || editAllActive || (isAssignedPresales && canEditAssignedOpportunity);

  // "Eligible for Escalation" changes hands as the deal progresses: the sales
  // rep raises it while the deal is still in Pipeline, the offshore manager
  // owns it through Presales, and once it reaches Sales either of them can
  // adjust it. Anyone else — including other sales reps and presales
  // assignees — sees it read-only. Closed deals freeze like everything else.
  const escalationOwnedAtThisStage = (() => {
    if (isClosedStage) return false;
    switch (stageName) {
      case 'Discovery':
      case 'Pipeline':
        return isSalesRep;
      case 'Qualification':
      case 'Presales':
        return isManager;
      case 'Proposal':
      case 'Sales':
      case 'Negotiation':
        return isSalesRep || isManager;
      default:
        return false;
    }
  })();
  const escalationEditable =
    isAdmin || editAllActive || (escalationOwnedAtThisStage && canEditAssignedOpportunity);

  return {
    viewOnlyReason,
    assignment: {
      isOwner,
      isSalesRep,
      isManager,
      isAssignedPresales,
      isDirectlyAssigned,
      canEditAssignedOpportunity,
    },
    permissions: permissionState,
    workflow: {
      pipelineEditable: (isAdmin || editAllActive || permissionState.pipeline.edit || permissionState.presales.edit || permissionState.sales.edit || permissionState.approvals.manage) && canEditAssignedOpportunity,
      presalesEditable: (isAdmin || editAllActive || permissionState.presales.edit) && canEditPresalesContent,
      estimationEditable: (isAdmin || editAllActive || permissionState.estimation.manage) && canEditPresalesContent,
      salesEditable: (isAdmin || editAllActive || permissionState.sales.edit) && canEditAssignedOpportunity,
      gomRequestAllowed:
        (isAdmin || editAllActive || permissionState.pipeline.edit || permissionState.presales.edit || permissionState.sales.edit) &&
        canEditAssignedOpportunity,
      gomApprovalManageable: (isAdmin || editAllActive || permissionState.approvals.manage) && canEditAssignedOpportunity,
      gomApprovalReviewable: canReviewPendingGom,
      commentsWritable: canEditAssignedOpportunity,
      attachmentsEditable: canEditAssignedOpportunity,
      projectDetailsEditable:
        (isAdmin || editAllActive || permissionState.pipeline.edit || permissionState.presales.edit) && canEditAssignedOpportunity,
      sowEditable: (isAdmin || editAllActive || permissionState.sow.edit) && canEditAssignedOpportunity,
      escalationEditable,
    },
  };
}
