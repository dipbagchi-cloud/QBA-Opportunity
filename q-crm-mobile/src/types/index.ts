/**
 * TypeScript interfaces for Q-CRM Mobile
 * Mirrors the backend Prisma schema + API response shapes
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  title?: string;
  department?: string;
  image?: string;
  role: Role;
  roles: Role[];
  team?: Team | null;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Team {
  id: string;
  name: string;
}

// ─── Opportunity ─────────────────────────────────────────────────────────────

export type OpportunityStage =
  | 'Lead'
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

export type OpportunityStatus = 'Active' | 'On Hold' | 'Cancelled';

export interface Opportunity {
  id: string;
  name: string;
  clientName: string;
  clientId?: string;
  stage: OpportunityStage;
  status: OpportunityStatus;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  region?: string;
  technology?: string;
  projectType?: string;
  pricingModel?: string;
  ownerId?: string;
  owner?: User;
  teamId?: string;
  team?: Team;
  gomPercent?: number;
  gomApproved?: boolean;
  gomApprovedAt?: string;
  gomApprovedBy?: User;
  createdAt: string;
  updatedAt: string;
  contacts?: Contact[];
  comments?: Comment[];
  tags?: string[];
}

export interface OpportunityListItem {
  id: string;
  name: string;
  clientName: string;
  stage: OpportunityStage;
  status: OpportunityStatus;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string;
  gomPercent?: number;
  owner?: {id: string; name: string};
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpportunityInput {
  name: string;
  clientId?: string;
  clientName?: string;
  stage: OpportunityStage;
  status?: OpportunityStatus;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  region?: string;
  technology?: string;
  projectType?: string;
  pricingModel?: string;
}

// ─── Contact ─────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  company?: string;
  clientId?: string;
  notes?: string;
  linkedInUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateContactInput = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Comment ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  content: string;
  opportunityId: string;
  authorId: string;
  author?: User;
  createdAt: string;
  updatedAt: string;
}

// ─── Client / Lead ──────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  country?: string;
  createdAt: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalOpportunities: number;
  totalRevenuePipeline: number;
  activeDeals: number;
  winRate: number;
  avgDealSize: number;
  closedWon: number;
  closedLost: number;
}

export interface StageBreakdown {
  stage: string;
  count: number;
  value: number;
}

export interface MonthlyTrend {
  month: string;
  created: number;
  closed: number;
  value: number;
}

// ─── GOM / Resource ──────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  role: string;
  location: 'Offshore' | 'Onsite';
  dailyRate: number;
  dailyCost: number;
  months: {month: string; days: number}[];
  opportunityId: string;
}

// ─── Approval ────────────────────────────────────────────────────────────────

export interface Approval {
  id: string;
  type: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  opportunityId: string;
  requestedById: string;
  requestedBy?: User;
  reviewedById?: string;
  reviewedBy?: User;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Master Data ─────────────────────────────────────────────────────────────

export interface MasterDataItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}
