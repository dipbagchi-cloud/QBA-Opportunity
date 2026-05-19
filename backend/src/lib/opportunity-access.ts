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
};

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

  // Admin (wildcard *) bypasses assignment check — they can edit any opportunity
  const canEditAssignedOpportunity = isAdmin || (isDirectlyAssigned && hasWorkflowEditPermission);
  const canReviewPendingGom =
    (isAdmin || permissionState.approvals.manage) &&
    !!pendingApproval &&
    (!pendingApproval.reviewerId || pendingApproval.reviewerId === authUser.userId);

  let viewOnlyReason: string | null = null;
  if (!canEditAssignedOpportunity && hasWorkflowEditPermission) {
    viewOnlyReason = 'You have screen access through your role, but only the assigned owner, sales rep, manager, or named presales assignees can edit this opportunity.';
  }

  // Presales content editing requires both: being a named presales assignee AND having
  // general opportunity edit rights (canEditAssignedOpportunity).
  const canEditPresalesContent = isAdmin || (isAssignedPresales && canEditAssignedOpportunity);

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
      pipelineEditable: (isAdmin || permissionState.pipeline.edit) && canEditAssignedOpportunity,
      presalesEditable: (isAdmin || permissionState.presales.edit) && canEditPresalesContent,
      estimationEditable: (isAdmin || permissionState.estimation.manage) && canEditPresalesContent,
      salesEditable: (isAdmin || permissionState.sales.edit) && canEditAssignedOpportunity,
      gomRequestAllowed:
        (isAdmin || permissionState.pipeline.edit || permissionState.presales.edit || permissionState.sales.edit) &&
        canEditAssignedOpportunity,
      gomApprovalManageable: (isAdmin || permissionState.approvals.manage) && canEditAssignedOpportunity,
      gomApprovalReviewable: canReviewPendingGom,
      commentsWritable: canEditAssignedOpportunity,
      attachmentsEditable: canEditAssignedOpportunity,
      projectDetailsEditable:
        (isAdmin || permissionState.pipeline.edit || permissionState.presales.edit) && canEditAssignedOpportunity,
      sowEditable: (isAdmin || permissionState.sow.edit) && canEditAssignedOpportunity,
    },
  };
}
