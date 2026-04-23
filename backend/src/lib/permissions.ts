// RBAC Permission Constants
// Each permission follows the pattern: "resource:action"

export const PERMISSIONS = {
  // Admin-only
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  SETTINGS_MANAGE: 'settings:manage',
  METADATA_MANAGE: 'metadata:manage',
  COSTCARD_MANAGE: 'costcard:manage',

  // Resources
  RESOURCES_MANAGE: 'resources:manage',

  // Pipeline / Opportunities
  PIPELINE_VIEW: 'pipeline:view',
  PIPELINE_WRITE: 'pipeline:write',

  // Presales
  PRESALES_VIEW: 'presales:view',
  PRESALES_WRITE: 'presales:write',

  // Estimation
  ESTIMATION_MANAGE: 'estimation:manage',

  // Sales
  SALES_VIEW: 'sales:view',
  SALES_WRITE: 'sales:write',

  // Approvals
  APPROVALS_MANAGE: 'approvals:manage',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Agents
  AGENTS_EXECUTE: 'agents:execute',

  // Leads
  LEADS_MANAGE: 'leads:manage',

  // Audit Logs
  AUDITLOGS_VIEW: 'auditlogs:view',

  // SOW Studio
  SOW_VIEW: 'sow:view',
  SOW_WRITE: 'sow:write',
  SOW_ADMIN: 'sow:admin',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Wildcard permission grants all access (Admin only)
export const WILDCARD = '*';

// Role permission presets
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: [WILDCARD],
  Manager: [
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PIPELINE_WRITE,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.PRESALES_WRITE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.ESTIMATION_MANAGE,
    PERMISSIONS.APPROVALS_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.RESOURCES_MANAGE,
    PERMISSIONS.AUDITLOGS_VIEW,
    PERMISSIONS.SOW_VIEW,
    PERMISSIONS.SOW_WRITE,
  ],
  Sales: [
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PIPELINE_WRITE,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.SOW_VIEW,
  ],
  Presales: [
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.PRESALES_WRITE,
    PERMISSIONS.ESTIMATION_MANAGE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.SOW_VIEW,
    PERMISSIONS.SOW_WRITE,
  ],
  'Read-Only': [
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  Management: [
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.AUDITLOGS_VIEW,
    PERMISSIONS.APPROVALS_MANAGE,
  ],
};

// Check if a permission set grants a specific permission
export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes(WILDCARD)) return true;
  return permissions.includes(required);
}

// Check if a permission set grants ANY of the required permissions
export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  if (permissions.includes(WILDCARD)) return true;
  return required.some(p => permissions.includes(p));
}
