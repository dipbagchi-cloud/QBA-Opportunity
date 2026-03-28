/**
 * Centralised mock data for all tests.
 * Shapes reflect the real backend API responses.
 */
import type {
  User,
  Opportunity,
  OpportunityListItem,
  Contact,
  AnalyticsSummary,
} from '../../types';
import type {BudgetAssumptions} from '../../lib/gom-calculator';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const mockRole = {
  id: 'role-admin-001',
  name: 'Admin',
  permissions: ['*'],
};

export const mockSalesRole = {
  id: 'role-sales-001',
  name: 'Sales',
  permissions: [
    'read_opportunities',
    'create_opportunities',
    'update_opportunities',
    'read_contacts',
    'create_contacts',
  ],
};

export const mockUser: User = {
  id: 'user-001',
  email: 'admin@qbalux.com',
  name: 'Admin User',
  title: 'CRM Administrator',
  department: 'Operations',
  role: mockRole,
  roles: [mockRole],
  team: {id: 'team-001', name: 'Core Team'},
};

export const mockSalesUser: User = {
  id: 'user-002',
  email: 'sales@qbalux.com',
  name: 'Sales Rep',
  title: 'Account Executive',
  department: 'Sales',
  role: mockSalesRole,
  roles: [mockSalesRole],
  team: {id: 'team-002', name: 'Sales Team'},
};

export const mockAuthResponse = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token',
  user: mockUser,
  mustChangePassword: false,
};

// ─── Opportunities ────────────────────────────────────────────────────────────

export const mockOpportunity: Opportunity = {
  id: 'opp-001',
  name: 'Digital Transformation Programme',
  clientName: 'Acme Corp',
  clientId: 'client-001',
  stage: 'Proposal',
  status: 'Active',
  value: 850000,
  currency: 'USD',
  probability: 65,
  expectedCloseDate: '2026-06-30',
  startDate: '2026-07-01',
  endDate: '2027-06-30',
  description: 'End-to-end digital transformation for Acme Corp.',
  region: 'North America',
  technology: 'Cloud & AI',
  projectType: 'Fixed Price',
  pricingModel: 'T&M',
  ownerId: 'user-001',
  owner: mockUser,
  teamId: 'team-001',
  team: {id: 'team-001', name: 'Core Team'},
  gomPercent: 32.5,
  gomApproved: false,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-03-10T14:30:00.000Z',
  contacts: [],
  comments: [],
  tags: ['enterprise', 'cloud'],
};

const makeOppListItem = (
  id: string,
  name: string,
  clientName: string,
  stage: Opportunity['stage'],
  value: number,
): OpportunityListItem => ({
  id,
  name,
  clientName,
  stage,
  status: 'Active',
  value,
  currency: 'USD',
  probability: 50,
  expectedCloseDate: '2026-12-31',
  gomPercent: 28,
  owner: {id: 'user-001', name: 'Admin User'},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
});

export const mockOpportunityList: OpportunityListItem[] = [
  makeOppListItem('opp-001', 'Digital Transformation Programme', 'Acme Corp', 'Proposal', 850000),
  makeOppListItem('opp-002', 'CRM Modernisation', 'Beta Ltd', 'Qualification', 320000),
  makeOppListItem('opp-003', 'Cloud Migration Sprint', 'Gamma Inc', 'Lead', 175000),
  makeOppListItem('opp-004', 'Data Analytics Platform', 'Delta AG', 'Negotiation', 1200000),
  makeOppListItem('opp-005', 'Mobile App Rollout', 'Epsilon Co', 'Closed Won', 440000),
];

// ─── Contacts ────────────────────────────────────────────────────────────────

export const mockContact: Contact = {
  id: 'contact-001',
  firstName: 'Dip',
  lastName: 'Bagchi',
  email: 'dip.bagchi@acmecorp.com',
  phone: '+1-555-0100',
  title: 'Chief Technology Officer',
  department: 'Technology',
  company: 'Acme Corp',
  clientId: 'client-001',
  notes: 'Decision maker for cloud initiatives.',
  linkedInUrl: 'https://linkedin.com/in/dipbagchi',
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-02-20T11:15:00.000Z',
};

const makeContact = (id: string, first: string, last: string, company: string): Contact => ({
  id,
  firstName: first,
  lastName: last,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
  phone: '+1-555-0100',
  title: 'Manager',
  department: 'Sales',
  company,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

export const mockContactList: Contact[] = [
  mockContact,
  makeContact('contact-002', 'Alice', 'Smith', 'Beta Ltd'),
  makeContact('contact-003', 'Bob', 'Jones', 'Gamma Inc'),
  makeContact('contact-004', 'Carol', 'Williams', 'Delta AG'),
  makeContact('contact-005', 'David', 'Brown', 'Epsilon Co'),
];

// ─── Analytics ───────────────────────────────────────────────────────────────

export const mockAnalyticsSummary: AnalyticsSummary = {
  totalOpportunities: 42,
  totalRevenuePipeline: 12500000,
  activeDeals: 30,
  winRate: 58.3,
  avgDealSize: 297619,
  closedWon: 14,
  closedLost: 10,
};

// ─── Budget / GOM ─────────────────────────────────────────────────────────────

/** Minimal assumptions — all overheads at 0 so raw math is simple. */
export const mockBudgetAssumptions: BudgetAssumptions = {
  marginPercent: 0,
  deliveryMgmtPercent: 0,
  benchPercent: 0,
  leaveEligibilityPercent: 0,
  annualGrowthBufferPercent: 0,
  averageIncrementPercent: 0,
  workingDaysPerYear: 250,
  bonusPercent: 0,
  indirectCostPercent: 0,
  welfarePerFte: 0,
  trainingPerFte: 0,
};

export const mockBudgetConfig = {
  minGomPercent: 15,
  gomAutoApprovePercent: 30,
  assumptions: mockBudgetAssumptions,
};

export const mockGomResult = {
  revenue: 500000,
  totalCost: 325000,
  grossMargin: 175000,
  gomPercent: 35,
  resourceCosts: [
    {role: 'Senior Consultant', rateCard: 'INDIA', quantity: 2, cost: 200000},
  ],
};
