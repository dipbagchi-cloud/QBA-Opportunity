# Agentic CRM Implementation Plan

## Project Overview
Building an AI-powered Lead/Opportunity Management System with autonomous agent capabilities for sales operations automation, intelligent assistance, and predictive analytics.

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, PostgreSQL, Prisma ORM, Redis
- **AI Layer**: LangChain/LangGraph, OpenAI API, RAG, pgvector
- **Auth**: NextAuth.js + Azure AD
- **Deployment**: Vercel/Azure App Service
- **File Storage**: Azure Blob Storage / AWS S3

### Core Architecture Patterns
1. **Modular Monolith** (start simple, microservices later if needed)
2. **Domain-Driven Design** for business logic
3. **CQRS** for read-heavy operations (dashboards, analytics)
4. **Event-Driven** for AI agents and workflows
5. **RAG Pattern** for context-aware AI assistance

---

## Detailed Implementation Epics

This roadmap is structured around 10 core Epics that evolve the platform from a standard CRM to an autonomous Agentic System.

### EPIC 1: Authentication, Organization & RBAC Foundation
**Goal**: Enable secure multi-tenant access with fine-grained permissions for humans and agents.

**Capabilities**
*   Auth & session management
*   Org & team hierarchy
*   Role-based access control (RBAC)
*   Admin console

**User Stories**
*   As a user, I want to sign up and log in securely so I can access my organization’s CRM.
*   As an admin, I want to create roles with granular permissions so access is controlled by responsibility.
*   As an admin, I want to assign users to teams so data can be scoped correctly.
*   As a system, I want to enforce row-level security so users only see allowed records.
*   As an admin, I want to view an audit log of all user and agent actions for compliance.
*   As a security admin, I want MFA for privileged roles so admin access is protected.

**Technical Implementation & Logic**
*   **Data Model**:
    *   `Organization`: Tenant root.
    *   `Role`: JSON-based permission sets (e.g., `{ "resource": "deals", "action": "create", "scope": "team" }`).
    *   `User`: Linked to Org and Role.
*   **Security Logic (RBAC Middleware)**:
    ```typescript
    function hasPermission(user, resource, action) {
      const permission = user.role.permissions.find(p => p.resource === resource);
      if (!permission) return false;
      return permission.actions.includes(action);
    }
    ```

---

### EPIC 2: Unified Lead Intake & Qualification
**Goal**: Ingest leads from anywhere and qualify them automatically.

**Capabilities**
*   Lead capture (forms, APIs, inbox)
*   Deduplication & enrichment
*   Scoring & assignment
*   Agent reasoning output

**User Stories**
*   As a marketer, I want to capture leads via forms and APIs so all inquiries land in one system.
*   As a system, I want to detect duplicate leads automatically to avoid data pollution.
*   As a sales rep, I want leads auto-assigned based on rules and capacity so I don’t miss opportunities.
*   As a sales rep, I want to see a lead score and ICP fit explanation so I know where to focus.
*   As an agent, I want to enrich lead data from external sources to improve qualification accuracy.
*   As a manager, I want to override assignment rules when needed.

**Technical Implementation & Logic**
*   **Deduplication Logic**:
    *   Use Fuzzy Matching (Levenshtein Distance) on Email and Company Name.
    *   `MatchConfidence = (EmailMatch * 0.8) + (NameMatch * 0.2)`
*   **Lead Scoring Formula**:
    ```typescript
    // Logic: Weighted sum of explicit (profile) and implicit (behavior) factors
    const calculateLeadScore = (lead, activities) => {
      const explicitScore = (lead.isCxO ? 20 : 0) + (lead.budget > 100k ? 30 : 0);
      const implicitScore = activities.reduce((sum, act) => sum + (act.type === 'webviz' ? 5 : 2), 0);
      return Math.min(explicitScore + implicitScore, 100);
    }
    ```

---

### EPIC 3: Sales Pipeline & Opportunity Management
**Goal**: Track deals through stages with predictive intelligence instead of manual babysitting.

**Capabilities**
*   Pipelines & stages
*   Activities & timelines
*   Risk detection
*   Next-best-action suggestions

**User Stories**
*   As a sales rep, I want to move deals through stages so I can track progress.
*   As a sales rep, I want a unified activity timeline so I see all interactions in one place.
*   As an agent, I want to detect stalled or risky deals based on behavior and time in stage.
*   As a sales rep, I want the system to suggest my next best action for each deal.
*   As a manager, I want to see pipeline health by rep and team so I can coach effectively.
*   As a system, I want to prevent deals from closing without required data.

