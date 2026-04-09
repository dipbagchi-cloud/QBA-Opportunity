# Agentic CRM — Detailed Technical Documentation

> **Last Updated:** April 10, 2026  
> **Project Location:** `d:\Opportunity\Jaydeep_work\`  
> **Production URL:** `https://qcrm.qbadvisory.com`  
> **Status:** Active Development & Production Deployment

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Database Schema (Prisma)](#4-database-schema-prisma)
5. [Authentication & Authorization (RBAC)](#5-authentication--authorization-rbac)
6. [Backend API Reference](#6-backend-api-reference)
7. [Frontend Pages & Components](#7-frontend-pages--components)
8. [Business Logic & Algorithms](#8-business-logic--algorithms)
9. [Features Implemented (Epic-by-Epic)](#9-features-implemented-epic-by-epic)
10. [Seed Data & Initial Setup](#10-seed-data--initial-setup)
11. [UI/UX Design System](#11-uiux-design-system)
12. [Work Log — All Changes Delivered](#12-work-log--all-changes-delivered)
13. [Known Limitations & Future Enhancements](#13-known-limitations--future-enhancements)
14. [Production Deployment](#14-production-deployment)
15. [How to Run](#15-how-to-run)

---

## 1. Project Overview

The **Agentic CRM** is an AI-powered Lead & Opportunity Management System designed for modern sales operations. It provides:

- **Full opportunity lifecycle management** (Pipeline → Presales → Sales → Project)
- **Role-Based Access Control (RBAC)** with 5 configurable roles
- **Dynamic analytics dashboard** with real-time metrics
- **GOM (Gross Operating Margin) calculator** for project profitability
- **Cost card management** with 393+ rate card entries
- **Agentic AI simulation** with agent governance and sentiment analysis
- **Lead scoring** with automatic qualification
- **Deal governance & approvals** workflow
- **Deal-to-Project conversion** with milestone auto-creation

---

## 2. Architecture & Tech Stack

### High-Level Architecture

```
┌──────────────────────────────────┐
│        Next.js Frontend          │
│     (App Router, Port 3000)      │
│  ┌────────────────────────────┐  │
│  │  Zustand Stores (Auth,    │  │
│  │  Opportunities)           │  │
│  │  ↕ fetch + Bearer Token   │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │ REST API (JSON)
               ▼
┌──────────────────────────────────┐
│       Express.js Backend         │
│        (Port 3001)               │
│  ┌────────────────────────────┐  │
│  │  JWT Auth Middleware       │  │
│  │  RBAC Permission Guards   │  │
│  │  Controllers + Services   │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │ Prisma ORM
               ▼
┌──────────────────────────────────┐
│     PostgreSQL Database          │
│     (agentic_crm)                │
│     25+ tables, CUID IDs        │
└──────────────────────────────────┘
```

### Technology Stack

| Layer              | Technology                        | Version      |
|--------------------|-----------------------------------|-------------|
| **Frontend**       | Next.js (App Router)              | 15.0.3      |
| **UI Library**     | React                             | 19          |
| **Styling**        | Tailwind CSS                      | v4          |
| **Animations**     | Framer Motion                     | Latest      |
| **Charts**         | Recharts                          | Latest      |
| **State Mgmt**     | Zustand                           | Latest      |
| **Icons**          | Lucide React                      | Latest      |
| **Backend**        | Express.js                        | 4.21.0      |
| **ORM**            | Prisma Client                     | 6.19.2      |
| **Database**       | PostgreSQL                        | 14+         |
| **Authentication** | JSON Web Tokens (JWT)             | 9.0.3       |
| **Password Hash**  | bcryptjs (12 rounds)              | 3.0.3       |
| **Language**       | TypeScript                        | 5.0+        |

---

## 3. Folder Structure

```
Jaydeep_work/
├── TESTING_GUIDE.md                    # End-to-end UAT scenarios
├── DETAILED_DOCUMENTATION.md           # This file
│
├── agentic-crm/                        # ── FRONTEND ──
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.js
│   ├── eslint.config.mjs
│   │
│   ├── app/
│   │   ├── globals.css                 # Global styles, glassmorphism, animations
│   │   ├── layout.tsx                  # Root layout (ThemeProvider, metadata)
│   │   ├── page.tsx                    # Landing/marketing page
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx               # JWT login form
│   │   │
│   │   └── dashboard/
│   │       ├── layout.tsx             # Sidebar + header (icon-mode collapse)
│   │       ├── page.tsx               # Dynamic analytics dashboard
│   │       │
│   │       ├── opportunities/
│   │       │   ├── page.tsx           # List/Kanban view
│   │       │   ├── new/
│   │       │   │   └── page.tsx       # Create opportunity form
│   │       │   └── [id]/
│   │       │       ├── page.tsx       # Opportunity detail (4-tab stepper)
│   │       │       ├── context/
│   │       │       │   └── OpportunityEstimationContext.tsx
│   │       │       └── components/
│   │       │           ├── AssumptionsView.tsx
│   │       │           ├── EstimationTab.tsx
│   │       │           ├── GomCalculatorTab.tsx
│   │       │           └── ResourceAssignmentTab.tsx
│   │       │
│   │       ├── contacts/
│   │       │   └── page.tsx           # Contacts listing
│   │       ├── analytics/
│   │       │   └── page.tsx           # Full analytics with 4 tabs
│   │       ├── agents/
│   │       │   └── page.tsx           # Agentic AI simulation
│   │       ├── gom/
│   │       │   └── page.tsx           # Standalone GOM calculator
│   │       └── settings/
│   │           └── page.tsx           # Admin settings (users, roles, master data)
│   │
│   ├── components/
│   │   ├── opportunities/
│   │   │   └── KanbanBoard.tsx        # Drag-and-drop Kanban
│   │   ├── providers/
│   │   │   └── theme-provider.tsx     # Dark/light mode
│   │   └── ui/
│   │       ├── toast.tsx              # Radix toast component
│   │       └── toaster.tsx            # Toast container
│   │
│   ├── hooks/
│   │   └── use-toast.ts              # Toast hook
│   │
│   └── lib/
│       ├── api.ts                     # API client with auto Bearer token
│       ├── auth-store.ts             # Zustand auth store (login, permissions)
│       ├── store.ts                  # Zustand opportunity store
│       ├── gom-calculator.ts         # GOM calculation logic (shared)
│       ├── rate-cards.ts             # Rate card data & calculations
│       └── utils.ts                  # Utility helpers (cn, formatters)
│
└── backend/                           # ── BACKEND ──
    ├── package.json
    ├── tsconfig.json
    │
    ├── prisma/
    │   ├── schema.prisma             # Full PostgreSQL schema (25+ models)
    │   ├── seed.ts                   # Database seeder
    │   └── rate-cards-data.json      # 393 rate card entries (from Excel)
    │
    └── src/
        ├── index.ts                  # Express app entry point
        ├── check-db.ts              # Database connectivity check
        │
        ├── controllers/
        │   ├── opportunities.controller.ts  # CRUD + convert + dynamic metrics
        │   ├── analytics.controller.ts      # Dashboard BI data
        │   ├── leads.controller.ts          # Lead ingestion + scoring
        │   ├── agents.controller.ts         # Agent task execution + SSE
        │   ├── approvals.controller.ts      # Deal governance
        │   ├── resources.controller.ts      # Resource listing
        │   └── auth.controller.ts           # Login, getMe, changePassword
        │
        ├── routes/
        │   ├── auth.routes.ts               # /api/auth/*
        │   ├── admin.routes.ts              # /api/admin/* (master data CRUD)
        │   ├── opportunities.routes.ts      # /api/opportunities/*
        │   ├── analytics.routes.ts          # /api/analytics
        │   ├── leads.routes.ts              # /api/leads
        │   ├── agents.routes.ts             # /api/agents/*
        │   ├── approvals.routes.ts          # /api/approvals
        │   ├── resources.routes.ts          # /api/resources
        │   ├── rate-cards.routes.ts         # /api/rate-cards
        │   └── master-data.routes.ts        # /api/master/*
        │
        ├── middleware/
        │   ├── auth.ts                      # JWT authenticate + authorize
        │   └── errorHandler.ts              # Global error handler
        │
        ├── lib/
        │   ├── prisma.ts                    # Prisma client singleton
        │   ├── permissions.ts               # PERMISSIONS constants + helpers
        │   ├── gom-calculator.ts            # Server-side GOM calculation
        │   ├── rate-cards.ts                # Rate card data + calculation
        │   └── intelligence.ts              # Sentiment analysis + forecasting
        │
        └── services/
            └── auth.service.ts              # JWT sign/verify, bcrypt hash/compare
```

---

## 4. Database Schema (Prisma)

### Entity-Relationship Overview

The database contains **25+ models** organized into domains:

#### 4.1 User Management & Authentication

**User** (`users` table)
| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| email | String (unique) | Login identifier |
| passwordHash | String | bcrypt hash (12 rounds) |
| name | String | Display name |
| title | String? | Job title |
| department | String? | Department |
| designation | String? | Designation level |
| phone | String? | Contact number |
| isActive | Boolean | Account status |
| externalId | String? (unique) | External system reference |
| qpeopleId | String? (unique) | QPeople integration ID |
| roleId | String (FK) | → Role |
| teamId | String? (FK) | → Team |

**Role** (`roles` table)
| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String (unique) | Role name (Admin, Manager, Sales, Presales, Read-Only) |
| permissions | Json | Array of permission strings |
| isSystem | Boolean | Whether role is system-managed |

**Team** (`teams` table) — Groups users into teams for opportunity assignment.

#### 4.2 Clients & Contacts

**Client** (`clients` table) — Companies/organizations.  
Key fields: `name`, `domain`, `industry`, `size`, `revenue`, `location`, `country`, `enrichmentData` (Json).

**Contact** (`contacts` table) — Individual people linked to clients.  
Key fields: `firstName`, `lastName`, `email`, `phone`, `title`, `department`, `isPrimary`, `linkedInUrl`.

#### 4.3 Resources (HRMS Mock)

**Resource** (`resources` table)
| Field | Type | Description |
|-------|------|-------------|
| name | String | Resource name |
| grade | String | L1-L5 grade level |
| effortFactor | Float | Effort multiplier |
| attritionFactor | Float | Attrition risk factor |
| standardRate | Float | Standard billing rate |
| skills | String? | Comma-separated skill list |
| availability | Boolean | Current availability |

#### 4.4 Rate Cards

**RateCard** (`rate_cards` table) — 393 entries from Excel import.
| Field | Type | Description |
|-------|------|-------------|
| code | String (unique) | Rate card code (e.g., "NET-00-02") |
| role | String | Role title (e.g., ".NET Developer (00-02)") |
| skill | String | Skill category |
| experienceBand | String | Experience years band |
| masterCtc, mercerCtc, copilot, existingCtc, maxCtc | Float | Various CTC benchmarks |
| ctc | Float | Final CTC value |
| category | String | "ADM", "SAP Functional", "SAP Technical", "Management" |

#### 4.5 Master Data (Admin-managed)

- **Region** (`regions`) — North America, Europe, Asia Pacific, etc.  
- **Technology** (`technologies`) — .NET, Java, Python, React, SAP, AI/ML, etc. (20 entries)  
- **PricingModel** (`pricing_models`) — Fixed Price, T&M, Hybrid, Managed Services, etc.

#### 4.6 Opportunities & Lifecycle

**Opportunity** (`opportunities` table) — Central entity.
| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| title | String | Opportunity name |
| description | String? | Description |
| value | Decimal | Deal value |
| currency | String | Default "USD" |
| probability | Int | Win probability (computed dynamically) |
| expectedCloseDate | DateTime? | Expected close date |
| actualCloseDate | DateTime? | When actually closed |
| source | String? | Lead source |
| priority | String | "Low", "Medium", "High" |
| tags | String | Comma-separated tags |
| currentStage | String | Display stage ("Pipeline", "Presales", etc.) |
| detailedStatus | String? | Sub-status ("in process", "Lost", "SOW Approved") |
| region | String? | Geographic region |
| practice | String? | Business practice |
| technology | String? | Primary technology |
| tentativeStartDate | DateTime? | Project start date |
| tentativeDuration | String? | Duration in months |
| tentativeEndDate | DateTime? | Computed end date |
| pricingModel | String? | Pricing model |
| expectedDayRate | Decimal? | Expected billing rate |
| salesRepName | String? | Assigned sales rep |
| presalesData | Json? | Full presales estimation blob |
| salesData | Json? | Sales stage data + lost remarks |
| clientId | FK → Client | |
| ownerId | FK → User | |
| stageId | FK → Stage | |
| typeId | FK → OpportunityType | |

**Stage** (`stages` table) — 6 pipeline stages:
| Name | Order | Probability | isClosed | isWon |
|------|-------|-------------|----------|-------|
| Discovery | 1 | 10% | false | false |
| Qualification | 2 | 30% | false | false |
| Proposal | 3 | 50% | false | false |
| Negotiation | 4 | 80% | false | false |
| Closed Won | 5 | 100% | true | true |
| Closed Lost | 6 | 0% | true | false |

**OpportunityType** (`opportunity_types` table) — "New Business" type by default.

**StageHistory** (`stage_history`) — Tracks every stage transition with timestamps.

#### 4.7 Activities & Collaboration

- **Activity** (`activities`) — Calls, meetings, emails linked to opportunities.
- **Task** (`tasks`) — Action items with assignee, due date, status.
- **Note** (`notes`) — Free-text notes with mentions and pins.
- **Attachment** (`attachments`) — File uploads with metadata.

#### 4.8 Workflow & Approvals

**ApprovalRequest** (`approval_requests`)
- Type: "Discount"
- Status: "Pending" | "Approved" | "Rejected"
- Fields: reason, comments, requesterId, reviewerId
- Auto-approval rule: discountPercent ≤ 15% OR marginPercent ≥ 20%

#### 4.9 AI & Agentic Features

**AIInteraction** (`ai_interactions`) — Logs AI prompts, responses, tool calls, cost, latency.  
**LeadScore** (`lead_scores`) — Computed score with factors and recommended action (1:1 with Opportunity).  
**VectorEmbedding** (`vector_embeddings`) — RAG-ready embeddings (schema prepared, not yet utilized).

#### 4.10 Notifications & Email System

**Notification** (`notifications`) — In-app notifications for stage changes, data conditions, etc.
| Field | Type | Description |
|-------|------|-------------|
| type | String | "stage_change", "data_condition", "approval", etc. |
| title | String | Notification headline |
| message | String | Notification body text |
| link | String? | Deep-link to related entity (e.g., `/dashboard/opportunities/{id}`) |
| isRead | Boolean | Read status (default false) |
| readAt | DateTime? | When the user read it |
| userId | FK → User | |

**NotificationPreference** (`notification_preferences`) — Per-user channel/type toggle.

**NotificationRule** (`notification_rules`) — Configurable rules that trigger notifications:
| Field | Type | Description |
|-------|------|-------------|
| name | String | Rule name |
| description | String? | Rule description |
| isActive | Boolean | Enable/disable toggle |
| triggerType | String | "stage_change", "data_condition", "approval", "stalled_deal", "health_drop" |
| fromStage | String? | For stage_change: source stage (null = any) |
| toStage | String? | For stage_change: target stage (null = any) |
| conditions | Json? | For data_condition: array of `{field, operator, value}` |
| recipientRoles | Json | Array of role names e.g. `["Admin","Manager"]` |
| channels | Json | Array of channels e.g. `["in_app","email"]` |
| emailTemplateKey | String? | Which EmailTemplate to use for email channel |
| messageTemplate | String? | Custom message with `{{variable}}` placeholders |

**EmailTemplate** (`email_templates`) — Reusable email templates:
| Field | Type | Description |
|-------|------|-------------|
| eventKey | String (unique) | Template identifier (e.g., "moved_to_presales") |
| name | String | Display name |
| subject | String | Email subject with `{{variable}}` placeholders |
| body | String | HTML body with `{{variable}}` placeholders |
| isActive | Boolean | Enable/disable |

**User.muteNotification** (`Boolean @default(true)`) — When true, email notifications are suppressed for this user. Admins can toggle this per-user in the Settings → Users tab. In-app notifications are NOT affected by this flag.

#### 4.11 Audit & Config

**AuditLog** (`audit_logs`) — Entity, action, changes (Json), userId, timestamp.  
**SystemConfig** (`system_config`) — Key-value configuration store (e.g., budget assumptions).

#### 4.12 Project Delivery (Epic 6 & 7)

**Project** (`projects`)
| Field | Type | Description |
|-------|------|-------------|
| name | String | Project name (from opportunity title) |
| code | String? (unique) | Auto-generated code (PROJ-YYYY-NNN) |
| status | String | "Planning" (default) |
| budget | Decimal? | Mapped from opportunity value |
| healthScore | Int | Default 100 |
| riskLevel | String | "Low" (default) |
| scheduleVariance | Decimal? | 0 |
| opportunityId | String? (unique) | 1:1 with Opportunity |

**Milestone** (`milestones`) — Auto-created on conversion: "Project Kickoff", "Requirements Gathering".  
**ProjectRisk** (`project_risks`) — Risk register with impact, probability, mitigation plan.  
**ProjectMember** (`project_members`) — Team allocation with role and percentage.

---

## 5. Authentication & Authorization (RBAC)

### 5.1 Authentication Flow

```
1. User submits email + password to POST /api/auth/login
2. Backend verifies password via bcrypt.compare()
3. On success, generates JWT token with payload:
   {
     userId, email, roleId, roleName,
     permissions: ["pipeline:view", "pipeline:write", ...]
   }
4. Token returned to frontend, stored in localStorage
5. All subsequent API calls include: Authorization: Bearer <token>
6. Backend middleware extracts & verifies token on every request
7. 401 → Frontend redirects to /login
```

### 5.2 JWT Configuration

- **Secret:** Environment variable `JWT_SECRET` (fallback: hardcoded dev secret)
- **Expiration:** 24 hours
- **Algorithm:** HS256 (default jsonwebtoken)
- **Password Hashing:** bcrypt with 12 salt rounds

### 5.3 Middleware Stack

1. **`authenticate`** — Extracts Bearer token, verifies JWT, attaches `req.user` (TokenPayload).
2. **`authorize(...permissions)`** — Checks that `req.user.permissions` includes all required permissions. Supports wildcard `*` for Admin.

### 5.4 Role Definitions & Permissions

The system defines **5 roles** with granular permission strings:

#### Permission Constants (16 permissions)

| Permission | Description |
|-----------|-------------|
| `users:manage` | Create/edit/deactivate users |
| `roles:manage` | Create/edit roles and permission sets |
| `settings:manage` | Manage system settings |
| `metadata:manage` | CRUD master data (clients, regions, tech, pricing) |
| `costcard:manage` | Manage rate cards and budget assumptions |
| `resources:manage` | Manage HRMS resources |
| `pipeline:view` | View opportunities list/kanban |
| `pipeline:write` | Create/edit/delete opportunities |
| `presales:view` | View presales estimations |
| `presales:write` | Edit presales estimations |
| `estimation:manage` | Full estimation management |
| `sales:view` | View sales stage data |
| `sales:write` | Edit sales data, convert deals |
| `approvals:manage` | Create/review approval requests |
| `analytics:view` | View dashboard and analytics |
| `analytics:export` | Export analytics data |
| `agents:execute` | Run AI agent tasks |
| `leads:manage` | Lead ingestion and management |
| `auditlogs:view` | View audit trail |

#### Role → Permission Matrix

| Permission | Admin | Manager | Sales | Presales | Read-Only |
|-----------|:-----:|:-------:|:-----:|:--------:|:---------:|
| `users:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `roles:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `settings:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `metadata:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `costcard:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `resources:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pipeline:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pipeline:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `presales:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `presales:write` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `estimation:manage` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `sales:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sales:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `approvals:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `analytics:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `analytics:export` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `agents:execute` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `leads:manage` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `auditlogs:view` | ✅ | ✅ | ❌ | ❌ | ❌ |

> **Admin** uses wildcard `*` — automatically passes all permission checks.

### 5.5 Frontend Permission Enforcement

The frontend uses a Zustand auth store (`auth-store.ts`) with:
- `hasPermission(permission)` — checks against `user.role.permissions` array
- `hasAnyPermission(permissions[])` — checks if any permission matches
- Sidebar navigation items filtered by required permission
- Settings page sections conditionally shown based on admin permissions

---

## 6. Backend API Reference

### 6.1 Authentication (`/api/auth`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| POST | `/api/auth/login` | ❌ | — | Login with email+password, returns JWT |
| GET | `/api/auth/me` | ✅ | — | Get current user profile |
| PATCH | `/api/auth/change-password` | ✅ | — | Change password |

### 6.2 Opportunities (`/api/opportunities`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/api/opportunities` | `pipeline:view` | List all with dynamic probability, health score |
| POST | `/api/opportunities` | `pipeline:write` | Create new opportunity |
| GET | `/api/opportunities/:id` | `pipeline:view` | Get single with project info |
| PATCH | `/api/opportunities/:id` | `pipeline:write` | Update fields, stage transitions |
| POST | `/api/opportunities/:id/convert` | `sales:write` | Convert to Project (Closed Won) |

**List Response Fields (computed at API time):**
```json
{
  "id": "cuid...",
  "name": "Project Phoenix",
  "client": "Acme Corp",
  "value": 150000,
  "stage": "Discovery",
  "currentStage": "Pipeline",
  "probability": 13,          // Dynamic: stage-based + completeness bonus
  "lastActivity": "3 days ago",
  "owner": "Dip Bagchi",
  "status": "at-risk",        // health > 70 → healthy, > 40 → at-risk, else critical
  "daysInStage": 3,
  "isStalled": false,          // true if > 30 days in stage
  "healthScore": 55            // Composite 4-factor score (0-100)
}
```

### 6.3 Analytics (`/api/analytics`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/api/analytics` | `analytics:view` | Full BI dashboard data |

**Response Structure:**
```json
{
  "dashboard": {
    "revenueProjection": [{ "name": "Jan 2026", "proposed": 150000, "actual": 0 }],
    "countByStatus": [{ "name": "Pipeline", "value": 3 }],
    "countByClient": [{ "name": "Acme Corp", "value": 2 }]
  },
  "pipeline": {
    "activeProjects": 5,
    "conversionRate": 33.3,    // won / (won + lost) × 100
    "pipelineValue": 750000,
    "weightedPipeline": 187500, // Σ(probability × value)
    "avgDealValue": 150000,
    "totalOpps": 8
  },
  "presales": {
    "proposalSuccessRate": 60,
    "totalPresalesOpps": 5
  },
  "sales": {
    "avgTimeToClose": 45,      // days
    "wonCount": 2,
    "lostCount": 1
  }
}
```

### 6.4 Leads (`/api/leads`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| POST | `/api/leads` | `leads:manage` | Ingest and auto-score a lead |

**Lead Scoring Algorithm:**
- CEO/VP/Director title: +25 points
- Manager title: +10 points
- Budget > $50k: +30 points
- Budget > $10k: +15 points
- Enterprise company: +20 points
- Inbound Demo Request: +25 points
- Contact Form: +15 points
- Max score: 99
- Score > 70 → "Hot Lead" (30% initial probability)
- Score > 40 → "Warm Lead"
- Includes deduplication check (same client + title within 60 days)

### 6.5 Agents (`/api/agents`, `/api/agent`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| POST | `/api/agents/task` | `agents:execute` | Execute agent task with governance |
| POST | `/api/agent/run` | `agents:execute` | SSE streaming agent simulation |

**Agent Governance State Machine:**
```
IDLE → REASONING → PROPOSING → EXECUTING → COMPLETED
                                    ↓ (if High Risk & not approved)
                         AWAITING_APPROVAL
```

Risk levels: `Low` (auto-execute), `Medium` (execute), `High` (requires approval).  
High-risk actions: `DELETE_DATA`, `SEND_CONTRACT`.  
Sentiment analysis: Negative sentiment → `PAUSE_AUTOMATION`.

### 6.6 Approvals (`/api/approvals`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| POST | `/api/approvals` | `approvals:manage` | Create approval request |

**Auto-Approval Rule:**  
If `discountPercent ≤ 15%` OR `marginPercent ≥ 20%` → Auto-approved.  
Otherwise → Pending, logged to audit trail.

### 6.7 Admin (`/api/admin`)

| Resource | Endpoints | Permission |
|----------|-----------|-----------|
| Users | GET/POST/PATCH `/admin/users`, POST sync-qpeople, PATCH reset-password | `users:manage` |
| Roles | GET/POST/PATCH/DELETE `/admin/roles` | `roles:manage` |
| Teams | GET `/admin/teams` | `users:manage` |
| Rate Cards | GET/POST/PATCH/DELETE `/admin/rate-cards` | `costcard:manage` |
| Clients | GET/POST/PATCH/DELETE `/admin/clients` | `metadata:manage` |
| Regions | GET/POST/PATCH/DELETE `/admin/regions` | `metadata:manage` |
| Technologies | GET/POST/PATCH/DELETE `/admin/technologies` | `metadata:manage` |
| Pricing Models | GET/POST/PATCH/DELETE `/admin/pricing-models` | `metadata:manage` |
| Budget Assumptions | GET (any auth), PUT `/admin/budget-assumptions` | `settings:manage` |

### 6.8 Notifications (`/api/notifications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | ✅ | List notifications for current user (supports `?unreadOnly=true&limit=50&offset=0`) |
| GET | `/api/notifications/unread-count` | ✅ | Get unread notification count (used by bell badge) |
| PATCH | `/api/notifications/:id/read` | ✅ | Mark a single notification as read |
| PATCH | `/api/notifications/read-all` | ✅ | Mark all notifications as read |

**List Response:**
```json
{
  "notifications": [
    {
      "id": "cuid...",
      "type": "stage_change",
      "title": "Stage Change: Pipeline → Presales",
      "message": "Opportunity \"Project Phoenix\" moved from Pipeline to Presales",
      "link": "/dashboard/opportunities/clx...",
      "isRead": false,
      "createdAt": "2026-04-10T..."
    }
  ],
  "total": 15,
  "unreadCount": 3
}
```

### 6.9 Admin Notification Rules (`/api/admin/notification-rules`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/api/admin/notification-rules` | `settings:manage` | List all notification rules |
| POST | `/api/admin/notification-rules` | `settings:manage` | Create notification rule |
| PATCH | `/api/admin/notification-rules/:id` | `settings:manage` | Update notification rule |
| DELETE | `/api/admin/notification-rules/:id` | `settings:manage` | Delete notification rule |

### 6.10 Admin Email Templates (`/api/admin/email-templates`)

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/api/admin/email-templates` | `settings:manage` | List all email templates |
| POST | `/api/admin/email-templates` | `settings:manage` | Create email template |
| PATCH | `/api/admin/email-templates/:id` | `settings:manage` | Update email template |
| DELETE | `/api/admin/email-templates/:id` | `settings:manage` | Delete email template |

### 6.11 Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resources` | List HRMS resources |
| GET | `/api/rate-cards` | List rate cards |
| GET | `/api/master/regions` | List regions |
| GET | `/api/master/technologies` | List technologies |
| GET | `/api/master/pricing-models` | List pricing models |
| GET | `/api/health` | Health check (public) |

---

## 7. Frontend Pages & Components

### 7.1 Landing Page (`app/page.tsx`)

- Marketing homepage with Framer Motion animations
- Animated gradient background with floating orbs
- Hero section with statistics (40% time saved, 10x insights, 95% accuracy)
- 6 feature showcase cards
- 8 AI capability checklist items
- CTA section linking to `/login`
- Fully responsive (3-column → 1-column on mobile)

### 7.2 Login Page (`app/login/page.tsx`)

- Email + password form with validation
- Password visibility toggle (Eye/EyeOff)
- Error display with AlertCircle icon
- Loading spinner during authentication
- Calls `useAuthStore().login()` → redirects to `/dashboard`

### 7.3 Dashboard Layout (`app/dashboard/layout.tsx`)

- **Collapsible sidebar** with Framer Motion animation
  - Full mode: 260px width with text labels
  - Icon mode: 72px width with icon-only + tooltips
  - Animated width transition
- **Navigation items** filtered by `hasPermission()`:
  - Dashboard (`dashboard:view`)
  - Opportunities (`pipeline:view`)
  - Contacts (`contacts:view`)
  - Analytics (`analytics:view`)
  - Agentic AI (`agents:execute`)
  - GOM Calculator (`gom:view`)
  - Settings (`settings:view`)
- User profile card with initials avatar, role badge, and logout
- Fixed header with search bar, currency selector, and **notification bell with dropdown panel**
- `AuthProvider` wrapper that validates JWT on mount

**NotificationBell Component** (embedded in layout):
- Polls `/api/notifications/unread-count` every 30 seconds
- Bell icon with red badge showing unread count (99+ cap)
- Click opens dropdown panel (max 396px width, 384px height scroll)
- Panel header with "Mark all read" button
- Each notification shows: unread dot, title, message (2-line clamp), time ago, link icon
- Click notification: marks as read + navigates to linked entity
- Individual "mark read" button per notification
- Click outside closes the panel
- Empty state with bell icon and "No notifications yet" message

### 7.4 Dashboard Page (`app/dashboard/page.tsx`)

Dynamic analytics dashboard fetching from `/api/analytics` and `/api/opportunities`:

**Stats Cards (4):**
1. Pipeline Value — formatted currency
2. Active Projects — count of non-closed opportunities
3. Win Rate — `wonCount / (wonCount + lostCount) × 100`
4. Avg Close Time — days

**Charts:**
- **Revenue Projection** — Recharts BarChart (Proposed vs Won bars by month)
- **Pipeline by Stage** — Recharts PieChart (donut) with named color mapping:
  - Pipeline: #6366f1 (indigo)
  - Qualification: #f59e0b (amber)
  - Proposal: #10b981 (green)
  - Negotiation: #8b5cf6 (purple)
  - Closed Won: #ef4444 (red)
  - Closed Lost: #94a3b8 (slate)

**AI-Generated Insights** — Dynamic bullets generated from pipeline data:
- Stalled deal warnings (> 30 days in stage)
- High-value deal highlights (> $100k)
- Critical health score alerts
- At-risk deal notifications
- Pipeline health summary

**Recent Opportunities Table** — Last 8 opportunities with:
- Health indicator dot (green/amber/red)
- Stage badge, value, probability, owner

### 7.5 Opportunities List (`app/dashboard/opportunities/page.tsx`)

**Two view modes:**
1. **List View** — Table with Name, Stage (color badge), Value, Probability, Last Activity, Actions
2. **Kanban Board** — `<KanbanBoard />` component with drag-and-drop

Features: Search, Filter button, "New Opportunity" button, health indicator dots, hover action menu (Edit/Delete).

### 7.6 Opportunity Detail (`app/dashboard/opportunities/[id]/page.tsx`)

**~800+ lines** — Complex multi-tab view with 4-stage stepper:

**Stepper Flow:**
```
Pipeline → Presales → Sales → Project
```

Stepper tabs are restricted by `opportunityStage` — can only access tabs for the current stage and earlier.

**Tab 1 — Pipeline (Project Details):**
- Client, Region, Project Type, Practice selectors
- Sales Rep, Technology, Date Range, Duration
- Pricing Model, Expected Day Rate, Description
- Auto-calculations:
  - End Date = Start Date + Duration months
  - Estimated Value = dailyRate × 20 working days × duration months
- Master data fetched from 6 parallel API calls

**Tab 2 — Presales:**
- Wrapped in `OpportunityEstimationProvider` context
- Sub-tabs: Budget Assumptions, Resource Assignment, Estimation, GOM Calculator
- Resource rows with monthly effort columns
- Travel cost inputs
- GOM calculation with detailed breakdowns
- Save estimation to opportunity's `presalesData` field
- Read-only mode when estimation is submitted

**Tab 3 — Sales:**
- Collapsible Pipeline View (read-only summary of Tab 1 data)
- Collapsible Presales View (read-only summary of estimation)
- Sales-specific data entry
- **Mark as Lost** button — opens modal with required remarks field
  - Sends PATCH with `stageName: 'Closed Lost'` and `salesData.lostRemarks`
  - Shows lost banner with timestamp and remarks
  - Hides action buttons when isLost
- **Convert to Project** button — sends POST to `/api/opportunities/:id/convert`
  - Sets stage to "Closed Won", detailedStatus to "SOW Approved"
  - Handles 409 (already converted) gracefully

**Tab 4 — Project:**
- Shows after conversion
- Displays project details from the linked Project model

**Header Features:**
- Dynamic stage badge (shows current stage with color)
- Action buttons change based on `opportunityStage`
- "Closed Lost" badge displayed when deal is lost

### 7.7 New Opportunity (`app/dashboard/opportunities/new/page.tsx`)

- 4-step stepper (Pipeline, Presales, Sales, Project) — visual only, form is single page
- Master data dropdowns fetched from API
- "Add Client" inline modal (POST `/api/admin/clients`)
- Auto-calculated end date and estimated value
- Form validation (required fields marked with asterisk)
- Submits via `addOpportunity()` Zustand action

### 7.8 Settings Page (`app/dashboard/settings/page.tsx`)

**Collapsible sidebar** with expand/collapse toggle (icon mode at 56px / full at 224px):

**Personal Section:**
- Profile — User details
- Security — Password change

**Administration (Admin only):**
- Users Management — User list, create/edit, password reset, QPeople sync
- Roles Management — Role CRUD with permission matrix grid

**Cost Management (Admin only):**
- Rate Cards — View/edit 393 rate cards (table with search/filter)
- Budget Assumptions — GOM calculation parameters

**Master Data (Admin only):**
- Clients, Regions, Technologies, Pricing Models — CRUD management

**Permission Matrix Grid:**
14 permission categories displayed in a checklist grid when editing roles.

### 7.9 Analytics Page (`app/dashboard/analytics/page.tsx`)

**4 tabs with Recharts visualizations:**

1. **Dashboard** — Revenue projection bar chart, opportunity status pie chart, top clients
2. **Pipeline Metrics** — KPI cards: Active Projects, Pipeline Value, Avg Deal Size, Win Rate
3. **Resource & Pre-Sales** — Proposal Success Rate, Effort per Opportunity
4. **Sales & Conversion** — Avg Time to Close, Won/Lost counts

### 7.10 Agents Page (`app/dashboard/agents/page.tsx`)

**3 pre-configured agents:**
1. **Outreach Agent** — Drafts personalized emails based on prospect analysis
2. **Researcher Agent** — Enriches leads with web/LinkedIn data
3. **Scheduler Agent** — Coordinates meeting scheduling

**Features:**
- Agent card grid with Active/Paused status badges
- Toggle agent status
- Run agent with task input → SSE streaming real-time log display
- Create custom agent CTA

### 7.11 GOM Calculator Page (`app/dashboard/gom/page.tsx`)

Standalone GOM calculator with:
- CTC input, Delivery Management %, Bench Cost %
- Currency selector with INR/USD conversion
- Onsite/Offshore rate calculations
- Markup % or Target Revenue mode
- Auto-computed: Adjusted Cost, Daily Rate, Revenue, GOM

### 7.12 Contacts Page (`app/dashboard/contacts/page.tsx`)

Simple contact cards (3 mock entries) with name, role, company, email, phone, location. Filter and Add buttons (UI placeholder).

---

## 8. Business Logic & Algorithms

### 8.1 Dynamic Probability Calculation

Computed at API time in `listOpportunities()`:

**Base Probability by Stage:**
| Stage | Base Probability |
|-------|-----------------|
| Discovery | 10% |
| Qualification | 25% |
| Proposal | 50% |
| Negotiation | 75% |
| Closed Won | 100% |
| Closed Lost | 0% |

**Completeness Bonus (+0 to +9%):**  
+1.5% for each filled field (max 6 fields):
- `description`, `region`, `presalesData`, `expectedDayRate`, `tentativeDuration`, `expectedCloseDate`

**Cap:** `min(baseProbability + bonus, baseProbability + 15, 100)`

### 8.2 Dynamic Health Score (4-Factor Composite)

Computed at API time in `listOpportunities()`:

| Factor | Weight | Score Logic |
|--------|--------|-------------|
| **Stage Progress** | 30% | Discovery=20, Qualification=40, Proposal=60, Negotiation=80, Closed Won=100, Closed Lost=0 |
| **Recency** | 30% | ≤7 days=100, ≤14 days=75, ≤30 days=50, ≤60 days=20, >60 days=0 |
| **Deal Completeness** | 20% | Percentage of 8 fields filled (description, region, practice, technology, duration, startDate, presalesData, rate) |
| **Value Confidence** | 20% | Percentage of 4 fields filled (pricingModel, duration, rate, endDate) |

**Formula:**  
`healthScore = stageScore×0.3 + recencyScore×0.3 + completenessScore×0.2 + valueScore×0.2`

**Special Cases:**
- Closed Won → always 100%
- Closed Lost → always 0%

**Status Derivation:**
- healthScore > 70 → `healthy` (green)
- healthScore > 40 → `at-risk` (amber)
- healthScore ≤ 40 → `critical` (red)

### 8.3 Stalled Deal Detection

`isStalled = daysInStage > 30 AND stage NOT IN ['Closed Won', 'Closed Lost']`

### 8.4 GOM (Gross Operating Margin) Calculation

**Input Parameters (Budget Assumptions):**
| Parameter | Default | Description |
|-----------|---------|-------------|
| marginPercent | 35% | Target margin |
| deliveryMgmtPercent | — | Delivery management overhead |
| benchPercent | 10% | Bench cost |
| leaveEligibilityPercent | — | Leave loading |
| annualGrowthBufferPercent | — | Growth buffer |
| averageIncrementPercent | — | Annual increment |
| workingDaysPerYear | 240 | Working days |
| bonusPercent | — | Bonus loading |
| indirectCostPercent | — | Indirect cost |
| welfarePerFte | — | Annual welfare per FTE |
| trainingPerFte | — | Annual training per FTE |

**Resource Line Calculation (per month):**
```
Revenue  = days × dailyRate
Salary   = days × dailyCost
Bonus    = salary × (bonusPercent / 100)
Indirect = salary × (indirectCostPercent / 100)
Welfare  = (welfarePerFte / 12) × FTE
Training = (trainingPerFte / 12) × FTE
Total Cost = salary + bonus + indirect + welfare + training
```

**GOM:**
```
GOM ($) = Total Revenue - Total Cost
GOM (%) = (GOM / Total Revenue) × 100
```

### 8.5 Rate Card Calculation

```
Offshore Cost = Annual CTC × (1 + benchPercent / 100)
Daily Cost    = Offshore Cost / workingDaysPerYear
Daily Rate    = Daily Cost / (1 - marginPercent / 100)
```

### 8.6 Analytics Aggregation

**Stage Grouping (for Pie Chart):**
| Raw Stage | Display Group |
|-----------|--------------|
| Discovery, Pipeline | Pipeline |
| Qualification, Presales | Qualification |
| Proposal, Sales | Proposal |
| Negotiation | Negotiation |
| Closed Won | Closed Won |
| Closed Lost | Closed Lost |

**Key Metrics:**
- **Win Rate:** `wonCount / (wonCount + lostCount) × 100`
- **Pipeline Value:** Sum of revenue for active (non-closed) opportunities
- **Weighted Pipeline:** `Σ(stageProbability × opportunityValue / 100)`
- **Avg Deal Value:** `pipelineValue / activeOpportunityCount`
- **Conversion Rate:** Same as Win Rate
- **Proposal Success Rate:** `movedToSales / totalPresalesOpps × 100`

### 8.7 Lead Qualification Scoring

See Section 6.4 — point-based scoring system with explicit (profile) and implicit (behavioral) factors, max 99.

### 8.8 Sentiment Analysis

Keyword-based sentiment detection:
- Negative words (angry, disappointed, cancel, refund, etc.): -0.2 each
- Positive words (great, love, happy, excellent, etc.): +0.2 each
- Score clamped to [-1, 1]
- Score < -0.3 → PAUSE_AUTOMATION
- Score > 0.3 → ACCELERATE_SEQUENCE

---

## 9. Features Implemented (Epic-by-Epic)

### Epic 1: Foundation & Infrastructure ✅
- Next.js + Express + Prisma + PostgreSQL stack
- Full database schema (25+ models)
- Premium UI design system with glassmorphism
- Tailwind CSS with custom theme
- Framer Motion animations
- Landing page with marketing content

### Epic 2: Intelligent Lead Intake & Scoring ✅
- POST `/api/leads` endpoint with auto-scoring
- Multi-factor lead qualification (title, budget, company size, source)
- Deduplication check (same client + title within 60 days)
- Auto-creation of clients and contacts
- LeadScore model with factors, confidence, recommended action

### Epic 3: Pipeline Intelligence ✅
- Dynamic health score computation (4-factor composite)
- Stalled deal detection (> 30 days)
- Dynamic probability based on stage progression
- Completeness bonus for filled fields
- Visual health indicators (green/amber/red)
- Kanban board view

### Epic 4: Communication Intelligence ✅
- Keyword-based sentiment analysis engine
- Positive/Negative/Neutral classification
- Auto-pause on negative sentiment
- Auto-accelerate on positive sentiment

### Epic 5: Deal Governance ✅
- Approval request workflow
- Auto-approval rule (discount ≤ 15% or margin ≥ 20%)
- Pending approval for risky deals
- Audit trail logging for all approval actions

### Epic 6: Deal-to-Project Conversion ✅
- POST `/api/opportunities/:id/convert` endpoint
- Project auto-creation with mapped fields (name, budget, currency)
- Auto-generated project code (PROJ-YYYY-NNN)
- Milestone auto-creation (Kickoff, Requirements Gathering)
- Stage update to "Closed Won", detailedStatus to "SOW Approved"
- Idempotency check (409 if project already exists)

### Epic 7: Project Health Monitoring ✅ (Schema Ready)
- Project model with healthScore, riskLevel, scheduleVariance
- ProjectRisk model for risk register
- Milestone tracking with status and dates

### Epic 8: Forecasting & Insights ✅
- Revenue projection chart (proposed vs actual)
- Weighted pipeline calculation
- Pipeline metrics dashboard
- AI-generated insight bullets on dashboard
- 4-tab analytics page

### Epic 9: Agent Framework ✅
- Agent state machine (IDLE → REASONING → PROPOSING → EXECUTING → COMPLETED)
- 3 pre-configured agents (Outreach, Researcher, Scheduler)
- SSE streaming for real-time agent execution logs
- Custom agent creation UI

### Epic 10: Agent Governance ✅
- Risk level classification (Low/Medium/High)
- High-risk action blocking (requires approval)
- AWAITING_APPROVAL state for dangerous actions
- Sentiment-based automation pausing

### Additional Features ✅

**JWT-Based RBAC System:**
- 5 roles (Admin, Manager, Sales, Presales, Read-Only)
- 16+ granular permissions
- Middleware-level enforcement on all API routes
- Frontend permission filtering (sidebar, settings sections)

**Dynamic Dashboard:**
- Real-time stats from analytics API
- Revenue chart, pipeline pie chart
- AI insight generation from pipeline data
- Recent opportunities table with health indicators

**Opportunity Lifecycle Management:**
- 4-tab stepper (Pipeline → Presales → Sales → Project)
- Stage-restricted tab navigation
- Auto-calculations (end date, estimated value)
- Master data dropdowns (clients, regions, technologies, pricing models)
- Mark as Lost modal with required remarks
- Lost deal banner display
- Convert to Project with confirmation

**Sidebar System:**
- Main sidebar: collapsible to 72px icon mode
- Settings sidebar: collapsible to 56px icon mode
- Animated transitions with Framer Motion
- Tooltips on icon-only mode

**Presales Estimation System:**
- OpportunityEstimationContext (shared state)
- Budget assumptions configuration
- Resource assignment with monthly effort columns
- Travel cost calculator
- Full GOM calculation with month-by-month breakdowns
- Read-only mode when submitted

**Cost Card Management:**
- 393 rate cards imported from Excel
- Categories: ADM, SAP Functional, SAP Technical, Management
- Role/skill/experience-band organized
- Multiple CTC benchmarks (Master, Mercer, Copilot, Existing, Max)

**Master Data Administration:**
- Clients, Regions, Technologies, Pricing Models CRUD
- Budget Assumptions management
- User management with password reset
- Role management with permission matrix editor

---

## 10. Seed Data & Initial Setup

### Seeded Stages
| Stage | Order | Color |
|-------|-------|-------|
| Discovery | 1 | #6366f1 (Indigo) |
| Qualification | 2 | #8b5cf6 (Purple) |
| Proposal | 3 | #ec4899 (Pink) |
| Negotiation | 4 | #f97316 (Orange) |
| Closed Won | 5 | #10b981 (Green) |
| Closed Lost | 6 | #ef4444 (Red) |

### Seeded Users

| Email | Name | Role | Password |
|-------|------|------|----------|
| dip.bagchi@example.com | Dip Bagchi | Admin | password123 |
| manager@example.com | Raj Kumar | Manager | password123 |
| sales@example.com | Priya Sharma | Sales | password123 |
| presales@example.com | Amit Patel | Presales | password123 |
| viewer@example.com | Suman Roy | Read-Only | password123 |

### Seeded Master Data
- **Regions:** North America, Europe, Asia Pacific, Middle East, India, Latin America, Africa
- **Technologies:** .NET, Java, Python, React, Angular, Node.js, SAP, Salesforce, AWS, Azure, GCP, AI/ML, Data Engineering, DevOps, Cybersecurity, Power Platform, ServiceNow, Blockchain, IoT, Mobile
- **Pricing Models:** Fixed Price, Time & Material, Hybrid, Managed Services, Outcome-Based, Staff Augmentation
- **Opportunity Types:** New Business
- **Team:** Sales Team (default)
- **Client:** Acme Corp (technology, $50M revenue)
- **Resources:** 3 mock resources (Developer L3, Tester L2, Manager L5)
- **Rate Cards:** 393 entries from Excel JSON file
- **Sample Opportunity:** "Project Phoenix" ($150K, Discovery stage, High priority)

---

## 11. UI/UX Design System

### Color Palette
- **Primary:** Sky blue gradient
- **Secondary:** Purple gradient
- **Accent:** Warm orange
- **Success/Warning/Danger:** Green/Yellow/Red

### Glassmorphism Components
- `.glass` — Translucent backgrounds
- `.glass-card` — Elevated cards with blur
- Hover states with glow effects

### Premium Effects
- Smooth gradients and text gradients
- Shadow glows
- Micro-animations (fade-in, slide-in, scale-in)
- Shimmer loading states

### Dashboard Color Map
| Stage | Color |
|-------|-------|
| Pipeline | #6366f1 (Indigo) |
| Qualification | #f59e0b (Amber) |
| Proposal | #10b981 (Green) |
| Negotiation | #8b5cf6 (Purple) |
| Closed Won | #ef4444 (Red) |
| Closed Lost | #94a3b8 (Slate) |

### Sidebar Design
- Full width: 260px (main) / 224px (settings)
- Collapsed width: 72px (main) / 56px (settings)
- Transition: Framer Motion `animate` on width
- Icon-only mode shows centered icons with tooltips

---

## 12. Work Log — All Changes Delivered

### Session 1: Foundation Build
- ✅ Full JWT-based RBAC system with 5 roles
- ✅ QPeople API research and integration planning
- ✅ Dynamic rate cards (393 entries from Excel import)
- ✅ Complete database schema (25+ models)
- ✅ Express.js backend with Prisma ORM
- ✅ Next.js frontend with Tailwind CSS

### Session 2: 10-Issue Fix & Enhancement Pass
- ✅ Fixed 10 reported bugs across frontend and backend
- ✅ Rate card display and calculation fixes
- ✅ Collapsible settings panels
- ✅ Auto-calculation for estimated values
- ✅ Sales stage overhaul
- ✅ Resource assignment improvements with read-only mode

### Session 3: Stepper & Permissions
- ✅ Fixed collapsible settings sidebar
- ✅ Restricted stepper tabs by `opportunityStage`
- ✅ Changed Project status to "SOW Approved"
- ✅ Added all screens to user permissions
- ✅ Updated backend seed.ts with complete permission sets

### Session 4: Stepper Highlight & Pipeline Badge
- ✅ Fixed `isCompleted` to use `opportunityStage` instead of `activeStep`
- ✅ Made Pipeline status badge dynamic (shows actual stage)
- ✅ Fixed chevron separators in stepper

### Session 5: Dynamic Dashboard
- ✅ Rewrote entire dashboard page from hardcoded to dynamic
- ✅ Stats cards fetching from analytics API
- ✅ Revenue chart (Proposed vs Won bars)
- ✅ Pipeline pie chart with stage colors
- ✅ Recent opportunities table with health indicators
- ✅ AI-generated insights from pipeline data

### Session 6: Header Buttons & Stage Display
- ✅ Changed header buttons from `activeStep` to `opportunityStage`
- ✅ Added `currentStage` to API response
- ✅ Added `STAGE_DISPLAY` mapping for user-friendly stage names

### Session 7: Convert Status & Sidebar Fix
- ✅ Fixed `convertOpportunity` to update `currentStage` to "Closed Won"
- ✅ Removed problematic sticky CSS from settings sidebar

### Session 8: Icon Mode Sidebar
- ✅ Changed main dashboard sidebar from vanishing (width: 0) to icon-mode (width: 72px)
- ✅ Conditional text labels with `{isSidebarOpen && <span>}`
- ✅ Tooltips when collapsed
- ✅ Centered icons in icon mode

### Session 9: Settings Sidebar Icon Mode + Convert Fix
- ✅ Added icon-mode toggle to settings page sidebar
- ✅ Fixed project conversion: `currentStage` was "Closed-Won" (hyphen) vs DB "Closed Won" (space)
- ✅ Fixed `getOpportunity` to include project relation
- ✅ Fixed 409 error not handled gracefully in frontend

### Session 10: Mark as Lost Feature
- ✅ Added "Mark as Lost" button in Sales stage header
- ✅ Modal with required remarks field
- ✅ Handler updates backend with `stageName: 'Closed Lost'`
- ✅ Lost banner displayed in Sales view with timestamp and remarks
- ✅ Backend sets `detailedStatus: 'Lost'` on Closed Lost transition
- ✅ Header hides action buttons when deal is lost

### Session 11: Dashboard Dynamic Fields + Probability + Health Score
- ✅ Fixed all dashboard stats to dynamically update from real data
- ✅ Root cause: stage matching used wrong fields (`detailedStatus`, `currentStage` instead of `stage.name`)
- ✅ Fixed Win Rate (was 0% — now correctly uses `stage.name === 'Closed Won'`)
- ✅ Fixed Lost Count (was checking `currentStage === 'Cancelled'` instead of `stage.name === 'Closed Lost'`)
- ✅ Fixed Conversion Rate formula from `won/total` to `won/(won+lost)`
- ✅ Fixed Revenue chart to use stage.name for won revenue
- ✅ Fixed Pie chart grouping via `STAGE_GROUP` mapping
- ✅ Implemented dynamic probability (stage-based 10-100% + completeness bonus)
- ✅ Implemented dynamic health score (4-factor composite: stage progress, recency, completeness, value confidence)
- ✅ Added weighted pipeline calculation
- ✅ Added `Closed Won` and `Closed Lost` to dashboard color maps
- ✅ Added `PIE_COLOR_MAP` for consistent named stage colors in pie chart

### Session 12: Production Deployment to Azure VM
- ✅ Deployed full stack to Azure VM (Standard_B2ms, 2 vCPU, 8GB RAM)
- ✅ Nginx reverse proxy with SSL (Let's Encrypt) on qcrm.qbadvisory.com
- ✅ PM2 process manager with `qcrm-backend` and `qcrm-frontend` services
- ✅ Backend compiled via `tsc` → runs as `node dist/index.js`
- ✅ Frontend built via `npm run build` → Next.js production SSR
- ✅ PostgreSQL on localhost:5432 with 308 users synced from QPeople HRMS
- ✅ Azure AD SSO integration (Tenant: 2ec62294-dda7-4517-b84d-4845795e0d29)

### Session 13: Mute Notification Feature
- ✅ Added `muteNotification Boolean @default(true)` to User model in Prisma schema
- ✅ Backend admin controller: listUsers returns muteNotification, createUser sets to true, updateUser accepts toggle
- ✅ Frontend Settings → Users tab: "Mute Notification" checkbox column between Status and Actions
- ✅ Email guard in `sendNotificationEmail()`: checks `recipient.muteNotification`, skips if true with log message
- ✅ Toast notifications on toggle: "Notifications muted for {name}" / "Notifications enabled for {name}"
- ✅ Deployed to production: raw SQL migration (ALTER TABLE), tsc recompile, PM2 restart
- ✅ Discovered and fixed stale compiled JS issue (SCP'd .ts files but forgot `npx tsc`)

### Session 14: Email System — Microsoft Graph API OAuth2
- ✅ Updated `email.ts` to support Microsoft Graph API with OAuth2 client credentials flow
- ✅ Dual-mode: Uses Graph API when Azure credentials configured, falls back to SMTP/nodemailer
- ✅ Token caching with automatic refresh (60-second buffer before expiry)
- ✅ Configured `.env` on server: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SMTP_FROM`
- ✅ Added `Mail.Send` application permission to Azure AD app registration
- ⏳ Pending: Admin consent for Mail.Send (requires Global Admin) OR dedicated SMTP mailbox setup
- ℹ️ Alternative planned: Admin to create `qcrm.noreply@qbadvisory.com` with SMTP AUTH enabled

### Session 15: In-App Notification System (Full Build)
- ✅ Built **Notification Engine** (`backend/src/lib/notification-engine.ts`):
  - `evaluateStageChangeRules()` — Evaluates all active `stage_change` rules when opportunity moves stages
  - `evaluateDataConditionRules()` — Evaluates `data_condition` rules on every opportunity update
  - Matches rules by fromStage/toStage, checks conditions with operators (eq, neq, gt, gte, lt, lte, contains)
  - Resolves recipients by role, creates in-app Notification records, triggers emails via template
  - Renders `{{variable}}` placeholders in message templates
  - Fire-and-forget (never blocks the main request)
- ✅ Built **Notification API** (`backend/src/controllers/notifications.controller.ts`):
  - `GET /api/notifications` — List user's notifications with pagination and unread filter
  - `GET /api/notifications/unread-count` — Badge count for the bell icon
  - `PATCH /api/notifications/:id/read` — Mark single as read
  - `PATCH /api/notifications/read-all` — Mark all as read
- ✅ Created **notification routes** (`backend/src/routes/notifications.routes.ts`) and registered in `index.ts`
- ✅ **Integrated engine into opportunities controller**:
  - Stage change triggers `evaluateStageChangeRules()` with full context (title, stages, client, owner, rep, manager, value)
  - Every update triggers `evaluateDataConditionRules()` for condition-based rules
- ✅ Built **NotificationBell component** in dashboard layout:
  - Polls unread count every 30s
  - Red badge with count (caps at 99+)
  - Dropdown panel with notification list (unread highlighted in indigo)
  - Click to navigate + auto-mark read
  - "Mark all read" header action
  - Click outside to close
  - Time-ago display (Just now, Xm, Xh, Xd)
  - Empty state with icon

---

## 13. Known Limitations & Future Enhancements

### Current Limitations
1. **Probability not persisted** — Computed at API time, not stored in DB; could be synced on stage transitions
2. **No real-time updates** — Dashboard doesn't auto-refresh; notification bell polls every 30s but not WebSocket-based
3. **Contacts page is static** — Mock data, no API integration
4. **Agent AI is simulated** — SSE streaming with mock data, no real LLM integration
5. **No file upload** — Attachment schema exists but no upload endpoint
6. **Single-tenant** — No multi-tenancy support
7. **No password recovery** — No forgot-password/email flow
8. **Email sending pending** — Graph API requires Global Admin consent; SMTP mailbox being set up by admin (`qcrm.noreply@qbadvisory.com`)
9. **All users muted by default** — `muteNotification` defaults to `true`; admins must uncheck per-user to enable email notifications.

### Planned Enhancements
1. Real LLM integration (OpenAI/Azure OpenAI) for AI agents
2. RAG system using VectorEmbedding model (pgvector)
3. Dedicated SMTP mailbox (`qcrm.noreply@qbadvisory.com`) for reliable email delivery
4. Activity timeline on opportunity detail
5. Drag-and-drop Kanban with stage transitions
6. Dashboard auto-refresh with configurable interval
7. Export analytics to CSV/PDF
8. WebSocket-based real-time notification delivery (replace polling)
9. QPeople HRMS integration for resource data
10. Stalled deal and health drop notification rules (engine supports it, needs periodic scheduler)

---

## 14. Production Deployment

### Infrastructure

| Component | Details |
|-----------|---------|
| **VM** | Azure Standard_B2ms (2 vCPU, 8GB RAM), Ubuntu 22.04 |
| **IP** | 20.124.178.41 |
| **Domain** | qcrm.qbadvisory.com |
| **SSL** | Let's Encrypt via Certbot (auto-renewal) |
| **Reverse Proxy** | Nginx (port 443 → localhost:3000 for frontend, `/api` → localhost:3001 for backend) |
| **Process Manager** | PM2 (`qcrm-backend`, `qcrm-frontend`) |
| **Database** | PostgreSQL 14 at localhost:5432, database `agentic_crm` |
| **Users** | 308 users synced from QPeople HRMS |

### Deployment Process

```bash
# 1. Upload changed source files
Get-Content file.ts -Raw | ssh azureuser@20.124.178.41 "cat > /path/on/server/file.ts"

# 2. Backend: Compile TypeScript and restart
ssh azureuser@20.124.178.41 "cd /home/azureuser/app/backend && npx tsc"
ssh azureuser@20.124.178.41 "pm2 restart qcrm-backend"

# 3. Frontend: Rebuild Next.js and restart
ssh azureuser@20.124.178.41 "cd /home/azureuser/app/agentic-crm && npm run build"
ssh azureuser@20.124.178.41 "pm2 restart qcrm-frontend"

# 4. DB schema changes: Use raw SQL (prisma db push OOM-kills on 2vCPU)
ssh azureuser@20.124.178.41 "psql postgresql://postgres:postgres@localhost:5432/agentic_crm -c 'ALTER TABLE ...'"
ssh azureuser@20.124.178.41 "cd /home/azureuser/app/backend && npx prisma generate"
```

### Key Configuration Files

- **Backend .env**: `/home/azureuser/app/backend/.env`
  - `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
  - `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` (SSO)
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (Graph API email)
  - `SMTP_FROM`, `SMTP_FROM_NAME` (email sender identity)
- **Frontend .env.local**: `/home/azureuser/app/agentic-crm/.env.local`
  - `NEXT_PUBLIC_API_URL=https://qcrm.qbadvisory.com`
- **Nginx**: `/etc/nginx/sites-available/qcrm`
- **PM2 ecosystem**: `pm2 save` persists process list to `/home/azureuser/.pm2/dump.pm2`

### Important Deployment Notes

1. **Backend runs compiled JS** — Always run `npx tsc` after uploading `.ts` source files. PM2 runs `node dist/index.js`, NOT the TypeScript sources.
2. **`npm run build` can OOM** — The 2vCPU/8GB VM sometimes kills the build process. Do NOT pipe build output through `tail` or other commands. Run the build command directly.
3. **DB migrations via raw SQL** — `prisma db push` also OOM-kills. Use `ALTER TABLE` for column additions, `prisma generate` afterward.
4. **Column naming in PostgreSQL** — Prisma uses camelCase. Quote column names in SQL: `"muteNotification"`, NOT `mutenotification`.

---

## 15. How to Run

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd Jaydeep_work/backend

# Install dependencies
npm install

# Configure environment
# Create .env file with:
# DATABASE_URL="postgresql://user:password@localhost:5432/agentic_crm"
# JWT_SECRET="your-secret-key"
# FRONTEND_URL="http://localhost:3000"

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed database
npx tsx prisma/seed.ts

# Start server
npx tsx src/index.ts
# Server runs on http://localhost:3001
```

### Frontend Setup

```bash
cd Jaydeep_work/agentic-crm

# Install dependencies
npm install

# Configure environment
# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:3001

# Start development server
npm run dev
# App runs on http://localhost:3000
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | dip.bagchi@example.com | password123 |
| Manager | manager@example.com | password123 |
| Sales | sales@example.com | password123 |
| Presales | presales@example.com | password123 |
| Read-Only | viewer@example.com | password123 |

### Useful Commands

```bash
# Database studio (visual DB browser)
npx prisma studio

# Check database connectivity
npx tsx src/check-db.ts

# Re-seed database
npx tsx prisma/seed.ts

# Health check
curl http://localhost:3001/api/health
```

---

*End of Documentation*
