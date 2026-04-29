# Q-CRM Role Use Cases

> **Application:** [https://qcrm.qbadvisory.com](https://qcrm.qbadvisory.com)  
> **Last Updated:** April 24, 2026  
> **System:** Q-CRM (Opportunity Management & SOW Studio)

---

## Table of Contents

1. [Opportunity Lifecycle Workflow](#1-opportunity-lifecycle-workflow)
2. [Role Overview](#2-role-overview)
3. [Admin](#3-admin)
4. [Manager](#4-manager)
5. [Sales](#5-sales)
6. [Presales](#6-presales)
7. [Management](#7-management)
8. [Read-Only](#8-read-only)
9. [Permission Reference Matrix](#9-permission-reference-matrix)

---

## 1. Opportunity Lifecycle Workflow

### 1.1 Pipeline Stage Flow

```
 ┌──────────┐     ┌───────────────┐     ┌──────────┐     ┌─────────────┐     ┌────────────┐
 │          │     │               │     │          │     │             │     │            │
 │ DISCOVERY├────►│ QUALIFICATION ├────►│ PROPOSAL ├────►│ NEGOTIATION ├────►│ CLOSED WON │
 │  (10%)   │     │    (25%)      │     │  (50%)   │     │   (75%)     │     │  (100%)    │
 │          │     │               │     │          │     │             │     │            │
 └────┬─────┘     └───┬───▲──────┘     └────┬──▲──┘     └───┬──▲─────┘     └────────────┘
      │               │   │                  │  │            │  │
      │               │   │  Re-estimate     │  │            │  │
      │               │   └──────────────────┘  │            │  │
      │               │   │  Re-estimate        │            │  │
      │               │   └─────────────────────┘────────────┘  │
      │               │                              Discount   │
      │               │ GOM Approval Gate           Rejection   │
      │               │ (must pass before           loops back  │
      │               │  moving to Proposal)                    │
      │               │                                         │
      ▼               ▼                                         │
 ┌───────────────────────────┐                                  │
 │       CLOSED LOST (0%)    │  ◄── Can happen from any stage ──┘
 └───────────────────────────┘
```

### 1.2 Back-and-Forth Workflows

Q-CRM is not a simple linear pipeline. Multiple feedback loops drive opportunities backward through stages. Below are all bidirectional workflows:

#### 1.2.1 Re-Estimate Loop (Sales → Presales)

```
                   "Send for Re-estimate"
 ┌──────────┐     ──────────────────────►     ┌───────────────┐
 │ PROPOSAL │                                 │ QUALIFICATION │
 │  (50%)   │     ◄──────────────────────     │    (25%)      │
 └──────────┘      "Estimation Submitted"     └───────┬───────┘
                                                      │
                   "Send for Re-estimate"             │ Must re-pass
 ┌─────────────┐  ──────────────────────►             │ GOM Approval
 │ NEGOTIATION │                                      │ Gate again
 │   (75%)     │  ◄── (cannot go directly back) ──────┘
 └─────────────┘

 What happens on each re-estimate:
 ┌─────────────────────────────────────────────────────────────────┐
 │  1. Stage reverts to QUALIFICATION                             │
 │  2. gomApproved resets to FALSE (must re-approve)              │
 │  3. reEstimateCount incremented (+1)                           │
 │  4. detailedStatus = "Sent for Re-estimate"                    │
 │  5. Optional reEstimateComment saved as Note                   │
 │  6. SEND_BACK_REESTIMATE audit entry created                   │
 │  7. "sent_back_to_reestimate" email → Presales + Manager       │
 │                                                                │
 │  Return path:                                                  │
 │  8. Presales re-works estimation                               │
 │  9. GOM recalculated → must pass approval gate again           │
 │  10. On submit → detailedStatus = "Re-estimation Submitted"    │
 │  11. "presales_submitted_back" email → Sales owner              │
 │  12. Opportunity moves back to PROPOSAL                        │
 └─────────────────────────────────────────────────────────────────┘
```

#### 1.2.2 GOM Approval Cycle (Presales ↔ Manager)

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                     QUALIFICATION STAGE                            │
 │                                                                     │
 │   Presales                    Manager                               │
 │   ┌────────┐                 ┌──────────┐                          │
 │   │Estimate│──── GOM% ──────►│ Review   │                          │
 │   │  GOM   │   calculated    │ Approval │                          │
 │   └───▲────┘                 └────┬─────┘                          │
 │       │                           │                                │
 │       │    ┌──────────┐           │                                │
 │       │    │ REJECTED │◄──────────┤ Manager rejects                │
 │       │    │ (loop)   │           │ with feedback                   │
 │       │    └────┬─────┘           │                                │
 │       │         │                 │                                │
 │       └─────────┘                 │                                │
 │    Presales revises               │                                │
 │    estimate & resubmits           ▼                                │
 │                           ┌──────────────┐                         │
 │                           │   APPROVED   │                         │
 │                           │gomApproved=T │──────► Can move to      │
 │                           └──────────────┘        PROPOSAL         │
 │                                                                     │
 │   Auto-approve path:                                                │
 │   GOM% ≥ threshold → gomApproved = true (skips manager review)    │
 └─────────────────────────────────────────────────────────────────────┘
```

#### 1.2.3 Discount Approval Cycle (Sales ↔ Finance)

```
 ┌──────────────────────────────────────────────────────────────────┐
 │              ANY STAGE (typically Negotiation)                   │
 │                                                                  │
 │   Sales sets discount                                           │
 │        │                                                        │
 │        ▼                                                        │
 │   ┌─────────────────────┐     YES     ┌──────────────────┐     │
 │   │ discount > 15% AND  ├────────────►│ Finance Manager  │     │
 │   │ margin < 20% ?      │             │ reviews          │     │
 │   └────────┬────────────┘             └───────┬──────────┘     │
 │            │ NO                               │                 │
 │            ▼                           ┌──────┴──────┐          │
 │   ┌──────────────┐                    │             │          │
 │   │ Auto-approved│              ┌─────▼────┐ ┌─────▼────┐     │
 │   │ (proceed)    │              │ APPROVED │ │ REJECTED │     │
 │   └──────────────┘              │ (proceed)│ │ (revise  │     │
 │                                 └──────────┘ │  terms)  │     │
 │                                              └────┬─────┘     │
 │                                                   │            │
 │                                    Sales adjusts pricing       │
 │                                    and resubmits               │
 └──────────────────────────────────────────────────────────────────┘
```

#### 1.2.4 SOW Approval Chain (Multi-Step Review)

```
 ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 │  Sales   │───►│ Presales │───►│ Manager  │───►│ Finance  │───►│  Legal   │
 │  Review  │    │  Review  │    │ Approval │    │  Review  │    │  Review  │
 └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘
       │               │               │               │               │
   ┌───┴───┐       ┌───┴───┐       ┌───┴───┐       ┌───┴───┐       ┌───┴───┐
   │Approve│       │Approve│       │Approve│       │Approve│       │Approve│
   │   or  │       │   or  │       │   or  │       │   or  │       │   or  │
   │Reject │       │Reject │       │Reject │       │Reject │       │Reject │
   └───┬───┘       └───┬───┘       └───┬───┘       └───┬───┘       └───┬───┘
       │               │               │               │               │
       ▼               ▼               ▼               ▼               ▼
  On REJECT at any step → SOW goes back to DRAFTING status
  Author fixes → resubmits → chain restarts from step 1

  Each step:
  • Has configurable reviewerRoles
  • Has escalationHours (auto-escalate if no response)
  • isRequired flag (optional steps can be skipped)
  • Rejection requires comment/feedback
```

#### 1.2.5 SOW Document Revision Loop (Team ↔ Client)

```
                                    ┌──────────────────────┐
                                    │   DRAFTING           │◄──────────────┐
                                    │   (Author edits)     │               │
                                    └──────────┬───────────┘               │
                                               │                          │
                                               ▼                          │
                                    ┌──────────────────────┐               │
                                    │   AI GENERATED       │               │
                                    │   (AI fills content) │               │
                                    └──────────┬───────────┘               │
                                               │                          │
                                               ▼                          │
                              ┌───►┌──────────────────────┐               │
                              │    │   IN REVIEW           │               │
                              │    │   (Internal team)     │               │
                              │    └──────────┬───────────┘               │
                              │               │                           │
                              │        ┌──────┴──────┐                    │
                              │        ▼             ▼                    │
                              │  ┌───────────┐ ┌──────────────┐          │
                              │  │ REQUIRES  │ │ APPROVED     │          │
                              │  │ INPUTS    │ │ INTERNALLY   │          │
                              │  │ (missing  │ └──────┬───────┘          │
                              │  │  data)    │        │                   │
                              │  └─────┬─────┘        ▼                   │
                              │        │       ┌──────────────┐          │
                              └────────┘       │ SHARED WITH  │          │
                         (fix inputs,          │ CLIENT       │          │
                          resubmit)            └──────┬───────┘          │
                                                      │                   │
                                               ┌──────┴──────┐           │
                                               ▼             ▼           │
                                        ┌───────────┐ ┌────────────┐     │
                                        │ FINALIZED │ │ REVISION   │     │
                                        └─────┬─────┘ │ REQUESTED  │─────┘
                                              │       │ (Client    │
                                              ▼       │  feedback) │
                                        ┌───────────┐ └────────────┘
                                        │ SIGNED /  │
                                        │ ARCHIVED  │  ← End State
                                        └───────────┘
```

### 1.3 Complete Handoff Summary

| # | Back-and-Forth | From → To | Trigger | What Resets | Return Path |
|---|----------------|-----------|---------|-------------|-------------|
| 1 | **Re-estimate** | Proposal/Negotiation → Qualification | Sales clicks "Send for Re-estimate" | gomApproved=false, detailedStatus, reEstimateCount+1 | Presales re-works → resubmits → Proposal |
| 2 | **GOM rejection** | Manager → Presales (within Qualification) | Manager rejects GOM approval | ApprovalRequest status=Rejected | Presales revises → resubmits GOM |
| 3 | **Discount rejection** | Finance → Sales (within Negotiation) | Finance rejects discount request | ApprovalRequest status=Rejected | Sales adjusts pricing → resubmits |
| 4 | **SOW review rejection** | Any reviewer → Author (within SOW) | Reviewer rejects SOW step | SOW status reverts to Drafting | Author fixes → resubmits → chain restarts |
| 5 | **SOW client revision** | Client → Author (within SOW) | Client requests changes | SOW status = Revision Requested | Author revises → re-shares with client |
| 6 | **Requires Inputs** | Readiness engine → Author (within SOW) | Missing data detected during review | SOW status = Requires Inputs | Author fills gaps → resubmits for review |

| Stage | Sales | Presales | Manager | Admin | Management | Read-Only |
|-------|-------|----------|---------|-------|------------|-----------|
| **Lead Intake** | Creates | — | — | Notified | — | — |
| **Discovery** | Fills pipeline data | — | Notified | Notified | — | Views |
| **Qualification** | Reviews | **Estimates & GOM** | **Approves GOM** | — | — | Views |
| **Proposal** | **Drives proposal** | Views | Notified | — | — | Views |
| **Negotiation** | **Negotiates** | Views | Oversight | Notified | Views | Views |
| **Closed Won** | **Converts to project** | Notified | Notified | Notified | Views analytics | Views |
| **Closed Lost** | Records loss reason | — | Notified | Notified | Views analytics | Views |

### 1.5 Approval Workflows

| Approval Type | Trigger | Auto-Approve Condition | Reviewer | Stage Gate? |
|---------------|---------|----------------------|----------|-------------|
| **GOM Approval** | GOM% calculated in Qualification | GOM% ≥ auto-approve threshold | Reporting Manager | Yes — blocks Proposal |
| **Discount Approval** | Discount >15% AND margin <20% | Otherwise auto-approved | Finance Manager | No |
| **SOW Approval** | SOW submitted for review | N/A — always manual | Configurable chain (Sales → Presales → Manager → Finance → Legal) | No |

---

## 2. Role Overview

Q-CRM uses a role-based access control (RBAC) system with six system-defined roles. Each role carries a permission set that controls access to features across both the frontend UI and backend API. Users can hold multiple roles and switch between them; the **active role** determines current permissions.

| Role | Type | Target User | Summary |
|------|------|-------------|---------|
| **Admin** | System | IT / System Admin | Full system access with wildcard (`*`) permission |
| **Manager** | System | Practice Head / Delivery Manager | Full opportunity lifecycle + approvals + analytics export + audit |
| **Sales** | System | Sales Executive / Account Manager | Pipeline management + sales conversion + lead generation |
| **Presales** | System | Presales Consultant / Solution Architect | Estimation + presales activities + solution design |
| **Management** | System | CXO / Senior Leadership | Read-only oversight + approvals + analytics export + audit |
| **Read-Only** | System | Stakeholders / External Viewers | View-only access across all modules |

---

## 3. Admin

**Persona:** System Administrator, IT Admin  
**Permission:** `*` (wildcard — grants every permission)

### 2.1 User Management
| # | Use Case | Details |
|---|----------|---------|
| UC-A01 | View all users | See paginated user list with department, designation, role, status, manager, and mute filters |
| UC-A02 | Create a new user | Add user with name, email, role assignment, and optional department |
| UC-A03 | Assign/change user roles | Multi-select roles for any user from the roles dropdown |
| UC-A04 | Activate/deactivate users | Toggle a user between Active and Inactive status |
| UC-A05 | Reset user password | Set a new password for any non-SSO user |
| UC-A06 | Assign local password to SSO user | Give SSO users a local password for fallback authentication |
| UC-A07 | Sync users from QPeople HRMS | Import/update employee records from the QPeople HR system |
| UC-A08 | Mute/unmute notifications | Toggle email notifications per user |
| UC-A09 | Reset all user roles | Bulk-remove all role assignments (Admin users retain Admin role) |

### 2.2 Role Management
| # | Use Case | Details |
|---|----------|---------|
| UC-A10 | View roles permission matrix | See tabular grid of all roles vs. all permission categories |
| UC-A11 | Edit role permissions | Toggle individual permissions on/off for any role |
| UC-A12 | Create custom role | Define new role with name, description, and selected permissions |
| UC-A13 | Delete custom role | Remove non-system roles that have no assigned users |
| UC-A14 | Reset role defaults | Restore all system role permissions to factory defaults |
| UC-A15 | Add/remove users from roles | Manage role membership from the Roles tab |

### 2.3 QPeople Integration
| # | Use Case | Details |
|---|----------|---------|
| UC-A16 | View QPeople role mappings | See designation-to-role mapping table |
| UC-A17 | Create/edit mapping | Map a QPeople designation to one or more Q-CRM roles |
| UC-A18 | Delete mapping | Remove a specific designation-to-role mapping |
| UC-A19 | Reset all mappings | Bulk-delete all QPeople role mappings |
| UC-A20 | Apply mappings | Push current mappings to reassign roles for all synced users |

### 2.4 Authentication Configuration
| # | Use Case | Details |
|---|----------|---------|
| UC-A21 | View auth config | See current authentication mode and SSO settings |
| UC-A22 | Switch auth mode | Change between Local, SSO, or Hybrid authentication |
| UC-A23 | Configure SSO settings | Set SSO provider, client ID, tenant, redirect URIs |

### 2.5 Master Data Administration
| # | Use Case | Details |
|---|----------|---------|
| UC-A24 | Manage clients | Create, edit, delete client records |
| UC-A25 | Manage regions | Create, edit, delete geographic regions |
| UC-A26 | Manage technologies | Create, edit, delete technology/skill tags |
| UC-A27 | Manage pricing models | Create, edit, delete pricing model definitions (T&M, Fixed, etc.) |
| UC-A28 | Manage project types | Create, edit, delete project type categories |

### 2.6 Cost & Rate Management
| # | Use Case | Details |
|---|----------|---------|
| UC-A29 | Manage rate cards | Create, edit, delete rate card entries (role/band/rate) |
| UC-A30 | Manage budget assumptions | Configure default budget parameters |
| UC-A31 | Manage currency rates | Add, edit, toggle, delete currency exchange rates |
| UC-A32 | Sync currency rates | Pull latest exchange rates from external source |
| UC-A33 | Use GOM calculator | Run Gross Operating Margin calculations |

### 2.7 Email & Notifications
| # | Use Case | Details |
|---|----------|---------|
| UC-A34 | Manage email templates | Create, edit, delete email templates with WYSIWYG editor |
| UC-A35 | Use template field catalog | Insert variables from 15+ data tables (95+ fields) |
| UC-A36 | Create custom formula fields | Define calculated fields using built-in functions |
| UC-A37 | Preview email templates | Live preview with sample data rendering |
| UC-A38 | Send test emails | Dispatch test email to verify template rendering |
| UC-A39 | Manage notification rules | Create, edit, delete rules (opportunity_created, stage_change, data_condition) |

### 2.8 SOW Studio Administration
| # | Use Case | Details |
|---|----------|---------|
| UC-A40 | Manage SOW templates | Upload, edit, delete SOW document templates |
| UC-A41 | Configure template anchors | Map content sections to template placeholders |
| UC-A42 | Manage metadata categories/values | Define SOW metadata taxonomies |
| UC-A43 | Manage static content blocks | Create reusable SOW text sections |
| UC-A44 | Manage clauses | Create, edit, delete legal/contractual clauses |
| UC-A45 | Manage section rules | Define conditional section inclusion logic |
| UC-A46 | Configure approval workflows | Set up SOW approval chains and config |
| UC-A47 | Configure SOW numbering | Set document numbering format and sequence |

### 2.9 Audit & Compliance
| # | Use Case | Details |
|---|----------|---------|
| UC-A48 | View audit logs | Browse all system audit events with entity/action filters |
| UC-A49 | Export audit data | Download audit log records for compliance review |

### 2.10 All Operational Features
Admin inherits **all** use cases from every other role (Manager, Sales, Presales, Management, Read-Only) due to wildcard permission.

---

## 4. Manager

**Persona:** Practice Head, Delivery Manager, Department Lead  
**Permissions:** `dashboard:view`, `pipeline:view`, `pipeline:write`, `presales:view`, `presales:write`, `sales:view`, `sales:write`, `estimation:manage`, `approvals:manage`, `contacts:view`, `contacts:write`, `analytics:view`, `analytics:export`, `agents:execute`, `gom:view`, `leads:manage`, `resources:manage`, `settings:view`, `auditlogs:view`

### 3.1 Dashboard & Pipeline
| # | Use Case | Details |
|---|----------|---------|
| UC-M01 | View dashboard | See high-level metrics, pipeline summary cards, charts |
| UC-M02 | View opportunity pipeline | Browse all opportunities with filters (stage, practice, client, date) |
| UC-M03 | Create new opportunity | Submit a new opportunity with all required fields |
| UC-M04 | Edit opportunity details | Update any field — stage, value, dates, team, practice, etc. |
| UC-M05 | View opportunity detail | Full detail view with timeline, comments, attachments, audit log |
| UC-M06 | Add comments | Post comments on opportunities for team collaboration |
| UC-M07 | Upload/download attachments | Attach supporting documents (RFP, proposal, contracts) |
| UC-M08 | Delete attachments | Remove attached files from opportunities |
| UC-M09 | View opportunity audit log | See change history for any opportunity |

### 3.2 Presales & Estimation
| # | Use Case | Details |
|---|----------|---------|
| UC-M10 | View presales data | See solution design, effort estimates, team composition |
| UC-M11 | Edit presales details | Update technical solution, resource plan, effort breakdown |
| UC-M12 | Manage estimations | Create, edit, review effort and cost estimates |
| UC-M13 | Submit GOM for approval | Send Gross Operating Margin calculation for review |
| UC-M14 | Review GOM approvals | Approve or reject GOM submissions from team members |

### 3.3 Sales & Conversion
| # | Use Case | Details |
|---|----------|---------|
| UC-M15 | View sales data | See commercial terms, pricing, negotiation status |
| UC-M16 | Edit sales details | Update pricing, discounts, terms, contract values |
| UC-M17 | Convert opportunity | Move opportunity from presales to active sales/won status |

### 3.4 Approvals
| # | Use Case | Details |
|---|----------|---------|
| UC-M18 | Review and approve requests | Act on pending approval items (GOM, SOW, stage gates) |
| UC-M19 | Reject with feedback | Decline requests with comments for correction |

### 3.5 Analytics & Reporting
| # | Use Case | Details |
|---|----------|---------|
| UC-M20 | View analytics dashboards | Access pipeline analytics, win/loss ratios, trend charts |
| UC-M21 | Export analytics data | Download reports and data extracts in supported formats |

### 3.6 Leads & Contacts
| # | Use Case | Details |
|---|----------|---------|
| UC-M22 | Manage leads | Create, update, qualify, and convert leads to opportunities |
| UC-M23 | View contacts | Browse contact directory |
| UC-M24 | Create/edit contacts | Add or update client contact information |

### 3.7 Resources & AI
| # | Use Case | Details |
|---|----------|---------|
| UC-M25 | Manage resources | View and manage resource allocation and availability |
| UC-M26 | Execute AI agents | Run AI-powered tasks (chatbot queries, automated analysis) |

### 3.8 GOM & Settings
| # | Use Case | Details |
|---|----------|---------|
| UC-M27 | Use GOM calculator | Calculate Gross Operating Margin for opportunities |
| UC-M28 | View settings | Access read-only view of system configuration |

### 3.9 Audit
| # | Use Case | Details |
|---|----------|---------|
| UC-M29 | View audit logs | Browse system audit events for oversight and tracking |

---

## 5. Sales

**Persona:** Sales Executive, Account Manager, Business Development Manager  
**Permissions:** `dashboard:view`, `pipeline:view`, `pipeline:write`, `presales:view`, `sales:view`, `sales:write`, `contacts:view`, `contacts:write`, `analytics:view`, `agents:execute`, `gom:view`, `leads:manage`, `settings:view`

### 4.1 Dashboard & Pipeline
| # | Use Case | Details |
|---|----------|---------|
| UC-S01 | View dashboard | See personal and team pipeline metrics |
| UC-S02 | View pipeline | Browse opportunities by stage, value, client |
| UC-S03 | Create opportunity | Register new opportunities sourced from leads or direct |
| UC-S04 | Edit opportunity | Update opportunity details, move through stages |
| UC-S05 | Add comments | Collaborate on opportunities via comments |
| UC-S06 | Manage attachments | Upload/download/delete supporting documents |
| UC-S07 | View audit trail | See change history for opportunities |

### 4.2 Sales Activities
| # | Use Case | Details |
|---|----------|---------|
| UC-S08 | View sales data | See pricing, commercial terms, contract status |
| UC-S09 | Edit sales details | Update pricing, discounts, win probabilities, close dates |
| UC-S10 | Convert opportunity | Transition opportunity to Won/Active stage |

### 4.3 Presales (View Only)
| # | Use Case | Details |
|---|----------|---------|
| UC-S11 | View presales data | See solution details and estimates (read-only) |
| UC-S12 | View estimations | Review effort/cost estimates prepared by presales |

### 4.4 Leads & Contacts
| # | Use Case | Details |
|---|----------|---------|
| UC-S13 | Manage leads | Create, qualify, nurture leads and convert to opportunities |
| UC-S14 | View contacts | Access client contact directory |
| UC-S15 | Create/edit contacts | Maintain client stakeholder information |

### 4.5 Analytics & AI
| # | Use Case | Details |
|---|----------|---------|
| UC-S16 | View analytics | Access pipeline reports and win/loss analysis |
| UC-S17 | Execute AI agents | Use chatbot and AI-assisted tools |

### 4.6 GOM & Settings
| # | Use Case | Details |
|---|----------|---------|
| UC-S18 | View GOM calculator | Review margin calculations (read-only) |
| UC-S19 | View settings | Access system configuration (read-only) |

### 4.7 What Sales Cannot Do
- Edit presales/estimation data
- Approve/reject requests
- Export analytics
- Manage resources
- View audit logs
- Access any admin or configuration features

---

## 6. Presales

**Persona:** Presales Consultant, Solution Architect, Technical Lead  
**Permissions:** `dashboard:view`, `pipeline:view`, `presales:view`, `presales:write`, `estimation:manage`, `sales:view`, `contacts:view`, `analytics:view`, `agents:execute`, `gom:view`, `settings:view`

### 5.1 Dashboard & Pipeline
| # | Use Case | Details |
|---|----------|---------|
| UC-P01 | View dashboard | See presales workload and pipeline summary |
| UC-P02 | View pipeline | Browse opportunities assigned for presales work |
| UC-P03 | View opportunity detail | Access full opportunity information |
| UC-P04 | Add comments | Collaborate on technical aspects via comments |

### 5.2 Presales & Estimation
| # | Use Case | Details |
|---|----------|---------|
| UC-P05 | Edit presales data | Update solution approach, architecture, technical details |
| UC-P06 | Manage estimations | Create and refine effort estimates, resource plans |
| UC-P07 | Build cost estimates | Use rate cards and budget assumptions to build cost models |
| UC-P08 | Submit GOM for approval | Send margin calculation for manager approval |
| UC-P09 | Review GOM approvals | Approve or reject GOM submissions |
| UC-P10 | Define resource requirements | Specify roles, skills, and FTE requirements |

### 5.3 Sales (View Only)
| # | Use Case | Details |
|---|----------|---------|
| UC-P11 | View sales data | See commercial terms and pricing decisions (read-only) |

### 5.4 Contacts & Analytics
| # | Use Case | Details |
|---|----------|---------|
| UC-P12 | View contacts | Browse client contact directory (read-only) |
| UC-P13 | View analytics | Access pipeline and estimation analytics |
| UC-P14 | Execute AI agents | Use chatbot for technical research |

### 5.5 GOM & Settings
| # | Use Case | Details |
|---|----------|---------|
| UC-P15 | View GOM calculator | Review and use margin calculations |
| UC-P16 | View settings | Access system configuration (read-only) |

### 5.6 What Presales Cannot Do
- Create new opportunities
- Edit opportunity pipeline fields (stage, value, dates)
- Edit sales data (pricing, discounts)
- Convert opportunities
- Manage leads
- Create/edit contacts
- Export analytics
- Approve non-GOM requests
- Manage resources
- View audit logs
- Access any admin features

---

## 7. Management

**Persona:** CXO, VP, Senior Director, Board Member  
**Permissions:** `dashboard:view`, `pipeline:view`, `presales:view`, `sales:view`, `contacts:view`, `analytics:view`, `analytics:export`, `approvals:manage`, `auditlogs:view`, `gom:view`, `settings:view`

### 6.1 Strategic Oversight
| # | Use Case | Details |
|---|----------|---------|
| UC-G01 | View dashboard | See executive-level metrics and KPIs |
| UC-G02 | View pipeline | Browse full opportunity pipeline across all practices |
| UC-G03 | View opportunity details | Drill down into any opportunity for review |
| UC-G04 | View presales data | Review solution approaches and estimates |
| UC-G05 | View sales data | Review commercial terms and revenue projections |
| UC-G06 | View contacts | Access client stakeholder directory |

### 6.2 Analytics & Reporting
| # | Use Case | Details |
|---|----------|---------|
| UC-G07 | View analytics | Access comprehensive dashboards, trends, win/loss analysis |
| UC-G08 | Export analytics | Download reports for board presentations and reviews |

### 6.3 Approvals
| # | Use Case | Details |
|---|----------|---------|
| UC-G09 | Review approvals | Act on escalated approval requests (GOM, SOW, high-value deals) |
| UC-G10 | Approve/reject with feedback | Provide executive approval or request revisions |

### 6.4 Audit & Compliance
| # | Use Case | Details |
|---|----------|---------|
| UC-G11 | View audit logs | Review system activity for governance and compliance |

### 6.5 Settings & GOM
| # | Use Case | Details |
|---|----------|---------|
| UC-G12 | View GOM calculator | Review margin calculations |
| UC-G13 | View settings | See system configuration (read-only) |

### 6.6 What Management Cannot Do
- Create or edit opportunities
- Edit presales or sales data
- Create or manage estimations
- Manage leads or contacts
- Manage resources
- Execute AI agents
- Access any admin or configuration features
- Upload/delete attachments

---

## 8. Read-Only

**Persona:** External Stakeholder, Auditor, Observer, New Employee in Onboarding  
**Permissions:** `dashboard:view`, `pipeline:view`, `presales:view`, `sales:view`, `contacts:view`, `analytics:view`, `gom:view`, `settings:view`

### 7.1 View-Only Access
| # | Use Case | Details |
|---|----------|---------|
| UC-R01 | View dashboard | See summary metrics and pipeline overview |
| UC-R02 | View pipeline | Browse opportunity list (read-only) |
| UC-R03 | View opportunity details | See full opportunity information, timeline, comments |
| UC-R04 | View presales data | See solution and estimation details |
| UC-R05 | View sales data | See commercial terms and pricing |
| UC-R06 | View contacts | Browse contact directory |
| UC-R07 | View analytics | Access dashboards and reports (no export) |
| UC-R08 | View GOM calculator | See margin calculations |
| UC-R09 | View settings | See system configuration |

### 7.2 What Read-Only Cannot Do
- Create, edit, or delete any records
- Add comments to opportunities
- Upload or manage attachments
- Manage leads
- Export data
- Execute AI agents
- Approve anything
- Access any admin features

---

## 9. Permission Reference Matrix

| Permission | Admin | Manager | Sales | Presales | Management | Read-Only |
|------------|:-----:|:-------:|:-----:|:--------:|:----------:|:---------:|
| `dashboard:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pipeline:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pipeline:write` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `presales:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `presales:write` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `estimation:manage` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `sales:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sales:write` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `approvals:manage` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `contacts:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `contacts:write` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `analytics:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `analytics:export` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `agents:execute` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `gom:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `leads:manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `resources:manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `settings:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `settings:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `metadata:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `costcard:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `auditlogs:view` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `sow:view` | ✅ | ❌* | ❌* | ❌* | ❌ | ❌ |
| `sow:write` | ✅ | ❌* | ❌ | ❌* | ❌ | ❌ |
| `sow:admin` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> *\* SOW permissions are not included in default role definitions but can be manually assigned by an Admin via the Roles permission matrix.*

---

## Notes

1. **Custom Roles** — Admins can create additional roles with any combination of permissions beyond these six system roles.
2. **Multiple Roles** — Users can be assigned multiple roles and switch between them; the active role determines current access.
3. **Wildcard** — Only Admin has `*` permission; this automatically grants access to any current and future features.
4. **SSO Users** — Users authenticating via SSO get roles assigned through QPeople designation mappings or manual admin assignment.
5. **Notification Muting** — Any user can be muted by an Admin regardless of role; muted users do not receive system email notifications.
