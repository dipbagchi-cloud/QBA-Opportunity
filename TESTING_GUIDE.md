# Agentic CRM - End-to-End Testing Guide

This guide outlines the User Acceptance Testing (UAT) scenarios to verify the application against the 10 Core Epics and Salesforce-grade standards.

## Prerequisites
- Application running at `http://localhost:3001`
- Database initialized (`npx prisma db push`)
- API Tool (Postman, Insomnia, or provided `curl` commands)

---

## 🧪 Test Scenarios

### 1. Epic 2: Intelligent Lead Intake & Scoring
**Goal**: Verify that leads are auto-scored and deduplicated upon entry.

**Test Steps (API):**
1. **Send a "Hot Lead" Payload** (High Budget + CxO Title):
   ```bash
   curl -X POST http://localhost:3001/api/leads \
   -H "Content-Type: application/json" \
   -d '{
     "companyName": "Salesforce Standard Corp",
     "title": "Enterpise CRM Implementation",
     "value": 60000,
     "source": "Inbound Demo Request",
     "contact": {
       "firstName": "Marc",
       "lastName": "Benioff",
       "email": "marc@salesforcestandard.com",
       "title": "CEO"
     }
   }'
   ```

**Expected Result:**
- **Status**: `success`
- **Qualification Score**: `> 70` (Should be high due to Title + Budget + Source).
- **Explanation**: Should say "Hot Lead! High budget...".
- **Probability**: Should default to `30%` (higher than standard 10%).

**Salesforce Check**: Does it automatically prioritize the lead without manual data entry?

---

### 2. Epic 3: Pipeline Intelligence (Risk Detection)
**Goal**: Verify that the system identifies "Stalled" deals and calculates Health Scores.

**Test Steps (UI/Visual):**
1. Navigate to **Opportunities** (`/dashboard/opportunities`).
2. Switch to **Kanban Board**.
3. Look for any card with a **Health Bar** (Green/Yellow/Red).
4. **Simulate Stalled Deal**:
   - *Note: Since this is fresh data, you may not see "Stalled" immediately. You would ideally manually update a record in the DB to have `updatedAt` > 30 days ago.*
   - Inspect a card. Verify the **Health Score** is visible (e.g., "70/100").

**Expected Result:**
- Cards show a visual Health Meter.
- Low probability deals (<20%) show as **Critical** (Red status).

---

### 3. Epic 6: Deal-to-Project Conversion (Seamless Handoff)
**Goal**: Verify that a Won Deal automatically creates a Delivery Project with milestones.

**Test Steps (API):**
1. Pick an `Opportunity ID` from your database (or from the response in Test 1).
2. **Trigger Conversion**:
   ```bash
   # Replace [ID] with actual UUID
   curl -X POST http://localhost:3001/api/opportunities/[ID]/convert
   ```

**Expected Result:**
- **Status**: `success`
- **Project Created**: Response includes a `project` object.
- **Budget Mapped**: `project.budget` matches `opportunity.value`.
- **Milestones**: Check that "Project Kickoff" milestone is auto-created.

**Salesforce Check**: Does it bridge the gap between Sales (CRM) and Delivery (PSA) instantly?

---

### 4. Epic 5: Deal Governance (Approvals)
**Goal**: Verify that high-risk discounts trigger an approval workflow.

**Test Steps (API):**
1. **Send a Risky Request** (>15% Discount, <20% Margin):
   ```bash
   curl -X POST http://localhost:3001/api/approvals \
   -H "Content-Type: application/json" \
   -d '{
     "opportunityId": "test-opp-id",
     "requesterId": "user-id",
     "discountPercent": 25,
     "marginPercent": 15
   }'
   ```

**Expected Result:**
- **Status**: `Pending`
- **Message**: "Request sent to Finance for review."
- **RequiresReview**: `true`

2. **Send a Safe Request** (10% Discount):
   - Change `discountPercent` to 10.
   - **Result**: `Approved` (Auto-approved).

---

### 5. Epic 9 & 10: Agent Automation & Governance
**Goal**: Verify that the Agent effectively blocks High-Risk actions but performs Low-Risk ones.

**Test Steps (API):**
1. **Attempt High Risk Action** (Delete Data):
   ```bash
   curl -X POST http://localhost:3001/api/agents/task \
   -H "Content-Type: application/json" \
   -d '{
     "actionType": "DELETE_DATA",
     "context": {}
   }'
   ```
   - **Result**: `AWAITING_APPROVAL` (Blocked).

2. **Attempt Low Risk Action** (Analyze Email):
   ```bash
   curl -X POST http://localhost:3001/api/agents/task \
   -H "Content-Type: application/json" \
   -d '{
     "actionType": "ANALYZE_EMAIL",
     "context": { "emailBody": "I am very angry and want a refund!" }
   }'
   ```
   - **Result**: `PAUSED` (Epic 4 Logic triggered: Negative Sentiment detected).

---

## 🏁 Final Verification

If all 5 scenarios pass, your system has successfully implemented the:
1. **Intelligence Layer** (Scoring, Risk, Sentiment).
2. **Governance Layer** (Approvals, Agent Guardrails).
3. **Integration Layer** (Deal-to-Project).

This confirms the capability to operate as an **Autonomous Agentic CRM**.
