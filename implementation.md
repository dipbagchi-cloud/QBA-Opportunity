# Q-CRM — Detailed Functional Implementation Reference

> **Last Updated:** April 10, 2026  
> **Production:** https://qcrm.qbadvisory.com  
> **Stack:** Next.js 15 (frontend) · Express.js + TypeScript (backend) · PostgreSQL + Prisma (database)

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control-rbac)
3. [Opportunity Lifecycle Management](#3-opportunity-lifecycle-management)
4. [Lead Intake & Qualification](#4-lead-intake--qualification)
5. [GOM (Gross Operating Margin) Calculator](#5-gom-gross-operating-margin-calculator)
6. [Approval Workflows](#6-approval-workflows)
7. [Notification System](#7-notification-system)
8. [Email System](#8-email-system)
9. [AI Chatbot](#9-ai-chatbot)
10. [Analytics & Reporting](#10-analytics--reporting)
11. [Client & Contact Management](#11-client--contact-management)
12. [Admin Panel](#12-admin-panel)
13. [Rate Cards & Cost Management](#13-rate-cards--cost-management)
14. [Master Data Management](#14-master-data-management)
15. [Audit Logging](#15-audit-logging)
16. [Agent Framework](#16-agent-framework)
17. [Deal-to-Project Conversion](#17-deal-to-project-conversion)
18. [Attachments & File Management](#18-attachments--file-management)
19. [Currency Management](#19-currency-management)
20. [Frontend Architecture](#20-frontend-architecture)

---

## 1. Authentication & Session Management

### Backend Implementation

**Files:**
- `backend/src/controllers/auth.controller.ts` — All auth endpoints
- `backend/src/services/auth.service.ts` — JWT, bcrypt, boot ID
- `backend/src/middleware/auth.ts` — JWT verification middleware

### Auth Modes

The system supports three authentication modes controlled by `system_config` table key `auth_mode`:

| Mode | Behavior |
|------|----------|
| `sso` | All `@qbadvisory.com` users authenticate via Microsoft Entra ID (Azure AD). Non-SSO users blocked. |
| `local` | All users authenticate with email + password. SSO disabled. |
| `hybrid` | SSO for `@qbadvisory.com` domain; local password for external users. |

Auth mode is cached for 60 seconds (`AUTH_CONFIG_TTL`) to reduce DB reads.

### Endpoints

#### `POST /api/auth/login` → Local Login
```
Body: { email, password }
Response: { token, mustChangePassword, user: { id, email, name, role, roles[], team } }
```
**Functional Logic:**
1. Validates email + password exist in request body.
2. Looks up user by email with `roles` and `team` included.
3. Checks `isActive` flag — inactive users cannot log in.
4. In `local` mode: if user has no `passwordHash`, auto-assigns default password `Welcome@CRM1` and sets `mustChangePassword: true`.
5. Compares password hash using bcrypt (12 rounds).
6. Updates `lastLoginAt` timestamp.
7. Builds JWT token containing: `userId`, `email`, `roleId`, `roleName`, `permissions[]`, `roles[]`, `bootId`.
8. Returns multiple roles if assigned — frontend can switch via `switchRole`.

#### `POST /api/auth/sso/callback` → Microsoft SSO
```
Body: { code }  (authorization code from Microsoft OAuth2 redirect)
Response: { token, user }
```
**Functional Logic:**
1. Exchanges auth code with Microsoft for ID token using `client_credentials`.
2. Decodes JWT ID token (base64 payload) to extract email.
3. Validates email ends with SSO domain (e.g., `@qbadvisory.com`).
4. Blocks SSO login if system is in `local` mode.
5. Finds user in database by case-insensitive email match.
6. Issues Q-CRM JWT token (same format as local login).
7. Creates `SSO_LOGIN` audit log entry with Microsoft email.

#### `GET /api/auth/sso/url` → Get SSO Redirect URL
Returns the Microsoft OAuth2 authorization URL for the configured tenant. Frontend redirects the browser to this URL.

#### `POST /api/auth/switch-role`
```
Body: { roleId }
Response: { token, user }
```
Allows users with multiple roles (e.g., Admin + Sales) to switch their active role. Verifies the user actually has the role, updates `activeRoleId` in database, and issues a new JWT with the switched role's permissions.

#### `PATCH /api/auth/change-password` / `PATCH /api/auth/set-password`
- `change-password`: Requires current password. Blocked for SSO users.
- `set-password`: First-time setup (only if `mustChangePassword: true`). No current password required.
- Both enforce minimum 6 characters, create audit log.

#### `GET /api/auth/me`
Returns the currently authenticated user's profile from the database (not just JWT cache). Used by frontend to refresh user data on page load.

#### `GET /api/auth/info` (Public)
Returns `{ mode, ssoDomain, ssoConfigured }`. Used by the login page to conditionally show SSO vs. local login form.

### Token Security

**File:** `backend/src/services/auth.service.ts`

```typescript
export const SERVER_BOOT_ID = crypto.randomBytes(8).toString('hex');
```

- Tokens expire in 24 hours (`JWT_EXPIRES_IN`).
- **Boot ID mechanism**: Each server restart generates a new random `bootId`. All tokens include the `bootId`. On verification, if the token's `bootId` doesn't match the current server's `bootId`, the token is rejected — effectively invalidating all sessions on server restart.
- Password hashing: bcrypt with 12 rounds.

### Auth Middleware

**File:** `backend/src/middleware/auth.ts`

Three middleware functions:

| Middleware | Purpose |
|-----------|---------|
| `authenticate` | Extracts Bearer token, verifies JWT, attaches `req.user` |
| `authorize(...perms)` | Checks user has ALL specified permissions |
| `authorizeAny(...perms)` | Checks user has ANY of the specified permissions |

### Frontend Implementation

**File:** `agentic-crm/app/login/page.tsx`

- Calls `GET /api/auth/info` on mount to determine auth mode.
- In `sso` mode: shows "Sign in with Microsoft" button, hides email/password form.
- In `local` mode: shows email/password form, hides SSO button.
- In `hybrid` mode: shows both.
- After SSO redirect: captures `code` query param, calls `POST /api/auth/sso/callback`.
- Stores JWT in `localStorage` as `auth_token`.
- If `mustChangePassword` is true, redirects to password change flow.

**File:** `agentic-crm/lib/api.ts` — API Client

```typescript
export async function apiClient<T>(path: string, options?: RequestInit): Promise<T>
```
- Automatically injects `Authorization: Bearer <token>` header.
- On 401 response: clears `auth_token` from localStorage and redirects to `/login`.
- All API calls throughout the frontend use this client.

**File:** `agentic-crm/components/providers/auth-provider.tsx`

Wraps the app in an auth context. Provides `user`, `login()`, `logout()`, `switchRole()` to all child components.

---

## 2. Role-Based Access Control (RBAC)

### Permission System

**File:** `backend/src/lib/permissions.ts`

Permissions follow `resource:action` pattern. The wildcard `*` grants full access (Admin only).

| Permission | Description |
|-----------|-------------|
| `users:manage` | Admin user CRUD |
| `roles:manage` | Admin role CRUD |
| `settings:manage` | System settings |
| `metadata:manage` | Master data CRUD |
| `costcard:manage` | Rate card management |
| `resources:manage` | Resource management |
| `pipeline:view` / `pipeline:write` | View/edit opportunities |
| `presales:view` / `presales:write` | View/edit presales data |
| `estimation:manage` | Manage estimations |
| `sales:view` / `sales:write` | View/edit sales data |
| `approvals:manage` | Manage approvals |
| `analytics:view` / `analytics:export` | View/export analytics |
| `agents:execute` | Execute AI agents |
| `leads:manage` | Lead ingestion |
| `auditlogs:view` | View audit trails |

### Default Role Presets

| Role | Key Permissions |
|------|----------------|
| **Admin** | `*` (all) |
| **Manager** | All view/write + approvals + analytics + audit |
| **Sales** | Pipeline read/write, sales write, analytics view |
| **Presales** | Pipeline view, presales read/write, estimation, analytics view |
| **Read-Only** | All view permissions, no write |
| **Management** | All view + analytics export |

### How Permissions Are Enforced

1. **Route level**: Middleware `authorize('pipeline:write')` on route definitions.
2. **Token level**: JWT contains flattened `permissions[]` array from active role.
3. **Frontend level**: `AuthProvider` exposes permissions; UI components conditionally render based on user permissions.

---

## 3. Opportunity Lifecycle Management

### Backend Implementation

**File:** `backend/src/controllers/opportunities.controller.ts`

This is the largest controller (~900 lines) handling the full opportunity lifecycle.

### Pipeline Stages

The system uses a 6-stage pipeline stored in the `stages` table:

| Stage | Order | Probability | Description |
|-------|-------|-------------|-------------|
| Discovery | 1 | 10% | Initial identification |
| Qualification | 2 | 25% | Presales estimation |
| Proposal | 3 | 50% | Sales proposal |
| Negotiation | 4 | 75% | Final negotiation |
| Closed Won | 5 | 100% | Deal won |
| Closed Lost | 6 | 0% | Deal lost |

### Endpoints

#### `GET /api/opportunities` → List with Computed Intelligence

```
Query: page, limit, search, stage
Response: { data[], total, page, limit, totalPages }
```

**Computed fields per opportunity:**

1. **Dynamic Probability** — Base probability from stage, boosted up to +9% for data completeness (presalesData, salesData, expectedCloseDate, description, duration, dayRate).

2. **Days in Stage** — Calculated from `stageHistory[0].enteredAt` (most recent stage entry), falls back to `createdAt`.

3. **Stalled Detection** — `daysInStage > 30` and not in a closed stage.

4. **Health Score** (composite 0-100):
   - Stage Progress (30%): Discovery=20, Qualification=40, Proposal=60, Negotiation=80, ClosedWon=100
   - Recency (30%): <7 days=100, 7-14=75, 14-30=50, 30-60=20, 60+=0
   - Deal Completeness (20%): 8 fields checked (description, region, practice, technology, duration, startDate, presalesData, rate)
   - Value Confidence (20%): pricingModel, duration, dayRate, endDate presence

5. **Status Derivation**: healthScore > 70 = "healthy", 40-70 = "at-risk", <40 = "critical"

#### `POST /api/opportunities` → Create

```
Body: { title, value, client, region, practice, technology, projectType, 
        tentativeStartDate, tentativeDuration, pricingModel, expectedDayRate, salesRepName }
```

**Functional Logic:**
1. Uses authenticated user as owner (`req.user.userId`).
2. Resolves client: if `clientId` not provided, searches by name or creates new client.
3. **Duplicate detection**: Checks for same title + client + owner created within last 30 seconds. If found, returns the existing record (idempotency guard).
4. Assigns to "Discovery" stage automatically.
5. Creates `CREATE` audit log with title, value, client, stage.

#### `PATCH /api/opportunities/:id` → Update (Core Lifecycle Logic)

This is the most complex endpoint. Handles:

**Stage Transition Logic:**
- Fetches previous state for audit diff.
- Resolves new stage if `stageName` or `stage` is provided.
- **Closed Won/Lost**: Sets `actualCloseDate` to now.
- **Closed Lost**: Sets `detailedStatus` to "Lost".
- **Re-estimation** (Sales → Qualification or Negotiation → Qualification):
  - Increments `reEstimateCount`.
  - Sets `detailedStatus` to "Sent for Re-estimate".
  - Resets `gomApproved` to false (forces re-approval of GOM).
- **Move to Proposal** (Qualification → Proposal):
  - **Blocks if `gomApproved` is false** — returns 400 "GOM must be approved before moving to Sales."
  - Sets `detailedStatus` based on `reEstimateCount`: 0 = "Estimation Submitted", >0 = "Re-estimation Submitted".

**Re-estimate Comment:**
If `body.reEstimateComment` is provided with a Qualification transition, creates a `Note` record as an audit trail.

**Audit Logging:**
Produces human-readable change descriptions by comparing previous vs. new values for: title, value, description, stage, client, region, practice, technology, pricingModel, presalesData, salesData.

**Special Audit Entries:**
- `SEND_BACK_REESTIMATE` — When sent back from Sales to Qualification.
- `ESTIMATION_SUBMITTED` — When moved from Qualification to Proposal.
- `MARK_LOST` — When salesData contains `lostRemarks`.

**Email Notifications (fire-and-forget):**
- Pipeline/Discovery save → Owner gets `pipeline_saved` email.
- Moved to Qualification/Presales → Manager gets `moved_to_presales` email; owner also notified.
- Moved to Proposal/Sales → Owner gets `presales_submitted_back` email.

**Notification Rules Engine (fire-and-forget):**
- On stage change: calls `evaluateStageChangeRules()` with full context.
- On every update: calls `evaluateDataConditionRules()` with current opportunity state.

#### `GET /api/opportunities/:id` → Single Opportunity Detail
Includes: client, stage, owner, attachments (sorted by uploadedAt desc). Also fetches related project if exists.

#### `GET /api/opportunities/:id/comments` / `POST /api/opportunities/:id/comments`
Comments are stored as `Note` records linked to the opportunity. Each note has an optional `stage` field indicating which page it was posted from (Pipeline, Presales, Sales).

#### `GET /api/opportunities/:id/audit-log`
Returns up to 100 most recent audit log entries for the opportunity, with user details.

### Frontend Implementation

**Files:**
- `agentic-crm/app/dashboard/opportunities/page.tsx` — List/Kanban view
- `agentic-crm/app/dashboard/opportunities/[id]/page.tsx` — Detail view (tabbed: Pipeline, Presales, Sales)
- `agentic-crm/app/dashboard/opportunities/new/page.tsx` — Create form
- `agentic-crm/components/opportunities/KanbanBoard.tsx` — Drag-and-drop Kanban

The opportunities list supports both table and Kanban views. The Kanban board visualizes opportunities as cards grouped by stage, with drag-and-drop to change stages. The detail page has three tabs (Pipeline, Presales, Sales) showing different data based on the opportunity's lifecycle stage.

---

## 4. Lead Intake & Qualification

### Backend Implementation

**File:** `backend/src/controllers/leads.controller.ts`

#### `POST /api/leads` → Lead Ingestion

**Lead Scoring Formula:**

```
Score = sum of:
  +25 if title contains C-level/VP/Director/Head
  +10 if title contains Manager
  +30 if budget > $50,000
  +15 if budget > $10,000
  +20 if company size is Enterprise
  +25 if source is "Inbound Demo Request"
  +15 if source is "Contact Form"
  Max: 99
```

**Functional Logic:**
1. **Deduplication**: Searches for existing contact by email. If found, checks for duplicate opportunity (same title + client within 60 days).
2. **Client/Contact Management**: Auto-creates client from `companyName` if not found. Auto-creates contact if not found.
3. **Scoring**: Calculates lead score with factor breakdown and explanation.
4. **Creation**: Creates opportunity in "Discovery" stage with linked `LeadScore` record.
5. Score > 70 = "Hot Lead!", 40-70 = "Warm Lead", <40 = "Low fit lead".

---

## 5. GOM (Gross Operating Margin) Calculator

### Shared Implementation (Frontend + Backend)

**Files:**
- `backend/src/lib/gom-calculator.ts` — Server-side GOM calculation
- `agentic-crm/lib/gom-calculator.ts` — Client-side GOM calculation (mirror)
- `agentic-crm/app/dashboard/gom/page.tsx` — GOM Calculator page

### Rate Card Calculation

```
Input: annualCtc + BudgetAssumptions
Output: { adjustedCost, monthlyCost, dailyCost }

adjustedCost = annualCtc 
  + (annualCtc × deliveryMgmtPercent/100)    // Delivery management overhead
  + (annualCtc × benchPercent/100)            // Bench cost
  + (annualCtc × leaveEligibilityPercent/100) // Leave costs
  + (annualCtc × annualGrowthBufferPercent/100) // Growth buffer
  + (annualCtc × averageIncrementPercent/100)   // Increment provision

dailyCost = adjustedCost / workingDaysPerYear
monthlyCost = adjustedCost / 12
```

### Budget Assumptions (Admin-Configurable)

Stored in `system_config` table under key `budget_assumptions`:

| Parameter | Description |
|-----------|-------------|
| `marginPercent` | Target gross margin % |
| `deliveryMgmtPercent` | Delivery management overhead % |
| `benchPercent` | Bench (non-billable) cost % |
| `leaveEligibilityPercent` | Leave cost % |
| `annualGrowthBufferPercent` | Growth buffer % |
| `averageIncrementPercent` | Average annual increment % |
| `workingDaysPerYear` | Working days (default: 240) |
| `bonusPercent` | Bonus allocation % |
| `indirectCostPercent` | Indirect costs % |
| `welfarePerFte` | Welfare cost per FTE (annual) |
| `trainingPerFte` | Training cost per FTE (annual) |

### Project GOM Calculation

Calculates total GOM across all resource lines and months:

```
Per Resource per Month:
  Revenue = dailyRate × days
  Cost = dailyCost × days + bonus + welfare + training + indirect

Total GOM = Total Revenue - Total Cost - Other Costs
GOM% = (GOM / Total Revenue) × 100
```

Monthly breakdown includes: salary, bonus, welfare, training, indirect, other costs.

### GOM Approval Workflow

**Endpoints in `opportunities.controller.ts`:**

#### `PATCH /api/opportunities/:id/approve-gom`
```
Body: { approved: boolean, gomPercent: number }
```
1. If `approved: false` → Revokes GOM approval, creates `GOM_REVOKED` audit entry.
2. Gets `gomAutoApprovePercent` threshold from budget assumptions.
3. If `gomPercent >= threshold` (or threshold is 0) → **Auto-approves** directly.
4. If `gomPercent < threshold` → Creates `ApprovalRequest` (type: `GOM_APPROVAL`) routed to the user's `reportingManagerName`.
5. Cancels any existing pending GOM approval for this opportunity first.

#### `GET /api/opportunities/:id/gom-approval-status`
Returns the latest pending `GOM_APPROVAL` request with requester and reviewer names.

#### `PATCH /api/opportunities/:id/review-gom-approval`
```
Body: { approved: boolean, comments: string }
```
Manager reviews and approves/rejects. If approved, sets `opportunity.gomApproved = true`. Creates `GOM_APPROVED` or `GOM_REJECTED` audit entry.

---

## 6. Approval Workflows

### Backend Implementation

**File:** `backend/src/controllers/approvals.controller.ts`

#### `POST /api/approvals` → Discount Approval

**Policy Rule:**
```
IF discountPercent > 15% AND marginPercent < 20%
  THEN require Finance Manager approval
ELSE
  auto-approve
```

Creates an `ApprovalRequest` record with type "Discount", status "Pending", and logs to audit trail.

### Database Model

```prisma
model ApprovalRequest {
  id            String
  type          String      // "Discount", "GOM_APPROVAL"
  reason        String?
  status        String      // "Pending", "Approved", "Rejected", "Cancelled"
  comments      String?
  requestedAt   DateTime
  reviewedAt    DateTime?
  opportunityId String
  requesterId   String
  reviewerId    String?
}
```

---

## 7. Notification System

### Architecture Overview

The notification system has three layers:
1. **Notification Rules** (admin-configurable triggers)
2. **Notification Engine** (evaluates rules on opportunity changes)
3. **Notification API** (delivers in-app notifications to users)

### Notification Rules CRUD

**File:** `backend/src/controllers/notification-rules.controller.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/notification-rules` | GET | List all rules |
| `/api/admin/notification-rules` | POST | Create rule |
| `/api/admin/notification-rules/:id` | PATCH | Update rule |
| `/api/admin/notification-rules/:id` | DELETE | Delete rule |

**Rule Structure:**

```json
{
  "name": "Alert Sales on Qualification Move",
  "triggerType": "stage_change",        // or "data_condition"
  "fromStage": "Discovery",            // null = any stage
  "toStage": "Qualification",          // null = any stage
  "conditions": null,                   // JSON array for data_condition type
  "recipientRoles": ["Sales", "Admin"], // Who receives notifications
  "channels": ["in_app", "email"],      // Delivery channels
  "emailTemplateKey": "moved_to_presales",
  "messageTemplate": "{{opportunityTitle}} moved to {{stageName}} by {{updatedBy}}"
}
```

Supported trigger types: `stage_change`, `data_condition`, `approval`, `stalled_deal`, `health_drop`.

### Notification Engine

**File:** `backend/src/lib/notification-engine.ts`

#### `evaluateStageChangeRules(ctx)`

Called from `opportunities.controller.ts` when a stage change occurs (fire-and-forget, doesn't block the HTTP response).

**Logic:**
1. Fetches all active rules with `triggerType: 'stage_change'`.
2. For each rule, checks if `fromStage` and `toStage` match the transition.
3. Resolves recipient users by querying users whose roles match `recipientRoles`.
4. Renders `messageTemplate` with `{{variable}}` placeholders (opportunityTitle, previousStage, stageName, clientName, ownerName, etc.).
5. For `in_app` channel: creates `Notification` record in database.
6. For `email` channel: calls `sendNotificationEmail()` with the rule's `emailTemplateKey`.

#### `evaluateDataConditionRules(opportunity)`

Called on every opportunity update (fire-and-forget).

**Condition Evaluation:**
```json
[
  { "field": "value", "operator": "gt", "value": "1000000" },
  { "field": "probability", "operator": "gte", "value": "75" }
]
```

Supported operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`.  
Supported fields: `value`, `probability`, `stage`, `region`, `technology`, `client`, `ownerName`, `salesRepName`, `managerName`.

All conditions must match (AND logic) for the rule to fire.

### Notification API

**File:** `backend/src/controllers/notifications.controller.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | List notifications (supports `?unreadOnly=true&limit=50&offset=0`) |
| `/api/notifications/unread-count` | GET | Get unread badge count |
| `/api/notifications/:id/read` | PATCH | Mark single notification as read |
| `/api/notifications/read-all` | PATCH | Mark all as read |

### Frontend: NotificationBell Component

**File:** `agentic-crm/app/dashboard/layout.tsx`

The `NotificationBell` component:
1. **Polls** `/api/notifications/unread-count` every 30 seconds.
2. Shows **badge** with unread count on the bell icon.
3. **Dropdown panel**: fetches latest 20 notifications, shows title, message, time ago.
4. **Click notification**: marks as read, navigates to `notification.link` (e.g., `/dashboard/opportunities/:id`).
5. **Mark all as read**: calls `PATCH /api/notifications/read-all`.
6. **Click outside to close**: uses `useRef` + click-outside listener.

---

## 8. Email System

### Backend Implementation

**File:** `backend/src/lib/email.ts`

### Dual-Mode Architecture

```
IF AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET are set
  → Use Microsoft Graph API (OAuth2 client_credentials flow)
ELSE
  → Use SMTP (nodemailer) fallback
```

### Graph API Flow

1. **Token acquisition** (`getGraphAccessToken`): Fetches OAuth2 token from Microsoft with `client_credentials` grant. Caches token until 60s before expiry.
2. **Send email** (`sendViaGraphApi`): Posts to `Graph API /users/{fromEmail}/sendMail` with HTML body.

### Template System

**File:** `backend/src/controllers/email-templates.controller.ts`

Email templates stored in `email_templates` table with placeholder syntax:

```html
Subject: "New Opportunity: {{opportunityTitle}} moved to {{stageName}}"
Body: "<h2>Hi {{recipientName}}</h2><p>{{opportunityTitle}} for {{clientName}} has been moved to {{stageName}}...</p>"
```

Available template variables: `opportunityTitle`, `opportunityId`, `clientName`, `stageName`, `previousStage`, `salesRepName`, `managerName`, `recipientName`, `recipientEmail`, `updatedBy`, `comment`.

### `sendNotificationEmail(eventKey, recipientEmail, recipientName, variables)`

**Logic:**
1. Checks if recipient has `muteNotification: true` → skips if muted.
2. Looks up template by `eventKey` (e.g., `pipeline_saved`, `moved_to_presales`).
3. If template not found or `isActive: false` → skips silently.
4. Renders subject and body with `{{variable}}` replacement.
5. Sends via Graph API or SMTP based on configuration.
6. Returns `true`/`false`, never throws (fire-and-forget pattern).

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/email-templates` | GET | List all templates |
| `/api/admin/email-templates/:id` | GET | Get single template |
| `/api/admin/email-templates/:id` | PATCH | Update subject/body/isActive |
| `/api/admin/email-templates/test` | POST | Send test email with mock data |

---

## 9. AI Chatbot

### Backend Implementation

**Files:**
- `backend/src/controllers/chatbot.controller.ts` — API endpoints
- `backend/src/lib/chatbot-v2.ts` — Core chatbot engine (2100+ lines)

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chatbot/message` | POST | Send message, get response |
| `/api/chatbot/history` | GET | Last 50 chat interactions |
| `/api/chatbot/suggestions` | GET | Permission-aware suggestions |
| `/api/chatbot/llm-status` | GET | Check if LLM is available |

### Chatbot Engine Architecture

**File:** `backend/src/lib/chatbot-v2.ts`

#### Conversation State Machine

Each user has a persistent conversation state (in-memory, 30-minute TTL):

```typescript
interface ConversationState {
  mode: 'idle' | 'creating' | 'updating' | 'confirming' | 'confirming_extract' | 'creating_lead' | 'creating_contact';
  entityType?: 'opportunity' | 'lead' | 'contact';
  collectedFields: Record<string, any>;
  missingRequired: string[];
  history: { role, content }[];
}
```

#### Master Data Cache

Caches all reference data (clients, stages, regions, technologies, pricing models, project types, users, currencies) for 5 minutes. Used for fuzzy matching user input against valid values.

#### Fuzzy Matching

Uses **Levenshtein distance** for entity resolution:
- Exact match → immediate resolution
- Starts-with match → resolved if single result
- Contains match → resolved if single result
- Similarity > 0.8 → auto-resolved
- Multiple matches → presents suggestions to user

#### Field Definitions

19 Opportunity fields with types, validation rules, and dynamic prompts:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 2 chars |
| `client` | master | Yes | Fuzzy match against clients |
| `value` | number | Yes | Supports K/M/Lakh/Cr suffixes |
| `currency` | masterCode | Yes | USD, EUR, INR, etc. |
| `technology` | master | Yes | Fuzzy match |
| `region` | master | Yes | Fuzzy match |
| `description` | string | Yes | Free text |
| `salesRepName` | master | Yes | Fuzzy match against users |
| `pricingModel` | master | Yes | Fuzzy match |
| `tentativeStartDate` | date | Yes | Natural language parsing (chrono-node) |
| `projectType` | master | No | "skip" to omit |
| `practice` | string | No | Free text |
| `managerName` | master | No | Fuzzy match |
| `tentativeDuration` | string | No | Parses "6 months", "12 weeks" |
| `expectedDayRate` | number | No | Numeric |
| `source` | select | No | Predefined options |
| `priority` | select | No | Low/Medium/High |
| `tags` | string | No | Comma-separated |
| `expectedCloseDate` | date | No | Natural language |

#### Natural Language Parsing

**Value parsing**: `500K` → 500000, `2M` → 2000000, `5 Lakh` → 500000, `1.5 Cr` → 15000000.

**Date parsing** (via chrono-node): `"next month"`, `"15 Jan 2026"`, `"01/15/2026"`, DD/MM/YYYY, MM/DD/YYYY formats. Falls back to `new Date()` parsing.

**Duration parsing**: `"6 months"` → `{ duration: "6", unit: "months" }`.

#### Capabilities (Permission-Aware)

Based on user's role permissions:
- `pipeline:view` → search/list opportunities, view details
- `pipeline:write` → create/update opportunities, change stages
- `analytics:view` → pipeline analytics, revenue breakdowns
- `leads:manage` → create leads

#### LLM Integration

Uses OpenAI API for:
- **Intent extraction** from natural language (via structured prompts)
- **Smart field extraction** from unstructured descriptions
- Falls back to regex/rule-based extraction if OpenAI is unavailable

### Frontend: ChatBot Component

**File:** `agentic-crm/components/chatbot/ChatBot.tsx`

Floating chatbot widget in the bottom-right corner:
- Collapsible panel with message history
- Auto-scroll, markdown rendering
- Permission-aware suggestion chips
- Loading indicator during API calls

---

## 10. Analytics & Reporting

### Backend Implementation

**File:** `backend/src/controllers/analytics.controller.ts`

#### `GET /api/analytics` → Comprehensive Dashboard Data

Single endpoint returns all analytics data. Processes all opportunities in-memory for real-time computation.

**Revenue Projection Logic:**
- If opportunity has presales resource estimation data → uses monthly resource breakdown:
  ```
  Per month per resource: days × dailyCost × (1 + markupPercent/100)
  ```
- Groups into monthly buckets: proposed (active), actual (Closed Won), lost (Closed Lost).
- Revenue chart sorted chronologically.

**Computed Metrics:**

| Metric | Formula |
|--------|---------|
| Pipeline Value | Sum of revenue for all active opportunities |
| Weighted Pipeline | Sum of (revenue × stage probability / 100) |
| Avg Deal Value | Pipeline Value / active opportunity count |
| Win Rate | won / (won + lost) × 100 |
| Conversion Rate | won / closed × 100 |
| Avg Time to Close | avg(actualCloseDate - createdAt) in days |
| Proposal Success Rate | moved-to-sales / presales-touched × 100 |
| Effort per Opportunity | total estimatedCost / presales opportunity count |

**Breakdowns:**
- By stage (status pie chart)
- By client (count + revenue)
- By owner/sales rep (count: total/active/won, revenue)
- By technology (revenue, split on comma-separated techs)
- By region (count + value)
- Conversion funnel (Pipeline → Presales → Sales → Won)
- Loss reasons
- Sales by owner (won revenue, won count, lost count)

### Frontend Implementation

**File:** `agentic-crm/app/dashboard/analytics/page.tsx`

Dashboard with multiple chart components:
- Revenue trend (bar chart: proposed/actual/lost by month)
- Stage distribution (pie chart)
- Pipeline by region (bar chart)
- Revenue by technology (horizontal bar)
- Sales leaderboard (table)
- Conversion funnel (stepped chart)
- KPI cards (pipeline value, weighted forecast, win rate, avg deal size)

---

## 11. Client & Contact Management

### Backend Implementation

**File:** `backend/src/controllers/contacts.controller.ts`

#### Contacts CRUD

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/contacts` | GET | List contacts (search, clientId, department filters, pagination) |
| `/api/contacts/:id` | GET | Get contact with client + recent activities |
| `/api/contacts` | POST | Create contact (requires firstName, lastName, clientId) |
| `/api/contacts/:id` | PATCH | Update contact fields |
| `/api/contacts/:id` | DELETE | Soft delete (sets `isActive: false`) |

Contacts are always linked to a `Client`. The contact list supports multi-field search (firstName, lastName, email, title, department) and sorts with `isPrimary` contacts first.

### Client Management (via Master Data)

**File:** `backend/src/controllers/master-data.controller.ts`

Clients use **soft-versioning** for updates: deactivates old record, creates new one. This preserves referential integrity for historical opportunities.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/master/clients` | GET | Active clients only |
| `/api/admin/clients` | GET | All clients (admin) |
| `/api/admin/clients` | POST | Create client |
| `/api/admin/clients/:id` | PATCH | Update (soft-version) |
| `/api/admin/clients/:id` | DELETE | Deactivate |

### Frontend Implementation

**File:** `agentic-crm/app/dashboard/contacts/page.tsx`

Contact list with search, filters (client, department), and CRUD modals.

---

## 12. Admin Panel

### Backend Implementation

**File:** `backend/src/controllers/admin.controller.ts`

### User Management

#### `GET /api/admin/users` → List Users (Paginated, Filterable, Sortable)

**Filters**: search (name/email/department), department, designation, role, status (active/inactive), reportingManager.  
**Sorting**: Whitelist-validated sort fields to prevent Prisma injection: `['name', 'email', 'department', 'designation', 'reportingManagerName', 'isActive', 'createdAt', 'lastLoginAt']`.

Returns `filters` object with distinct values for each filter dropdown (departments, designations, managers, roles, statuses).

#### `POST /api/admin/users` → Create User
- Multi-role assignment (`roleIds[]`).
- SSO users (domain match) don't get passwords.
- Non-SSO users get auto-assigned default password `Welcome@CRM1` with `mustChangePassword: true`.
- Checks email uniqueness.

#### `PATCH /api/admin/users/:id` → Update User
- Role assignment (multi-role with `set` operation).
- Toggle `isActive`, `muteNotification`.
- If current `activeRoleId` not in new role set → auto-resets to first role.

#### `PATCH /api/admin/users/:id/reset-password`
- Resets password for non-SSO users.
- Blocks SSO users with domain-specific error message.
- Sets `mustChangePassword: true`.

### Role Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/roles` | GET | List roles with user counts |
| `/api/admin/roles` | POST | Create custom role (name + permissions[]) |
| `/api/admin/roles/:id` | PATCH | Update role permissions |
| `/api/admin/roles/:id` | DELETE | Delete role (blocked if system role or has users) |
| `/api/admin/roles/:id/users` | POST | Assign user to role |
| `/api/admin/roles/:id/users/:userId` | DELETE | Remove user from role |

### System Configuration

Admin can manage:
- Auth mode settings
- Budget assumptions (GOM parameters)
- Auto-approve thresholds

### Frontend Implementation

**File:** `agentic-crm/app/dashboard/settings/page.tsx`

Tabbed settings page:
1. **Users Tab**: User table with search, column filters, sort, pagination. Inline toggle for active/mute. Edit modal for roles/details.
2. **Roles Tab**: Role cards showing permissions and assigned users. Create/edit role with permission checkboxes.
3. **Notification Rules Tab**: Create/edit/delete notification rules with trigger type, stage conditions, recipient roles, channels.
4. **Email Templates Tab**: View and edit templates, send test emails.
5. **Master Data Tab**: Manage regions, technologies, pricing models, project types, clients.
6. **Rate Cards Tab**: View/edit cost card table.
7. **Budget Assumptions Tab**: Configure GOM calculation parameters.
8. **Auth Settings Tab**: Switch between SSO/local/hybrid modes.
9. **Audit Logs Tab**: Searchable, filterable audit log viewer.

---

## 13. Rate Cards & Cost Management

### Backend Implementation

**File:** `backend/src/controllers/rate-cards.controller.ts`

### Data Model

```prisma
model RateCard {
  code           String   @unique
  role           String
  skill          String
  experienceBand String
  masterCtc      Float    // Master CTC benchmark
  mercerCtc      Float    // Mercer survey CTC
  copilot        Float    // AI-augmented cost factor
  existingCtc    Float    // Current actual CTC
  maxCtc         Float    // Maximum CTC band
  ctc            Float    // Effective CTC used for calculations
  category       String   // e.g., "Technology", "Consulting"
  isActive       Boolean
}
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rate-cards` | GET | Active rate cards (for estimation) |
| `/api/admin/rate-cards` | GET | All rate cards with pagination/search (admin) |
| `/api/admin/rate-cards` | POST | Create rate card (unique code required) |
| `/api/admin/rate-cards/:id` | PATCH | Update rate card fields |
| `/api/admin/rate-cards/:id` | DELETE | Delete rate card |

The presales estimation page uses rate cards to populate resource costs. When a resource is added to an estimation, its `dailyCost` is derived from the rate card's CTC through the GOM calculator formula (see section 5).

---

## 14. Master Data Management

### Backend Implementation

**File:** `backend/src/controllers/master-data.controller.ts`

All master data entities follow the same CRUD pattern with soft-delete (deactivate rather than delete) and audit logging.

### Managed Entities

| Entity | Table | Key Operations |
|--------|-------|----------------|
| **Clients** | `clients` | Soft-versioned updates (old deactivated, new created) |
| **Regions** | `regions` | Auto-seeds currencies for new regions |
| **Technologies** | `technologies` | Standard CRUD |
| **Pricing Models** | `pricing_models` | Standard CRUD |
| **Project Types** | `project_types` | Standard CRUD |
| **Currency Rates** | `currency_rates` | Synced from external API |

### Endpoints (per entity)

| Pattern | Description |
|---------|-------------|
| `GET /api/master/{entity}` | Active items only (for dropdowns) |
| `GET /api/admin/{entity}` | All items including inactive (admin) |
| `POST /api/admin/{entity}` | Create with duplicate check |
| `PATCH /api/admin/{entity}/:id` | Update (soft-version for clients/regions) |
| `DELETE /api/admin/{entity}/:id` | Soft-delete (deactivate) |

### Region → Currency Auto-Seeding

When a new region is created, currencies are automatically seeded based on a hardcoded mapping:

```
"India" → [INR]
"North America" → [USD, CAD, MXN]
"Europe" → [EUR, GBP, CHF, SEK, NOK, DKK, PLN]
"Asia Pacific" → [SGD, AUD, JPY, CNY, KRW, HKD, NZD, MYR, THB, PHP]
"Middle East" → [AED, SAR, QAR, KWD, BHD, OMR]
"Latin America" → [BRL, ARS, CLP, COP, PEN]
"Africa" → [ZAR, NGN, KES, EGP, GHS]
```

---

## 15. Audit Logging

### Backend Implementation

**File:** `backend/src/controllers/audit.controller.ts`

### Data Model

```prisma
model AuditLog {
  entity    String    // "Opportunity", "User", "Role", "Client", etc.
  entityId  String    // ID of the affected record
  action    String    // "CREATE", "UPDATE", "STAGE_CHANGE", "SSO_LOGIN", etc.
  changes   Json?     // Human-readable change description or diff
  userId    String?   // Who performed the action
  timestamp DateTime  // When
}
```

### Endpoints (Admin)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/audit-logs` | GET | Paginated, filterable audit logs |
| `/api/admin/audit-logs/entities` | GET | Distinct entity names (for filter dropdown) |
| `/api/admin/audit-logs/actions` | GET | Distinct action names (for filter dropdown) |

**Filters**: entity, entityId, action, userId, date range (from/to), free-text search (action, entity, user name/email).

### Audit Actions Across The System

| Action | Source |
|--------|--------|
| `CREATE` | New opportunity |
| `UPDATE` | Opportunity field changes |
| `STAGE_CHANGE` | Opportunity stage transition |
| `SEND_BACK_REESTIMATE` | Sales → Qualification transition |
| `ESTIMATION_SUBMITTED` | Qualification → Proposal transition |
| `MARK_LOST` | Lost remarks added |
| `CONVERT_TO_PROJECT` | Deal closed won, project created |
| `GOM_APPROVED` / `GOM_REJECTED` / `GOM_REVOKED` | GOM workflow |
| `GOM_APPROVAL_REQUESTED` | GOM below threshold |
| `CREATE_USER` / `UPDATE_USER` | User management |
| `RESET_PASSWORD` / `CHANGE_PASSWORD` / `SET_INITIAL_PASSWORD` | Password operations |
| `SSO_LOGIN` | Microsoft SSO authentication |
| `CREATE_ROLE` / `UPDATE_ROLE` / `DELETE_ROLE` | Role management |
| `ASSIGN_USER_TO_ROLE` / `REMOVE_USER_FROM_ROLE` | Role assignments |
| `LEAD_INGESTED` | Lead API ingestion |
| All master data CRUD | `CREATE`, `UPDATE`, `DELETE` per entity |

---

## 16. Agent Framework

### Backend Implementation

**File:** `backend/src/controllers/agents.controller.ts`  
**File:** `backend/src/lib/intelligence.ts`

### Agent Task Execution

#### `POST /api/agents/task`
```
Body: { actionType, context, userId, userApproved }
```

**Risk Classification:**
```
DELETE_DATA, SEND_CONTRACT → High Risk
SEND_EMAIL → Medium Risk
All others → Low Risk
```

**State Machine:** `REASONING → PROPOSING → EXECUTING → COMPLETED`

- High-risk actions require `userApproved: true` or return `AWAITING_APPROVAL`.
- `ANALYZE_EMAIL` action type triggers sentiment analysis. If negative sentiment detected (`action === 'PAUSE_AUTOMATION'`), agent pauses and requests human intervention.

#### `POST /api/agent/run` → SSE Streaming Agent Simulation

Server-Sent Events (SSE) endpoint that streams agent execution steps:

```json
{ "step": "Observation", "detail": "Reading input...", "status": "thinking" }
{ "step": "Action", "detail": "Executing Tool: Search Web", "status": "action" }
{ "step": "Success", "detail": "Research complete.", "status": "success" }
```

Two demo agent types:
1. **Researcher (agent 2)**: Simulates web search, LinkedIn scraping, data enrichment.
2. **Outreach (agent 1)**: Simulates prospect analysis, template selection, email drafting.

### Frontend Implementation

**File:** `agentic-crm/app/dashboard/agents/page.tsx`

Agent cards with "Run" buttons. Each agent shows real-time execution steps streamed via SSE. Includes:
- Agent type selection
- Task input
- Real-time step-by-step execution visualization
- Risk level display
- Approval prompt for high-risk actions

---

## 17. Deal-to-Project Conversion

### Backend Implementation

**File:** `backend/src/controllers/opportunities.controller.ts` → `convertOpportunity()`

#### `POST /api/opportunities/:id/convert`

**Logic:**
1. Fetches opportunity with client.
2. **Idempotency**: If project already exists for this opportunity, returns 409 with existing `projectId`.
3. Creates `Project` record with auto-mapped fields:
   - `name` ← opportunity title
   - `code` ← `PROJ-{year}-{random}`
   - `description` ← opportunity description
   - `budget` ← opportunity value
   - `startDate` ← expectedCloseDate or now
   - `managerId` ← opportunity owner
   - `clientId` ← opportunity client
4. Creates initial milestones:
   - "Project Kickoff" (due: now + 7 days)
   - "Requirements Gathering" (due: now + 21 days)
5. Updates opportunity: stage → "Closed Won", detailedStatus → "SOW Approved", sets actualCloseDate.
6. Creates `CONVERT_TO_PROJECT` audit log.

### Project Data Model

```prisma
model Project {
  name, code, description, status
  startDate, endDate, budget, consumed
  currency, healthScore, riskLevel, scheduleVariance
  clientId, opportunityId (unique), managerId
  milestones[], risks[], team[]
}
```

---

## 18. Attachments & File Management

### Backend Implementation

**File:** `backend/src/controllers/opportunities.controller.ts`

Files stored in `backend/uploads/` directory with metadata in `attachments` table.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/opportunities/:id/attachments` | POST | Upload file (multipart/form-data) |
| `/api/opportunities/:id/attachments/:attachmentId/download` | GET | Download file |
| `/api/opportunities/:id/attachments/:attachmentId` | DELETE | Delete file from disk + DB |

Upload directory auto-created if missing. Files served with `Content-Disposition: attachment` header for forced download.

---

## 19. Currency Management

### Backend Implementation

**File:** `backend/src/controllers/currency.controller.ts`

### Data Model

```prisma
model CurrencyRate {
  code         String   // "USD", "EUR"
  name         String   // "US Dollar"
  symbol       String   // "$"
  region       String   // linked region
  rateToBase   Float    // rate vs INR (base currency)
  baseCurrency String   // "INR"
  lastSynced   DateTime?
}
```

### Exchange Rate Sync

#### `POST /api/admin/currency/sync`

Syncs rates from `open.er-api.com` (free, no API key):
1. Fetches latest rates for base currency (default: INR).
2. Updates all existing currency records with current rates.
3. Tracks `lastSynced` timestamp.

### Frontend Implementation

**File:** `agentic-crm/components/providers/currency-provider.tsx`

Currency context provider that:
- Fetches all currency rates on mount.
- Provides currency formatting utilities.
- Estimates display values based on opportunity's currency.
- Used by the estimation pages and analytics for multi-currency display.

---

## 20. Frontend Architecture

### Technology Stack

- **Framework**: Next.js 15.0.3 (App Router)
- **UI Library**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **State**: React Context (AuthProvider, CurrencyProvider, ThemeProvider)
- **API Client**: Custom `apiClient()` with auto-auth and 401 handling
- **Charts**: Recharts
- **Icons**: Lucide React

### Route Structure

```
/                           → Landing page (public)
/login                      → Auth page (SSO/local/hybrid)
/dashboard                  → Dashboard home (KPI cards, recent activity)
/dashboard/opportunities    → Opportunity list (table + Kanban)
/dashboard/opportunities/new → Create opportunity form
/dashboard/opportunities/[id] → Opportunity detail (Pipeline/Presales/Sales tabs)
/dashboard/contacts         → Contact management
/dashboard/analytics        → Analytics dashboard
/dashboard/agents           → AI agent execution
/dashboard/gom              → GOM Calculator
/dashboard/settings         → Admin panel (multi-tab)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `KanbanBoard` | `components/opportunities/KanbanBoard.tsx` | Drag-and-drop opportunity board by stage |
| `ChatBot` | `components/chatbot/ChatBot.tsx` | Floating AI assistant with message history |
| `NotificationBell` | `app/dashboard/layout.tsx` | Real-time notification dropdown with polling |
| `AuthProvider` | `components/providers/auth-provider.tsx` | Auth context, login/logout, role switching |
| `CurrencyProvider` | `components/providers/currency-provider.tsx` | Multi-currency formatting |
| `ThemeProvider` | `components/providers/theme-provider.tsx` | Dark/light mode |

### Dashboard Layout

**File:** `agentic-crm/app/dashboard/layout.tsx`

Provides:
- Left sidebar navigation (collapsible)
- Top bar with: page title, notification bell, user avatar/menu
- Role-switching dropdown
- Responsive design (sidebar collapses on mobile)
- Theme toggle

### API Integration Pattern

All pages follow the same pattern:
1. `useEffect` on mount → call `apiClient('/api/...')`.
2. Loading states with skeleton components.
3. Error handling with error boundaries (`error.tsx` in each route).
4. Optimistic updates for instant UI feedback.
5. Toast notifications for success/error feedback.

---

## Database Schema Summary

### Core Tables

| Table | Records | Purpose |
|-------|---------|---------|
| `users` | 308 | QPeople-synced users with roles |
| `roles` | 7 | Admin, Manager, Sales, Presales, Read-Only, Management, etc. |
| `opportunities` | Active pipeline | Full lifecycle from Discovery to Closed |
| `clients` | Imported + auto-created | Client companies |
| `contacts` | Client contacts | People at client companies |
| `stages` | 6 | Pipeline stages with order and probability |
| `audit_logs` | Growing | Every data mutation logged |
| `notifications` | Growing | In-app notification queue |
| `notification_rules` | Admin-configured | Trigger definitions |
| `email_templates` | Admin-configured | Email content templates |
| `rate_cards` | Imported from Excel | Cost rate data for estimation |
| `approval_requests` | As needed | GOM + discount approvals |
| `attachments` | Per opportunity | Uploaded files metadata |
| `notes` | Per opportunity | Comments/notes by stage |
| `stage_history` | Per opportunity | Stage transition timestamps |
| `ai_interactions` | Per user | Chatbot conversation log |
| `projects` | Converted deals | Post-won project tracking |

### Key JSON Fields

| Table.Column | Structure |
|-------------|-----------|
| `opportunities.presalesData` | `{ resources[], markupPercent, estimatedCost, selectedYear, comments, managerName, proposalDueDate }` |
| `opportunities.salesData` | `{ finalQuote, lostRemarks, notes, closingComments }` |
| `roles.permissions` | `string[]` e.g., `["pipeline:view", "pipeline:write", "analytics:view"]` |
| `notification_rules.conditions` | `[{ field, operator, value }]` |
| `notification_rules.recipientRoles` | `string[]` e.g., `["Admin", "Manager"]` |
| `notification_rules.channels` | `string[]` e.g., `["in_app", "email"]` |
| `system_config.value` | Varies by key (JSON object) |
