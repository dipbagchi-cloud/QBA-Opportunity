import { buildOpportunityAccess, extractAssignedNames } from '../lib/opportunity-access';
import { PERMISSIONS, WILDCARD, DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';

type Params = Parameters<typeof buildOpportunityAccess>[0];

const ADMIN = [WILDCARD];
const MANAGER = DEFAULT_ROLE_PERMISSIONS.Manager;
const MANAGEMENT = DEFAULT_ROLE_PERMISSIONS.Management; // has opportunities:edit-all
const SALES = DEFAULT_ROLE_PERMISSIONS.Sales;
const PRESALES = DEFAULT_ROLE_PERMISSIONS.Presales;
const READ_ONLY = DEFAULT_ROLE_PERMISSIONS['Read-Only'];

function build(over: {
  permissions: string[];
  roleName?: string;
  userId?: string;
  currentUser?: Params['currentUser'];
  opportunity?: Partial<Params['opportunity']>;
  pendingApproval?: Params['pendingApproval'];
}) {
  return buildOpportunityAccess({
    authUser: { userId: over.userId ?? 'auth-1', permissions: over.permissions, roleName: over.roleName },
    currentUser: over.currentUser === undefined ? { id: 'user-1', name: 'Test User' } : over.currentUser,
    opportunity: {
      ownerId: 'owner-x',
      salesRepName: null,
      managerName: null,
      presalesAssigneeName: null,
      currentStage: 'Qualification',
      ...over.opportunity,
    },
    pendingApproval: over.pendingApproval ?? null,
  });
}

describe('extractAssignedNames', () => {
  it('returns an empty array for empty / null input', () => {
    expect(extractAssignedNames('')).toEqual([]);
    expect(extractAssignedNames(null)).toEqual([]);
    expect(extractAssignedNames(undefined)).toEqual([]);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    expect(extractAssignedNames('Alice, Bob ,  Carol')).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('drops empty segments from trailing / double commas', () => {
    expect(extractAssignedNames('Alice,,Bob,')).toEqual(['Alice', 'Bob']);
  });
});

describe('buildOpportunityAccess — Admin (wildcard)', () => {
  it('can edit pipeline, presales and estimation on an open deal even when not assigned', () => {
    const access = build({
      permissions: ADMIN,
      roleName: 'Admin',
      currentUser: { id: 'someone-else', name: 'Admin User' },
      opportunity: { ownerId: 'owner-x', currentStage: 'Proposal' },
    });
    expect(access.assignment.canEditAssignedOpportunity).toBe(true);
    expect(access.workflow.pipelineEditable).toBe(true);
    expect(access.workflow.presalesEditable).toBe(true);
    expect(access.workflow.estimationEditable).toBe(true);
    expect(access.viewOnlyReason).toBeNull();
  });

  it('still bypasses the assignment check on a closed deal (backend allows admin; UI enforces the freeze)', () => {
    const access = build({
      permissions: ADMIN,
      roleName: 'Admin',
      opportunity: { currentStage: 'Closed Won' },
    });
    expect(access.assignment.canEditAssignedOpportunity).toBe(true);
    expect(access.workflow.pipelineEditable).toBe(true);
    expect(access.workflow.presalesEditable).toBe(true);
  });
});

describe('buildOpportunityAccess — Manager (workflow perms, not edit-all)', () => {
  it('is view-only on an open deal they are NOT assigned to', () => {
    const access = build({
      permissions: MANAGER,
      roleName: 'Manager',
      currentUser: { id: 'mgr-1', name: 'Mary Manager' },
      opportunity: { ownerId: 'owner-x', salesRepName: 'Sam Sales', managerName: 'Other Manager' },
    });
    expect(access.assignment.isDirectlyAssigned).toBe(false);
    expect(access.assignment.canEditAssignedOpportunity).toBe(false);
    expect(access.workflow.pipelineEditable).toBe(false);
    expect(access.viewOnlyReason).toMatch(/only the assigned owner, sales rep, manager, or named presales/i);
  });

  it('can edit pipeline once assigned as the manager, but NOT presales content', () => {
    const access = build({
      permissions: MANAGER,
      roleName: 'Manager',
      currentUser: { id: 'mgr-1', name: 'Mary Manager' },
      opportunity: { managerName: 'mary manager' }, // case-insensitive match
    });
    expect(access.assignment.isManager).toBe(true);
    expect(access.assignment.canEditAssignedOpportunity).toBe(true);
    expect(access.workflow.pipelineEditable).toBe(true);
    // A manager is not a named presales assignee -> presales content stays locked
    expect(access.workflow.presalesEditable).toBe(false);
    expect(access.workflow.estimationEditable).toBe(false);
    expect(access.viewOnlyReason).toBeNull();
  });
});

describe('buildOpportunityAccess — assigned Presales member', () => {
  it('can edit presales + estimation content when named on the deal', () => {
    const access = build({
      permissions: PRESALES,
      roleName: 'Presales',
      currentUser: { id: 'ps-1', name: 'Pat Presales' },
      opportunity: { presalesAssigneeName: 'Pat Presales, Other Person' },
    });
    expect(access.assignment.isAssignedPresales).toBe(true);
    expect(access.assignment.canEditAssignedOpportunity).toBe(true);
    expect(access.workflow.presalesEditable).toBe(true);
    expect(access.workflow.estimationEditable).toBe(true);
  });

  it('cannot edit presales content when not named, even with presales:write', () => {
    const access = build({
      permissions: PRESALES,
      roleName: 'Presales',
      currentUser: { id: 'ps-2', name: 'Unassigned Presales' },
      opportunity: { presalesAssigneeName: 'Someone Else' },
    });
    expect(access.assignment.isAssignedPresales).toBe(false);
    expect(access.workflow.presalesEditable).toBe(false);
    expect(access.workflow.estimationEditable).toBe(false);
  });
});

describe('buildOpportunityAccess — Management (opportunities:edit-all)', () => {
  it('edits any OPEN deal without being assigned (edit-all bypass)', () => {
    const access = build({
      permissions: MANAGEMENT,
      roleName: 'Management',
      currentUser: { id: 'exec-1', name: 'Exec Person' },
      opportunity: { ownerId: 'owner-x', currentStage: 'Negotiation' },
    });
    expect(access.assignment.canEditAssignedOpportunity).toBe(true);
    expect(access.workflow.pipelineEditable).toBe(true);
    expect(access.workflow.presalesEditable).toBe(true);
    expect(access.viewOnlyReason).toBeNull();
  });

  it('loses the edit-all bypass on a CLOSED deal and is told it is read-only', () => {
    const access = build({
      permissions: MANAGEMENT,
      roleName: 'Management',
      currentUser: { id: 'exec-1', name: 'Exec Person' },
      opportunity: { ownerId: 'owner-x', currentStage: 'Closed Lost' },
    });
    expect(access.assignment.canEditAssignedOpportunity).toBe(false);
    expect(access.workflow.pipelineEditable).toBe(false);
    expect(access.viewOnlyReason).toBe('This opportunity is closed and is read-only.');
  });
});

describe('buildOpportunityAccess — Read-Only role', () => {
  it('has no workflow edit rights and no view-only reason (no edit access to begin with)', () => {
    const access = build({
      permissions: READ_ONLY,
      roleName: 'Read-Only',
      currentUser: { id: 'ro-1', name: 'Reed Only' },
    });
    expect(access.permissions.presales.view).toBe(true);
    expect(access.workflow.pipelineEditable).toBe(false);
    expect(access.workflow.presalesEditable).toBe(false);
    expect(access.assignment.canEditAssignedOpportunity).toBe(false);
    expect(access.viewOnlyReason).toBeNull();
  });
});

describe('buildOpportunityAccess — closed-stage detection', () => {
  const closedStages = ['Closed Won', 'Closed-Won', 'Closed Lost', 'Delivered'];

  it.each(closedStages)('freezes a non-admin edit-all holder on stage "%s"', (stage) => {
    const access = build({
      permissions: MANAGEMENT,
      roleName: 'Management',
      opportunity: { currentStage: stage },
    });
    expect(access.assignment.canEditAssignedOpportunity).toBe(false);
    expect(access.viewOnlyReason).toBe('This opportunity is closed and is read-only.');
  });

  it('reads the closed stage from opportunity.stage.name as well as currentStage', () => {
    const access = build({
      permissions: MANAGEMENT,
      roleName: 'Management',
      opportunity: { stage: { name: 'Closed Won' }, currentStage: 'ignored' },
    });
    expect(access.viewOnlyReason).toBe('This opportunity is closed and is read-only.');
  });

  it('does NOT treat an open stage as closed', () => {
    const access = build({
      permissions: MANAGEMENT,
      roleName: 'Management',
      opportunity: { currentStage: 'Proposal' },
    });
    expect(access.assignment.canEditAssignedOpportunity).toBe(true);
    expect(access.viewOnlyReason).toBeNull();
  });
});

describe('buildOpportunityAccess — assignment name matching', () => {
  it('matches owner by id, and salesRep/manager by normalised name', () => {
    const access = build({
      permissions: SALES,
      roleName: 'Sales',
      currentUser: { id: 'user-1', name: '  Sam Sales  ' },
      opportunity: { ownerId: 'user-1', salesRepName: 'SAM SALES' },
    });
    expect(access.assignment.isOwner).toBe(true);
    expect(access.assignment.isSalesRep).toBe(true);
  });

  it('does not mark assignment when currentUser is null', () => {
    const access = build({
      permissions: SALES,
      roleName: 'Sales',
      currentUser: null,
      opportunity: { ownerId: 'user-1', salesRepName: 'Sam Sales' },
    });
    expect(access.assignment.isOwner).toBe(false);
    expect(access.assignment.isSalesRep).toBe(false);
    expect(access.assignment.isDirectlyAssigned).toBe(false);
  });
});

describe('buildOpportunityAccess — GOM approval review', () => {
  it('lets an approvals:manage holder review a pending GOM with no assigned reviewer', () => {
    const access = build({
      permissions: MANAGER,
      roleName: 'Manager',
      userId: 'auth-1',
      currentUser: { id: 'mgr-1', name: 'Mary Manager' },
      opportunity: { managerName: 'Mary Manager' },
      pendingApproval: { reviewerId: null },
    });
    expect(access.workflow.gomApprovalReviewable).toBe(true);
  });

  it('blocks review when the pending GOM is assigned to a different reviewer', () => {
    const access = build({
      permissions: MANAGER,
      roleName: 'Manager',
      userId: 'auth-1',
      currentUser: { id: 'mgr-1', name: 'Mary Manager' },
      opportunity: { managerName: 'Mary Manager' },
      pendingApproval: { reviewerId: 'someone-else' },
    });
    expect(access.workflow.gomApprovalReviewable).toBe(false);
  });

  it('is not reviewable without approvals:manage', () => {
    const access = build({
      permissions: SALES,
      roleName: 'Sales',
      currentUser: { id: 'user-1', name: 'Sam Sales' },
      opportunity: { salesRepName: 'Sam Sales' },
      pendingApproval: { reviewerId: null },
    });
    expect(access.workflow.gomApprovalReviewable).toBe(false);
  });
});
