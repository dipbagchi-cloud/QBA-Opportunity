export const WILDCARD_PERMISSION = "*";

export const PERMISSION_IMPLICATIONS: Record<string, string[]> = {
  "pipeline:write": ["pipeline:view"],
  "presales:write": ["presales:view"],
  "sales:write": ["sales:view"],
  "contacts:write": ["contacts:view"],
  "settings:manage": ["settings:view"],
  "analytics:export": ["analytics:view"],
  "sow:write": ["sow:view"],
  "sow:admin": ["sow:view", "sow:write"],
  "users:manage": ["settings:view"],
  "roles:manage": ["settings:view"],
  "metadata:manage": ["settings:view"],
  "costcard:manage": ["settings:view"],
  "auditlogs:view": ["settings:view"],
};

function permissionImplies(granted: string, required: string, visited = new Set<string>()): boolean {
  if (granted === required) return true;
  if (visited.has(granted)) return false;
  visited.add(granted);

  return (PERMISSION_IMPLICATIONS[granted] || []).some((next) =>
    permissionImplies(next, required, visited)
  );
}

export function hasGrantedPermission(permissions: string[] | undefined, required: string): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes(WILDCARD_PERMISSION)) return true;
  return permissions.some((granted) => permissionImplies(granted, required));
}

export function hasAnyGrantedPermission(
  permissions: string[] | undefined,
  required: string[]
): boolean {
  return required.some((permission) => hasGrantedPermission(permissions, permission));
}

export type SettingsTabKey =
  | "profile"
  | "security"
  | "users"
  | "roles"
  | "qpeoplemapping"
  | "authconfig"
  | "aiassistant"
  | "announcement"
  | "ratecards"
  | "budgetassumptions"
  | "currencyrates"
  | "gomcalculator"
  | "clients"
  | "regions"
  | "technologies"
  | "pricingmodels"
  | "projecttypes"
  | "projectroles"
  | "auditlog"
  | "emailtemplates"
  | "notificationrules"
  | "sowadmin"
  | "holidays";

const SETTINGS_TAB_PERMISSION_RULES: Partial<Record<SettingsTabKey, string[]>> = {
  users: ["users:manage"],
  roles: ["roles:manage"],
  qpeoplemapping: ["roles:manage"],
  authconfig: ["settings:manage"],
  aiassistant: ["settings:manage"],
  announcement: ["settings:manage"],
  ratecards: ["costcard:manage"],
  budgetassumptions: ["settings:manage"],
  currencyrates: ["settings:manage"],
  gomcalculator: ["settings:manage"],
  clients: ["metadata:manage"],
  regions: ["metadata:manage"],
  technologies: ["metadata:manage"],
  pricingmodels: ["metadata:manage"],
  projecttypes: ["metadata:manage"],
  projectroles: ["metadata:manage"],
  holidays: ["settings:manage"],
  auditlog: ["auditlogs:view"],
  emailtemplates: ["settings:manage"],
  notificationrules: ["settings:manage"],
  sowadmin: ["settings:manage"],
};

export function canAccessSettingsTab(
  tab: SettingsTabKey,
  permissions: string[] | undefined
): boolean {
  const required = SETTINGS_TAB_PERMISSION_RULES[tab];
  if (!required?.length) return true;
  return hasAnyGrantedPermission(permissions, required);
}

export function canAccessSettingsArea(permissions: string[] | undefined): boolean {
  return hasAnyGrantedPermission(permissions, [
    "settings:view",
    "settings:manage",
    "users:manage",
    "roles:manage",
    "metadata:manage",
    "costcard:manage",
    "auditlogs:view",
  ]);
}

const ROUTE_ACCESS_RULES: Array<{ match: RegExp; any: string[] }> = [
  { match: /^\/dashboard\/opportunities\/new$/, any: ["pipeline:write"] },
  { match: /^\/dashboard\/opportunities(?:\/[^/]+)?$/, any: ["pipeline:view", "presales:view", "sales:view"] },
  { match: /^\/dashboard\/contacts$/, any: ["contacts:view", "contacts:write"] },
  { match: /^\/dashboard\/analytics$/, any: ["analytics:view", "analytics:export"] },
  { match: /^\/dashboard\/agents$/, any: ["agents:execute"] },
  { match: /^\/dashboard\/gom$/, any: ["gom:view", "approvals:manage"] },
  {
    match: /^\/dashboard\/settings(?:\/.*)?$/,
    any: ["settings:view", "settings:manage", "users:manage", "roles:manage", "metadata:manage", "costcard:manage", "auditlogs:view"],
  },
  { match: /^\/dashboard\/users\/[^/]+$/, any: ["users:manage"] },
  { match: /^\/dashboard$/, any: ["dashboard:view"] },
];

export function canAccessDashboardRoute(pathname: string, permissions: string[] | undefined): boolean {
  const rule = ROUTE_ACCESS_RULES.find((candidate) => candidate.match.test(pathname));
  if (!rule) return true;
  return hasAnyGrantedPermission(permissions, rule.any);
}
