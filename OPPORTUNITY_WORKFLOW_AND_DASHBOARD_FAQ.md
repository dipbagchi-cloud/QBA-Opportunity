![Q‑CRM](assets/qcrm-logo.png)

# Q‑CRM — Opportunity Workflow & Dashboard FAQ

> **Application:** https://qcrm.qbadvisory.com
> **Audience:** Sales, Presales, Managers, Management, Admins, and read‑only stakeholders
> **Scope:** How an opportunity moves from creation to a won/lost outcome, the gates and back‑and‑forth loops along the way, and how to read the Dashboard.
> **Last reviewed:** June 3, 2026

This document is written as a set of frequently asked questions. It is grouped into sections so you can jump to the area you care about:

1. [Getting Started & Concepts](#1-getting-started--concepts)
2. [The Opportunity Workflow](#2-the-opportunity-workflow)
3. [Pipeline Stage (Project Details)](#3-pipeline-stage-project-details)
4. [Presales Stage (Estimation & GOM)](#4-presales-stage-estimation--gom)
5. [Sales Stage (Proposal, Negotiation, Re‑estimate)](#5-sales-stage-proposal-negotiation-re-estimate)
6. [Closing: Won, Lost & Convert to Project](#6-closing-won-lost--convert-to-project)
7. [SOW Studio & Approvals](#7-sow-studio--approvals)
8. [Roles & Who Can Do What](#8-roles--who-can-do-what)
9. [The Dashboard](#9-the-dashboard)
10. [Notifications & Email](#10-notifications--email)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Getting Started & Concepts

**Q: What is an "opportunity" in Q‑CRM?**
An opportunity is a single potential deal — a client, a piece of work, a value, and the people working it. It is the central record in the system. Everything else (estimation, GOM, the proposal, the SOW, approvals, the eventual project) hangs off the opportunity.

**Q: What are the two views I'll use most?**
- **The Dashboard** (`/dashboard`) — a read‑at‑a‑glance summary of the whole pipeline: KPIs, charts, your pending actions, and deal‑health insights.
- **The Opportunity Detail page** (`/dashboard/opportunities/{id}`) — the working surface for a single deal. It has a 4‑step stepper (Pipeline → Presales → Sales → Project) and is where the actual workflow happens.

**Q: What's the difference between a "stage" and the "stepper steps"?**
There are two related concepts:

- **Workflow steps (the stepper):** four high‑level phases shown across the top of the detail page — **Pipeline → Presales → Sales → Project**. This is what most people mean by "the workflow."
- **Pipeline stages (the underlying status):** the finer‑grained status the deal sits in — **Discovery, Qualification, Proposal, Negotiation, Closed Won, Closed Lost** (plus special statuses like *Proposal Lost*). These drive probability, health, and reporting.

The stepper step is derived from the underlying stage. Roughly: Pipeline ≈ Discovery, Presales ≈ Qualification, Sales ≈ Proposal/Negotiation, Project ≈ Closed Won / delivery.

**Q: What do the percentages next to each stage mean?**
They are the **base win probability** for a deal in that stage:

| Stage | Base probability |
|---|---|
| Discovery | 10% |
| Qualification | 25% |
| Proposal | 50% |
| Negotiation | 75% |
| Closed Won | 100% |
| Closed Lost | 0% |

The displayed probability can rise a little above the base (up to +15%) as the deal record gets more complete (description, region, estimation data, rate, duration, expected close date all filled in).

---

## 2. The Opportunity Workflow

**Q: What is the overall flow, start to finish?**

```
DISCOVERY ──► QUALIFICATION ──► PROPOSAL ──► NEGOTIATION ──► CLOSED WON
 (10%)          (25%)            (50%)         (75%)           (100%)
   │              │  ▲             │  ▲           │
   │              │  │ Re-estimate │  │           │
   │              │  └─────────────┘  │           │
   │              │                   │           │
   │       GOM Approval Gate    ◄── Re-estimate ──┘
   │       (must pass before
   │        moving to Proposal)
   ▼
CLOSED LOST (0%)  ◄── can happen from any open stage
```

In stepper terms: you fill in **Pipeline** details, hand off to **Presales** for estimation + GOM, move to **Sales** to build and negotiate the proposal, then **Convert to Project** on win.

**Q: Is the workflow strictly linear?**
No. Q‑CRM is intentionally **not** a one‑way pipeline. There are several feedback loops that push a deal backward:

| Loop | From → To | Who triggers it | What it does |
|---|---|---|---|
| **Re‑estimate** | Proposal / Negotiation → Qualification | Sales | Sends the deal back to Presales to re‑estimate; resets GOM approval; increments the re‑estimate counter |
| **GOM rejection** | Manager → Presales (within Qualification) | Manager | Rejects the GOM; Presales revises and resubmits |
| **Discount rejection** | Finance → Sales (within Negotiation) | Finance approver | Rejects a discount request; Sales adjusts pricing |
| **SOW review rejection** | Any reviewer → Author | SOW reviewer | SOW reverts to Drafting; author fixes and resubmits |
| **SOW client revision** | Client → Author | Client feedback | SOW set to "Revision Requested"; author revises and re‑shares |

**Q: What are the "gates" in the workflow?**
A gate is a checkpoint you must pass before the deal can advance:

- **GOM Approval Gate** — a deal cannot move from Qualification to Proposal until its GOM (Gross Operating Margin) is approved (either auto‑approved above the threshold, or approved by the reporting manager).
- **SOW gate to Sales** — fixed‑price deals require a Statement of Work before they can be marked as moving to Sales. **Time & Material (T&M) deals are exempt** from the mandatory‑SOW gate.

**Q: How do I move a deal to the next step?**
Use the action button in the header of the detail page. The button changes depending on the current step and your role:

- In **Pipeline**: **"Move to Presales"** (and **"Mark as Lost"**).
- In **Presales**: **"Move to Sales"** (enabled once estimation/GOM is in place).
- In **Sales / Proposal**: proposal actions and **"Send for Re‑estimate"**.
- In **Sales / Negotiation**: **"Move to Project"** (convert on win) and **"Mark as Lost"**.

You can only act on steps your role and the deal's current stage allow.

---

## 3. Pipeline Stage (Project Details)

**Q: What happens in the Pipeline step?**
This is the intake/qualification of the deal. You capture the basic shape of the work:

- Client, Region, Project Type, Practice
- Sales Rep, Technology, Date range and Duration
- Pricing Model, Expected Day Rate, Description

**Q: Are any fields auto‑calculated here?**
Yes:
- **End Date** = Start Date + Duration (months)
- **Estimated Value** ≈ daily rate × ~20 working days × duration in months

**Q: Who can edit Pipeline fields?**
Sales and Manager (and Admin) while the deal is in the Pipeline step. Once the deal advances past Pipeline, most fields become read‑only to preserve the agreed baseline. Client/country are only editable in the very first step.

**Q: What does "Move to Presales" do?**
It hands the opportunity to the Presales team for estimation. The deal's status advances and the Presales sub‑tabs (Budget Assumptions, Resource Assignment, Estimation, GOM) unlock.

---

## 4. Presales Stage (Estimation & GOM)

**Q: What does Presales do on a deal?**
Presales builds the cost/effort estimate and computes the deal's profitability (GOM). The Presales step has four sub‑areas:
1. **Budget Assumptions** — the parameters (margin %, bench %, working days, loadings, etc.) used in the math.
2. **Resource Assignment** — the people/roles on the deal with their monthly effort.
3. **Estimation** — the line‑by‑line build of cost and revenue.
4. **GOM Calculator** — the resulting Gross Operating Margin breakdown.

**Q: What is GOM?**
**Gross Operating Margin** — the profitability of the deal after loaded delivery costs. Per resource line, roughly:

```
Revenue   = days × dailyRate
Salary    = days × dailyCost
+ loadings (bonus, indirect, welfare, training, bench, etc.)
GOM%      = (Revenue − loaded cost) / Revenue
```

**Q: What is the GOM Approval Gate?**
Once the GOM is calculated in Qualification, it must be approved before the deal can move to Proposal:
- **Auto‑approve:** if GOM% is at or above the configured threshold, it's approved automatically.
- **Manual:** otherwise the **Reporting Manager** reviews and either approves or rejects with feedback. On rejection, Presales revises the estimate and resubmits.

**Q: Can the Pipeline manager / offshore manager be assigned here?**
Yes — assignment of the Offshore Manager is allowed in the Pipeline tab on edit. Presales assignment is done via the **Assign Presales** action, which routes the estimation work and notifies the assignee.

**Q: What happens when Presales submits the estimation?**
The estimation is saved to the opportunity, the deal's detailed status reflects *"Estimation Submitted,"* and (if it passed the GOM gate) it can advance to Sales. Submitted estimations become read‑only to lock the numbers.

---

## 5. Sales Stage (Proposal, Negotiation, Re‑estimate)

**Q: What does the Sales step contain?**
A read‑only summary of the Pipeline and Presales data (so Sales has full context), plus the sales‑specific actions: build/send the proposal, negotiate, request discounts, and either close‑won or close‑lost.

**Q: What is the Re‑estimate loop and when do I use it?**
If, during Proposal or Negotiation, the numbers no longer work (scope changed, client pushback, pricing needs a rethink), Sales clicks **"Send for Re‑estimate."** This:
1. Sends the deal **back to Qualification**.
2. **Resets GOM approval** (it must pass the gate again).
3. **Increments the re‑estimate count** (tracked and reported on the dashboard).
4. Sets detailed status to *"Sent for Re‑estimate"* and notifies Presales + Manager.

Presales re‑works the estimate, re‑passes the GOM gate, and on resubmit the deal returns to Proposal (status *"Re‑estimation Submitted"*).

**Q: What is the Discount Approval flow?**
When Sales applies a discount, the system checks the guardrail: **if discount > 15% AND margin < 20%**, it must be approved by the **Finance Manager**. Otherwise it's auto‑approved and Sales proceeds. On rejection, Sales adjusts pricing and resubmits.

**Q: What's the difference between "Proposal Submitted," "Under Negotiation," and "SOW Approved"?**
These are status badges derived from where the deal sits:
- **Proposal Submitted** — in the Sales step, Proposal stage.
- **Under Negotiation** — in the Sales step, Negotiation stage.
- **SOW Approved** — the deal has reached the Project step (converted/won).

---

## 6. Closing: Won, Lost & Convert to Project

**Q: How do I mark a deal as Won?**
From the Sales step (Negotiation stage), click **"Move to Project."** This converts the opportunity:
- Stage becomes **Closed Won**.
- Detailed status becomes **SOW Approved**.
- A linked **Project** record is created and the Project step becomes visible.
If the deal was already converted, the system handles it gracefully (no duplicate project).

**Q: How do I mark a deal as Lost?**
Click **"Mark as Lost."** A modal opens requiring a **reason/remarks** (mandatory). Two flavors exist depending on where you are:
- **Closed Lost** — the deal is dead.
- **Proposal Lost** — lost at the proposal stage specifically.

After marking lost, a lost banner shows the timestamp and remarks, and the action buttons are hidden. A lost deal counts as 0% probability and 0 health.

**Q: Can a deal be marked Lost from any stage?**
Yes — a deal can be closed‑lost from any open stage. It will not, however, count toward closed/won revenue.

**Q: What is the Project step?**
After conversion it displays the linked project's details. This is the handoff point from "selling the work" to "delivering the work."

---

## 7. SOW Studio & Approvals

**Q: What is the SOW Studio?**
It's where the **Statement of Work** document is drafted, reviewed internally, shared with the client, and finalized. It supports AI‑assisted drafting and a readiness check for missing inputs.

**Q: What is the SOW document lifecycle?**
```
Drafting → AI Generated → In Review → (Approved Internally → Shared with Client
        → Finalized → Signed/Archived)
                   └─ Requires Inputs / Revision Requested loop back to Drafting
```
- **Requires Inputs** — the readiness engine found missing data; the author fills the gaps and resubmits.
- **Revision Requested** — the client asked for changes; the author revises and re‑shares.

**Q: What is the SOW Approval chain?**
A configurable, multi‑step review: **Sales → Presales → Manager → Finance → Legal.** Each step has reviewer role(s), an optional escalation timer, and a required/optional flag. **A rejection at any step sends the SOW back to Drafting**, and after fixes the chain restarts from step 1.

**Q: Is an SOW always required to move to Sales?**
For fixed‑price deals, yes. **Time & Material (T&M) deals are exempt** from the mandatory‑SOW gate and can move to Sales without one.

**Q: What are the three approval types in the system?**

| Approval | Trigger | Auto‑approve | Reviewer | Blocks a stage? |
|---|---|---|---|---|
| **GOM Approval** | GOM% calculated in Qualification | GOM% ≥ threshold | Reporting Manager | **Yes** — blocks Proposal |
| **Discount Approval** | Discount > 15% AND margin < 20% | Otherwise auto | Finance Manager | No |
| **SOW Approval** | SOW submitted for review | Never (always manual) | Sales → Presales → Manager → Finance → Legal | No |

---

## 8. Roles & Who Can Do What

**Q: What roles exist?**
Six system roles. A user can hold multiple roles and switch between them; the **active role** decides current permissions.

| Role | Typical user | What they do |
|---|---|---|
| **Admin** | IT / System Admin | Full access (wildcard) — users, roles, master data, config |
| **Manager** | Practice Head / Delivery Manager | Full opportunity lifecycle + GOM approvals + analytics export + audit |
| **Sales** | Sales Executive / Account Manager | Pipeline, proposals, negotiation, convert to project |
| **Presales** | Solution Architect / Consultant | Estimation, GOM, resource planning |
| **Management** | CXO / Leadership | Read‑only oversight + approvals + analytics export |
| **Read‑Only** | Stakeholders / external viewers | View‑only across modules |

**Q: Who acts at each stage?**

| Stage | Sales | Presales | Manager |
|---|---|---|---|
| Discovery | Fills pipeline data | — | Notified |
| Qualification | Reviews | **Estimates & GOM** | **Approves GOM** |
| Proposal | **Drives proposal** | Views | Notified |
| Negotiation | **Negotiates** | Views | Oversight |
| Closed Won | **Converts to project** | Notified | Notified |
| Closed Lost | Records loss reason | — | Notified |

**Q: Why are some buttons/fields greyed out for me?**
Three things gate the UI:
1. **Your active role's permissions** (e.g., only Sales/Manager can move Pipeline forward).
2. **The deal's current stage** — you can only access stepper steps at or before the current stage.
3. **Lock conditions** — a deal that is **Lost**, **Stalled (On Hold)**, in **Negotiation**, or already in the **Project** step locks most edits to protect the agreed record.

---

## 9. The Dashboard

**Q: What is the Dashboard for?**
It's the at‑a‑glance command center: top‑line KPIs, the charts that explain them, your personal to‑do list, and AI‑style health insights. It refreshes silently when you return to the browser tab.

**Q: What are the KPI cards at the top?**
There are seven headline metrics:

| Card | What it shows |
|---|---|
| **Projected Revenue** | Value of all open (not won/lost) opportunities, with the total opportunity count |
| **Closed Revenue** | Value of won/delivered deals, with the count of deals won |
| **Opportunities** | Total opportunity count, with how many are active |
| **Pipeline Value** | Value of all non‑closed deals, with the average deal size |
| **Win Rate** | Conversion rate, with won / lost counts |
| **Avg. Close Time** | Average days from open to close (shows fractions for sub‑day closes) |
| **Re‑estimate Iterations** | Total re‑estimate rounds, how many opps had re‑estimates, and the average rounds |

**Q: What charts are on the Dashboard?**
- **Revenue Projection** — bar chart of Proposed vs **Won** vs **Lost** by period.
- **By Stage** — donut/pie of opportunity counts per stage.
- **Opps by Salesperson** — count of opportunities per salesperson.
- **Revenue by Tech Stack** — revenue split by technology.
- **Revenue by Client** and **Opps by Client** — client concentration.
- **Revenue by Sales Rep** — revenue attributed per rep.

**Q: Can I see the underlying deals behind a chart?**
Yes — most visuals are **drill‑downs**. Clicking a chart opens a table of the exact opportunities behind it (Opportunity, Client, Value, Stage, Probability, Owner, Sales Rep, Health %, etc.).

**Q: What is "Your Pending Actions"?**
A personal worklist showing only **open** opportunities where *you* are the owner, sales rep, manager, or assigned presales estimator. It is searchable, sortable, and column‑filterable. For each row it suggests the next action based on stage:

| Stage | Suggested action |
|---|---|
| Pipeline / Discovery | Qualify & assign presales |
| Qualification / Presales | Complete presales estimation |
| Proposal / Sales | Prepare or send quote |
| Negotiation | Close negotiation |

Overdue items are flagged in red, items due within 7 days in amber, and stalled deals carry a **STALLED** tag.

**Q: What is the "Pipeline Insights & Deal Health" panel?**
Auto‑generated, plain‑language insights derived from the live pipeline, such as:
- **Stalled warnings** — "'Deal X' has been idle for N days. Consider following up."
- **Healthy high‑value highlights** — "'Deal Y' is progressing well — $value at probability%."
- **Critical alerts** — "'Deal Z' needs attention — health score is N%."
Alongside it, deals are bucketed by health: **Healthy (green) / At‑risk (amber) / Critical (red)**.

**Q: How is "deal health" calculated?**
A 0–100 composite of four weighted factors:

| Factor | Weight | Idea |
|---|---|---|
| Stage progress | 30% | Further along = healthier |
| Recency | 30% | Recently touched = healthier |
| Deal completeness | 20% | More fields filled = healthier |
| Value confidence | 20% | Pricing/duration/rate filled = healthier |

Buckets: **> 70 healthy, 40–70 at‑risk, ≤ 40 critical.** Closed Won is always 100%; Closed Lost is always 0%.

**Q: When is a deal "stalled"?**
When it has sat in the same stage for **more than 30 days** and is not already Closed Won / Closed Lost. Stalled deals are flagged on the dashboard and lock certain edits ("On Hold").

**Q: Does everyone see the same dashboard numbers?**
The dashboard is scoped to what your role/account can see. Sales‑type users see their own book of business in "Your Pending Actions"; Managers and Management see broader, oversight‑level aggregates. Read‑Only users can view but not act.

**Q: Is there a separate Analytics page?**
Yes — `/dashboard/analytics` provides deeper, tabbed reporting (Dashboard, Pipeline Metrics, Resource & Pre‑Sales, Sales & Conversion) with exportable charts for Managers and Management.

---

## 10. Notifications & Email

**Q: When does the system notify people?**
Notifications fire on key transitions and conditions, e.g.:
- Stage changes (moved to Presales, moved to Sales, etc.)
- Re‑estimate requests ("sent back to re‑estimate") and presales resubmissions
- Approvals (GOM, discount, SOW steps), including escalations
- Stalled deals and health drops

**Q: In‑app vs. email — what's the difference?**
- **In‑app** notifications appear in the app for the relevant users and are always delivered.
- **Email** notifications use configurable templates and can be **muted per user** (Admin toggles this in Settings → Users). Muting affects email only, never in‑app.

**Q: Will test/UAT environments email real clients?**
No. Non‑production environments (QA/UAT) never send email to real recipients — outbound mail is contained so testing can't reach live contacts.

---

## 11. Troubleshooting

**Q: I can't click "Move to Sales" — why?**
Common reasons: (a) the estimation/GOM isn't complete or hasn't passed the **GOM approval gate**; (b) the deal is fixed‑price and is missing the required **SOW** (T&M deals are exempt); (c) your active role doesn't have presales/sales permission; or (d) the deal is locked (Lost/Stalled/On Hold).

**Q: The fields are read‑only and I can't edit the pipeline.**
The deal has likely advanced past the Pipeline step, is in **Negotiation**, is **Stalled/On Hold**, or has been **converted to a project** — all of which lock the baseline. Editing earlier‑step fields is only possible while the deal is still in that step.

**Q: A deal went "backward" from Proposal to Qualification — is that a bug?**
No. That's the **Re‑estimate loop**: someone in Sales sent it back to Presales to re‑estimate. The GOM approval is reset and the re‑estimate counter goes up. It will return to Proposal after Presales resubmits.

**Q: My discount needs approval but I expected it to go through.**
Discounts auto‑approve unless they cross the guardrail (**> 15% discount AND < 20% margin**), in which case the **Finance Manager** must approve. Adjust the discount/margin or wait for approval.

**Q: The dashboard numbers look stale.**
The dashboard refetches when the browser tab regains focus (and on load). Switch away and back, or refresh, to force an update. Note that "Projected," "Closed," and "Pipeline" values are computed from the same backend aggregate, so they stay consistent with reporting.

**Q: I don't see the SOW chain / approval I expected.**
SOW approval steps are **configurable** (reviewer roles, required/optional, escalation timers). If a step looks missing, it may be marked optional or your role isn't a reviewer on that step. Admins/Managers configure the chain.

---

### Quick reference — the happy path

```
1. Create opportunity (Sales)            → Pipeline / Discovery
2. Fill project details, Move to Presales
3. Presales estimates + GOM              → Qualification
4. GOM approved (auto or Manager)        → gate passes
5. Move to Sales                         → Proposal
6. Build & send proposal, negotiate      → Negotiation
   (Discount > 15% & margin < 20%? Finance approves)
7. SOW drafted, reviewed, signed (fixed-price; T&M exempt)
8. Move to Project (Won)                 → Closed Won + Project created
```

> Found something in this FAQ that doesn't match what you see in the app? The app is the source of truth — flag it and we'll update this document.
