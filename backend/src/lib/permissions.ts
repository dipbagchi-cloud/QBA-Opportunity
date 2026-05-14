// RBAC Permission Constants
// Each permission follows the pattern: "resource:action"

export const PERMISSIONS = {
  // Core screens
  DASHBOARD_VIEW: 'dashboard:view',

  // Admin-only
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  SETTINGS_VIEW: 'settings:view',
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

  // Contacts
  CONTACTS_VIEW: 'contacts:view',
  CONTACTS_WRITE: 'contacts:write',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Agents
  AGENTS_EXECUTE: 'agents:execute',

  // GOM
  GOM_VIEW: 'gom:view',

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

export const PERMISSION_IMPLICATIONS: Record<string, string[]> = {
  [PERMISSIONS.PIPELINE_WRITE]: [PERMISSIONS.PIPELINE_VIEW],
  [PERMISSIONS.PRESALES_WRITE]: [PERMISSIONS.PRESALES_VIEW],
  [PERMISSIONS.SALES_WRITE]: [PERMISSIONS.SALES_VIEW],
  [PERMISSIONS.CONTACTS_WRITE]: [PERMISSIONS.CONTACTS_VIEW],
  [PERMISSIONS.SETTINGS_MANAGE]: [PERMISSIONS.SETTINGS_VIEW],
  [PERMISSIONS.ANALYTICS_EXPORT]: [PERMISSIONS.ANALYTICS_VIEW],
  [PERMISSIONS.SOW_WRITE]: [PERMISSIONS.SOW_VIEW],
  [PERMISSIONS.SOW_ADMIN]: [PERMISSIONS.SOW_VIEW, PERMISSIONS.SOW_WRITE],
  [PERMISSIONS.USERS_MANAGE]: [PERMISSIONS.SETTINGS_VIEW],
  [PERMISSIONS.ROLES_MANAGE]: [PERMISSIONS.SETTINGS_VIEW],
  [PERMISSIONS.METADATA_MANAGE]: [PERMISSIONS.SETTINGS_VIEW],
  [PERMISSIONS.COSTCARD_MANAGE]: [PERMISSIONS.SETTINGS_VIEW],
  [PERMISSIONS.AUDITLOGS_VIEW]: [PERMISSIONS.SETTINGS_VIEW],
};

export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

// Role permission presets
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: [WILDCARD],
  Manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PIPELINE_WRITE,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.PRESALES_WRITE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.ESTIMATION_MANAGE,
    PERMISSIONS.APPROVALS_MANAGE,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.CONTACTS_WRITE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.GOM_VIEW,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.RESOURCES_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.AUDITLOGS_VIEW,
    PERMISSIONS.SOW_VIEW,
    PERMISSIONS.SOW_WRITE,
  ],
  Sales: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PIPELINE_WRITE,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.CONTACTS_WRITE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.GOM_VIEW,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SOW_VIEW,
  ],
  Presales: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.PRESALES_WRITE,
    PERMISSIONS.ESTIMATION_MANAGE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.GOM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SOW_VIEW,
    PERMISSIONS.SOW_WRITE,
  ],
  'Read-Only': [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.GOM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  Management: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PIPELINE_VIEW,
    PERMISSIONS.PRESALES_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.AUDITLOGS_VIEW,
    PERMISSIONS.APPROVALS_MANAGE,
    PERMISSIONS.GOM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SOW_VIEW,
  ],
};

export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

function permissionImplies(granted: string, required: string, visited = new Set<string>()): boolean {
  if (granted === required) return true;
  if (visited.has(granted)) return false;
  visited.add(granted);

  const implied = PERMISSION_IMPLICATIONS[granted] || [];
  return implied.some((next) => permissionImplies(next, required, visited));
}

// Check if a permission set grants a specific permission
export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes(WILDCARD)) return true;
  return permissions.some((granted) => permissionImplies(granted, required));
}

// Check if a permission set grants ANY of the required permissions
export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  if (permissions.includes(WILDCARD)) return true;
  return required.some((permission) => hasPermission(permissions, permission));
}

export function validatePermissions(permissions: string[]) {
  const normalized = Array.from(new Set(permissions.filter(Boolean)));
  const invalid = normalized.filter((permission) => permission !== WILDCARD && !ALL_PERMISSION_KEYS.includes(permission as Permission));
  return {
    valid: invalid.length === 0,
    invalid,
    permissions: normalized,
  };
}