**Technical Implementation & Logic**
*   **Stall Detection Logic**:
    *   `DaysInStage > (AverageDaysInStage + (1.5 * StandardDeviation))` -> Flag as "Stalled".
*   **Deal Health Score**:
    *   `Health = (ActivityRecency * 0.4) + (StakeholderEngagement * 0.3) + (Momentum * 0.3)`
    *   *Where Momentum is measured by stage velocity compared to historical average.*

---

### EPIC 4: Communication & Engagement Automation
**Goal**: Improve conversion with intelligent, contextual follow-ups.

**Capabilities**
*   Omnichannel messaging
*   Templates & sequences
*   Agent-generated drafts
*   Sentiment detection

**User Stories**
*   As a sales rep, I want to send emails and messages directly from the CRM so everything is logged.
*   As a sales rep, I want AI-drafted follow-ups so I save time writing.
*   As an agent, I want to adjust tone and timing based on deal stage and persona.
*   As a system, I want to automatically create follow-up tasks if no response is detected.
*   As a manager, I want visibility into engagement effectiveness by channel.
*   As a system, I want to pause automation when negative sentiment is detected.

**Technical Implementation & Logic**
*   **Sentiment Analysis**:
    *   Use NLP (e.g., OpenAI/LangChain classification) on incoming emails.
    *   If `SentimentScore < -0.6` (Negative), trigger `WorkflowPause` event.
*   **Smart Scheduling**:
    *   Analyze recipient's past reply times to predict `OptimalSendTime`.

---

### EPIC 5: Deal Governance & Approvals
**Goal**: Protect revenue and compliance without slowing sales velocity.

**Capabilities**
*   Approval workflows
*   Policy enforcement
*   Risk explanations

**User Stories**
*   As a sales rep, I want to request approval for discounts so deals move forward compliantly.
*   As a manager, I want to approve or reject requests with full context.
*   As an agent, I want to flag risky deals automatically based on pricing or terms.
*   As a finance admin, I want deal changes logged for auditability.
*   As a system, I want to block unauthorized deal closure actions.

**Technical Implementation & Logic**
*   **Discount Approval Rule**:
    *   `IF Discount > 15% AND Margin < 20% THEN RequireApproval(FinanceManager)`
*   **Audit Logging**:
    *   Immutable append-only log: `{ timestamp, actorId, entityId, previousValue, newValue, clientIP }`.

---

### EPIC 6: Deal-to-Project Conversion (Key Differentiator)
**Goal**: Ensure seamless handoff from sales to delivery with zero context loss.

**Capabilities**
*   Auto project creation
*   Templates
*   Context extraction
*   Risk flagging

**User Stories**
*   As a system, I want to automatically create a project when a deal is marked Closed Won.
*   As a delivery manager, I want projects generated from templates based on deal type.
*   As an agent, I want to extract scope, timelines, and commitments from deal notes and emails.
*   As a project owner, I want milestones and tasks pre-created so delivery can start immediately.
*   As a manager, I want to see delivery risks flagged before kickoff.

**Technical Implementation & Logic**
*   **Mapping Logic**:
    *   `Deal.Value` -> `Project.Budget`
    *   `Deal.CloseDate` -> `Project.StartDate`
    *   `Deal.LineItems` -> `Project.Deliverables`
*   **Agentic Extraction**:
    *   Run RAG over all Opportunity Emails/Notes -> Extract "Promises Made", "Deadlines", "Tech Constraints" -> Populate `ProjectCharter`.

---

### EPIC 7: Project Delivery & Execution (Key Differentiator)
**Goal**: Help teams deliver on time with proactive intelligence.

**Capabilities**
*   Task & milestone tracking
*   Status summaries
*   Risk prediction
*   Notifications

**User Stories**
*   As a project manager, I want to track milestones and tasks so delivery is transparent.
*   As an agent, I want to detect delivery delays before deadlines are missed.
*   As a system, I want to notify owners automatically when blockers appear.
*   As a stakeholder, I want weekly status summaries without manual reporting.
*   As a delivery lead, I want visibility into SLA adherence across projects.

**Technical Implementation & Logic**
*   **Schedule Variance (SV) Logic**:
    *   `SV = Earned Value (EV) - Planned Value (PV)`
    *   If `SV < 0`, Agent triggers an alert: "Project is behind schedule."
*   **Auto-Status Report**:
    *   Agent summarizes completed tasks vs planned tasks weekly and generates a natural language digest.

---

### EPIC 8: Reporting, Forecasting & Insights
**Goal**: Turn CRM data into explainable, actionable insights.

**Capabilities**
*   Dashboards
*   Forecasting
*   Natural language queries
*   Agent impact metrics

**User Stories**
*   As a sales leader, I want pipeline forecasts so I can plan revenue.
*   As a manager, I want explanations for forecast changes, not just numbers.
*   As a user, I want to ask questions like “Why did deals stall this week?” in plain language.
*   As a product owner, I want to measure how agent actions improve outcomes.
*   As a finance leader, I want revenue vs delivery insights.

**Technical Implementation & Logic**
*   **Weighted Forecast**:
    *   `Forecast = Sum(Opportunity.Value * Stage.Probability)`
*   **AI Explained Variance**:
    *   Compare `Forecast(ThisWeek)` vs `Forecast(LastWeek)`.
    *   Identify distinct deals that changed stage or value.
    *   Agent output: "Forecast dropped $50k primarily because Deal X moved to 'Closed Lost' and Deal Y was delayed."

---

### EPIC 9: Agent Framework & Governance (Key Differentiator)
**Goal**: Safely operate autonomous agents with transparency and control.

**Capabilities**
*   Agent definitions
*   Execution modes (Auto/Human-in-loop)
*   Approvals & rollback
*   Observability

**User Stories**
*   As an admin, I want to configure which actions agents can execute automatically.
*   As a user, I want to approve or reject agent-proposed actions.
*   As a system, I want all agent actions logged with reasoning.
*   As an admin, I want to roll back agent changes if needed.
*   As a compliance officer, I want agent behavior auditable.

**Technical Implementation & Logic**
*   **Agent State Machine**:
    *   States: `Idle` -> `Reasoning` -> `Proposing` -> `Executing` -> `Completed`.
*   **Governance Check**:
    ```typescript
    if (action.riskLevel === 'High' && !user.approved) {
      return state.transitionTo('AwaitingApproval');
    }
    ```

---

### EPIC 10: Automation Engine (Rules + Agents)
**Goal**: Combine deterministic workflows with intelligent decision-making.

**Capabilities**
*   Triggers & conditions
*   Rule-based actions
*   Agent invocation
*   SLA timers

**User Stories**
*   As an admin, I want to define automation rules without code.
*   As a system, I want to trigger agents only when human judgment is beneficial.
*   As a manager, I want approval gates for high-risk automations.
*   As a system, I want to enforce SLAs automatically.
*   As a developer, I want clear execution traces for debugging.

**Technical Implementation & Logic**
*   **Hybrid Trigger Logic**:
    *   Event: `EmailReceived`.
    *   Rule: If `SenderDomain` is `Competitor`, Tag as `Competitor`. (Deterministic)
    *   Agent: If `Content` implies `Urgency`, Draft `HighPriorityResponse`. (Probabilistic)

---

## Strategic Differentiation Map

| Feature Area | Salesforce (Leader) | GoHighLevel (Challenger) | **Agentic CRM (This System)** |
| :--- | :--- | :--- | :--- |
| **Primary Strength** | Enterprise Scale & Customization | Integrated Marketing & Speed | **Autonomous Intelligence & Delivery Handoff** |
| **Core Epics** | 1, 3, 5, 8 (Strong but heavy) | 2, 4, 10 (Fast but shallow) | **6, 7, 9 (Agentic + Lifecycle Continuity)** |
| **AI Approach** | Copilot (Sidebar helper) | Content Gen (Templates) | **Agents (Active Workers)** |
| **Delivery Handoff** | Requires complex integration | Not supported | **Native Deal-to-Project Conversion** |

---

## Next Steps

1. **Review & approve this plan** with stakeholders
2. **Setup project repository** and development environment
3. **Begin Phase 1** foundation work
4. **Schedule weekly demos** to show progress
5. **Iterate based on feedback**

---

## Notes
- This is an aggressive but achievable 21-week plan
- Phases can run partially in parallel with proper team coordination
- AI/Agentic layer (Phase 6) is the key differentiator
- Early focus on solid foundations will pay dividends
- Continuous user feedback is critical for AI features
