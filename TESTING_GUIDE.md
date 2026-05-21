# Q-CRM — Functional Testing Guide

> **Version:** May 2026  
> **Environments:**  
> - **Production:** https://qcrm.qbadvisory.com  
> - **UAT:** https://uat-qcrm.qbadvisory.com  
> - **QA:** https://qa-qcrm.qbadvisory.com  
> - **Local Backend:** http://localhost:3001  

Use `[ ]` / `[x]` checkboxes to track pass/fail during a test run.

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Authentication & Session Management](#2-authentication--session-management)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Opportunity Lifecycle — Pipeline Stage](#4-opportunity-lifecycle--pipeline-stage)
5. [Opportunity Lifecycle — Presales Stage](#5-opportunity-lifecycle--presales-stage)
6. [GOM Calculator](#6-gom-calculator)
7. [GOM Approval Workflow](#7-gom-approval-workflow)
8. [Opportunity Lifecycle — Sales & SOW Stage](#8-opportunity-lifecycle--sales--sow-stage)
9. [Notification System](#9-notification-system)
10. [Email Notifications & Templates](#10-email-notifications--templates)
11. [Client & Contact Management](#11-client--contact-management)
12. [Attachments & File Management](#12-attachments--file-management)
13. [Currency Management](#13-currency-management)
14. [Rate Cards & Cost Management](#14-rate-cards--cost-management)
15. [Admin Panel](#15-admin-panel)
16. [AI Chatbot](#16-ai-chatbot)
17. [Analytics & Reporting](#17-analytics--reporting)
18. [Audit Logging](#18-audit-logging)
19. [Deal-to-Project Conversion](#19-deal-to-project-conversion)
20. [May 2026 Fixes — Regression Checklist](#20-may-2026-fixes--regression-checklist)

---

## 1. Test Environment Setup

### Required Test Users

| Role | Email (example) | Notes |
|------|----------------|-------|
| Admin | admin@qbadvisory.com | Full access, can impersonate |
| Sales | sales@qbadvisory.com | Can create opportunities, edit pipeline fields |
| Manager | manager@qbadvisory.com | Approves GOM, manages presales assignment |
| Presales | presales@qbadvisory.com | Access to estimation, resource assignment |
| External | external@client.com | Local auth only (hybrid mode) |

### Auth Mode Check

Before testing, confirm auth mode via Admin → System Config → Auth Mode.

- `local` — use email + password for all users  
- `hybrid` — `@qbadvisory.com` uses SSO; external uses password  
- `sso` — all users must authenticate via Microsoft Entra  

---

## 2. Authentication & Session Management

### 2.1 Local Login

- [ ] Navigate to `/login`
- [ ] Enter valid email + password → **Expected:** Redirect to `/dashboard`
- [ ] Enter wrong password → **Expected:** "Invalid credentials" error, no redirect
- [ ] Enter inactive user credentials → **Expected:** "Account is inactive" error
- [ ] Leave email blank and submit → **Expected:** Validation error on email field
- [ ] After login, check browser localStorage for `auth_token` key (NOT `token`)

### 2.2 Force Password Change

- [ ] Log in with a user who has `mustChangePassword: true` (new user with default `Welcome@CRM1` password)
- [ ] **Expected:** Redirected to change-password flow before accessing dashboard
- [ ] After changing, log in again → **Expected:** Normal dashboard access

### 2.3 SSO Login (hybrid/sso mode only)

- [ ] Click "Login with Microsoft" on the `/login` page
- [ ] Complete Microsoft Entra authentication
- [ ] **Expected:** Redirected to dashboard; JWT issued via backend `/api/auth/sso/callback`
- [ ] Confirm the returned token contains correct `email`, `roleId`, and `permissions`

### 2.4 Multi-Role User — Role Switching

- [ ] Log in as a user assigned multiple roles (e.g., Sales + Manager)
- [ ] **Expected:** Role switcher visible in the header/user menu
- [ ] Switch roles → **Expected:** Permissions and visible menu items update immediately (no reload)
- [ ] Confirm sidebar items change to reflect the active role's permissions

### 2.5 Session Expiry

- [ ] Log in, then manipulate the JWT in localStorage to be expired (or wait for expiry)
- [ ] Attempt any API call → **Expected:** 401 response, redirect to `/login`

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Permission Gating — UI

| Test | Role | Expected |
|------|------|----------|
| Pipeline edit form visible | Sales | ✅ Editable |
| Pipeline edit form visible | Presales | ❌ Read-only |
| "Move to Presales" button | Sales (creator) | ✅ Visible |
| "Move to Presales" button | Presales user | ❌ Hidden |
| GOM Calculator tab | Presales / Manager | ✅ Visible |
| GOM Calculator tab | Sales only | ❌ Hidden |
| Admin Panel menu item | Sales / Presales | ❌ Hidden |
| Admin Panel menu item | Admin | ✅ Visible |

### 3.2 Assignment Lock Rules

- [ ] As a **Sales** user: on an opportunity past "Negotiation" stage, verify the Sales Rep field is **read-only**
- [ ] As a **non-Admin Sales** user who has done one handoff (`salesRepHandoffs = 1`): verify Sales Rep field is locked
- [ ] As **Admin**: verify Sales Rep field is always editable regardless of handoff count
- [ ] As **Manager**: verify Manager field is editable only in Presales (step 1) and Sales (step 2) tabs, not in Pipeline (step 0)
- [ ] Verify Presales assignment field is editable for Admin, Manager (when assigned), and Presales role

### 3.3 View-Only Modal

- [ ] Log in as a user without edit access to a specific opportunity
- [ ] Open that opportunity → **Expected:** "View Only" badge in the header
- [ ] Click on the badge → **Expected:** Modal explaining why access is read-only

---

## 4. Opportunity Lifecycle — Pipeline Stage

### 4.1 Create a New Opportunity

- [ ] Navigate to `/dashboard/opportunities` → click **"+ New Opportunity"** (or equivalent)
- [ ] Fill in all required fields: Client Name, Project Name, Country, Region, Technology, Start Date, Duration, Pricing Model, Value
- [ ] Submit → **Expected:** Opportunity created, appears in the Kanban board under the correct stage
- [ ] **Add Client inline:** Click "+ Add Client" from the Client dropdown → fill the modal (Name, Contact Person, Contact Email are required)
- [ ] Submit without Contact Person → **Expected:** "Contact person is required" error
- [ ] Submit with invalid email format → **Expected:** Email validation error

### 4.2 Edit Pipeline Fields

- [ ] Open an existing opportunity in Pipeline stage
- [ ] Change Country → **Expected:** Region auto-fills based on country-region mapping; currency updates
- [ ] Change Duration value + unit → **Expected:** Tentative End Date auto-calculates (working days logic for "days" unit, calendar for "weeks"/"months")
- [ ] Set Project Type = "Staffing" and fill Day Rate + Duration → **Expected:** Estimated Value auto-calculates (Day Rate × 20 × duration months)
- [ ] Remove Technology selection and try to submit → **Expected:** "Please select at least one technology" validation error
- [ ] Save → **Expected:** Success toast, data persists after page reload

### 4.3 Kanban Board

- [ ] View pipeline in Kanban mode → cards should show company, value, stage, health status
- [ ] Drag a card from "Discovery" to "Qualification" → **Expected:** Stage updates, card moves
- [ ] Verify cards show correct currency symbol for the opportunity currency

### 4.4 Move to Presales (Transition)

- [ ] As Sales user, click **"Move to Presales"** on a Pipeline-stage opportunity
- [ ] Fill the Presales modal: Proposal Due Date, Manager Name, Comments
- [ ] Set Proposal Due Date > Start Date → **Expected:** Validation error (due date must be before start date)
- [ ] Fill correctly and submit → **Expected:** Opportunity moves to Presales stage; notification sent to assigned Manager; email triggered

### 4.5 Mark as Lost

- [ ] Open any opportunity → click **"Mark as Lost"**
- [ ] Submit without entering Remarks → **Expected:** "Please enter remarks" error
- [ ] Fill remarks and confirm → **Expected:** Opportunity marked "Closed Lost"; badge updates; editing locked
- [ ] **Mark as Stalled (Hold):** Click hold toggle → **Expected:** "On Hold" badge; form fields locked

---

## 5. Opportunity Lifecycle — Presales Stage

### 5.1 Tab Navigation

- [ ] As Presales/Manager user, open a Presales-stage opportunity
- [ ] Verify tabs visible: **Project Details, Schedule, Resource Assignment, GOM Calculator, View Estimate**
- [ ] As Sales-only user: verify GOM Calculator and Resource Assignment tabs are hidden

### 5.2 Project Details Tab

- [ ] Edit practice, technology, description fields → save → **Expected:** Persists correctly
- [ ] Verify Pipeline fields (client, value, region) are read-only in this tab for non-pipeline-edit users

### 5.3 Schedule Tab

- [ ] Verify start date and duration auto-populate from pipeline data
- [ ] Adjust start date → **Expected:** End date auto-recalculates

### 5.4 Presales — Auto-Save

- [ ] Make a change in the estimation/resource fields
- [ ] Wait for auto-save interval (default 2 minutes) → **Expected:** Data saved without manual action, no interruption to the user

### 5.5 Assign Presales Team

- [ ] As Manager, click **"Assign Presales Team"**
- [ ] Modal opens and lists available Presales users filtered by department
- [ ] Select one or more → **Expected:** Assignment saved; "Presales Assignee" field updates
- [ ] Verify Presales users cannot edit the assignee list (read-only for non-managers)

### 5.6 Estimation Submitted → Re-estimate Flow

- [ ] As Presales, complete estimation and click **"Submit Estimation"**
- [ ] **Expected:** `detailedStatus` changes to "Estimation Submitted"; banner appears
- [ ] As Manager, click **"Send for Re-estimate"** → enter comment → submit
- [ ] **Expected:** `detailedStatus` = "Sent for Re-estimate"; Presales sees the re-estimate banner

---

## 6. GOM Calculator

### 6.1 Basic Calculation

- [ ] Navigate to GOM Calculator tab on a Presales opportunity
- [ ] Enter Annual CTC, Delivery Mgmt %, Bench Cost %, Exchange Rate
- [ ] **Expected:** Adjusted Cost, Offshore Day Rate, Onsite Day Rate auto-calculate
- [ ] Formula verification:
  - `Adjusted Cost = CTC × (1 + (DeliveryMgmt + BenchCost) / 100)`
  - `Offshore Day Rate = ceil(AdjustedCost / ExchangeRate / 220)`
  - `Onsite Day Rate = Offshore Day Rate + (PerDiemUSD × PerDiemRate) + OnsiteAllowance`

### 6.2 Working Days — Consistency Check

- [ ] Open the GOM Calculator for an opportunity with a start date set
- [ ] Change duration in the Pipeline/Schedule tab → **Expected:** Working Days in GOM auto-updates
- [ ] Verify the GOM Calculator Admin page (Settings) uses the **same working days per year** (220) as the Resource Assignment cost calculation
- [ ] Admin Settings → Budget Assumptions → `workingDaysPerYear` should be **220**

### 6.3 GOM Percent Display

- [ ] After calculating GOM, note the **GOM % shown** in the header banner
- [ ] **Expected:** This matches the GOM % shown in the estimation summary

### 6.4 Re-estimation Context

- [ ] As Sales, use **"Send for Re-estimate"** with a suggested revenue figure
- [ ] As Presales, open GOM calculator → **Expected:** A "Projected Revenue (Suggested)" tile shows the Sales-suggested value as reference only
- [ ] Verify the suggested value does NOT change the actual GOM calculation until manually applied

### 6.5 Save Estimation

- [ ] Click **Save** in the GOM Calculator
- [ ] **Expected:** `finalRevenue` and `totalRevenue` saved to `presalesData`; success toast
- [ ] Reload the page → **Expected:** Values persist

---

## 7. GOM Approval Workflow

### 7.1 Auto-Approval (Above Threshold)

- [ ] Set `gomAutoApprovePercent` in Admin → Budget Assumptions (e.g., 30%)
- [ ] Calculate a GOM that exceeds 30% → **Expected:** "GOM Auto-Approved" shown without requiring manager action
- [ ] **Move to Sales** button becomes available

### 7.2 Manual Approval Request

- [ ] Calculate a GOM below the auto-approve threshold but above `minGomPercent`
- [ ] Click **"Request GOM Approval"** → **Expected:** Approval request created; Manager gets notification
- [ ] As Manager, open the opportunity → **Expected:** Approve/Reject buttons visible
- [ ] Approve → **Expected:** `gomApproved = true`; banner updates; "Move to Sales" unlocked

### 7.3 GOM Threshold Gate

- [ ] Set `minGomPercent` in Admin → Budget Assumptions (e.g., 20%)
- [ ] Attempt "Move to Sales" with GOM% below 20% and NOT approved → **Expected:** Error toast "GOM is below minimum threshold"
- [ ] Attempt with GOM approved (manual) → **Expected:** Move proceeds regardless of threshold

### 7.4 Move to Sales

- [ ] With GOM approved (auto or manual), click **"Move to Sales"**
- [ ] **Expected:** Opportunity moves to Sales stage (step 2); Sales user gets notification; email triggered

---

## 8. Opportunity Lifecycle — Sales & SOW Stage

### 8.1 Sales Stage View

- [ ] Open a Sales-stage opportunity as a Sales user
- [ ] **Expected:** Pipeline and Presales data visible in collapsible read-only sections
- [ ] **Expected:** Sales-specific fields editable (final deal terms, contract value)

### 8.2 Mark Proposal Sent

- [ ] As Sales/Manager on a Sales-stage opportunity, click **"Mark Proposal Sent"**
- [ ] **Expected:**
  - Stage moves to "Negotiation"
  - `presalesData.finalRevenue` is written with the GOM context revenue (NOT the pipeline estimate value)
  - Email notification sent with correct "Proposed Value" = GOM quote price
- [ ] **Verify email content:** The "Proposed Value" in the email should match the GOM Calculator's computed revenue, not the original opportunity value

### 8.3 SOW Studio

- [ ] Move to SOW step (step 3)
- [ ] **Expected:** SOW editor opens (SowStudio component)
- [ ] Create/edit SOW content → save → **Expected:** Persists on reload

### 8.4 Mark Closed Won / Closed Lost

- [ ] From Sales stage, click **"Mark as Closed Won"** → **Expected:** Stage = "Closed Won"; deal locked; project conversion prompt
- [ ] From Sales stage, click **"Mark as Closed Lost"** with remarks → **Expected:** Stage = "Closed Lost"; editing locked

---

## 9. Notification System

### 9.1 In-App Notifications Bell

- [ ] After a stage transition (e.g., Pipeline → Presales), log in as the newly assigned Manager
- [ ] **Expected:** Bell icon shows unread count badge
- [ ] Click bell → dropdown shows the notification with correct message and timestamp
- [ ] Click the notification → **Expected:** Navigates to the relevant opportunity
- [ ] Mark as read → **Expected:** Badge count decrements

### 9.2 Notification Rules (Admin)

- [ ] Admin → Notifications → Rules
- [ ] Create a rule for "Stage Change: Pipeline → Presales" targeting "Manager" role
- [ ] Trigger a Pipeline → Presales move → **Expected:** Notification delivered to the assigned manager

### 9.3 Notification Triggers to Test

| Trigger | Expected Recipients |
|---------|-------------------|
| New opportunity created | Sales user (creator confirmed) |
| Move to Presales | Assigned Manager |
| Estimation submitted | Manager |
| GOM approval requested | Manager |
| GOM approved | Presales assignee |
| Move to Sales | Assigned Sales user |
| Proposal sent | Relevant stakeholders |
| Closed Won / Lost | Manager, Sales |

---

## 10. Email Notifications & Templates

### 10.1 SMTP Configuration

- [ ] Admin → Email Settings → verify SMTP config (host, port, user, from address)
- [ ] Send test email → **Expected:** Email received in inbox

### 10.2 Proposal Sent Email — Proposed Value *(regression for fix in ce83102)*

- [ ] Create an opportunity with a **pipeline estimate value** (e.g., ₹5,00,000)
- [ ] Complete GOM estimation with a **different final quote** (e.g., ₹8,20,000 from GOM calculator)
- [ ] Save the GOM estimation
- [ ] Click **"Mark Proposal Sent"** on the Sales stage
- [ ] Check the email received by the client/stakeholder
- [ ] **Expected:** "Proposed Value" in the email = ₹8,20,000 (GOM quote), **NOT** ₹5,00,000 (pipeline estimate)

### 10.3 Currency Variable in Email *(regression for fix 21.10)*

- [ ] Create an opportunity with USD currency and value `500000`
- [ ] Trigger the "New Opportunity" notification email
- [ ] **Expected:** Email shows `$500,000` or equivalent — NOT `500000` (bare number without symbol)

### 10.4 Email Template Variables

Test that these merge variables resolve correctly in templates:

| Variable | Expected Value |
|----------|---------------|
| `{{opportunity.clientName}}` | Client company name |
| `{{opportunity.value}}` | Formatted numeric value |
| `{{opportunity.currency}}` | Currency code (USD, INR, etc.) |
| `{{calc:proposedValue}}` | GOM final revenue (priority: `finalRevenue → totalRevenue → gomSummary.totalRevenue → value`) |
| `{{opportunity.stage}}` | Current stage name |
| `{{user.name}}` | Assigned user name |

---

## 11. Client & Contact Management

### 11.1 Create Client (from Opportunity form)

- [ ] In the opportunity create/edit form, click **"+ Add Client"**
- [ ] Leave **Client Name** blank → submit → **Expected:** "Client name is required" error
- [ ] Leave **Contact Person** blank → submit → **Expected:** "Contact person is required" error
- [ ] Leave **Contact Email** blank → submit → **Expected:** "Contact email is required" error
- [ ] Enter invalid email format → **Expected:** Email format validation error
- [ ] Fill all fields correctly → submit → **Expected:** Client created, appears in the Client dropdown

### 11.2 Client List (Admin)

- [ ] Admin → Clients → **Expected:** List of all clients with contact info
- [ ] Search by client name → **Expected:** Filtered results
- [ ] Edit client → **Expected:** Changes persist

---

## 12. Attachments & File Management

### 12.1 Upload Attachment

- [ ] Open a Presales-stage opportunity (as Presales or Manager with edit access)
- [ ] In the Attachments section, click **Upload** and select a PDF or image
- [ ] **Expected:** File appears in the attachment list with name, size, upload date

### 12.2 Download Attachment

- [ ] Click **Download** on an uploaded attachment
- [ ] **Expected:** File downloads successfully (authenticated request with JWT; no 401)

### 12.3 Delete Attachment

- [ ] Click **Delete** on an attachment (as a user with attachment edit access)
- [ ] **Expected:** Confirmation prompt; on confirm, file removed from list

### 12.4 Access Control on Attachments

- [ ] Log in as a user WITHOUT attachment edit permission
- [ ] **Expected:** Upload and Delete buttons are hidden/disabled

---

## 13. Currency Management

### 13.1 Global Currency Switcher

- [ ] In the dashboard header, switch currency from INR to USD
- [ ] **Expected:** All opportunity values on the list re-display in USD using the stored exchange rates
- [ ] Switch back to INR → **Expected:** Values revert correctly (no rounding accumulation)

### 13.2 Opportunity-Level Currency

- [ ] Create an opportunity with Country = "United States" → **Expected:** Currency auto-sets to USD
- [ ] Create an opportunity with Country = "India" → **Expected:** Currency auto-sets to INR
- [ ] **Expected:** The opportunity stores values in its own currency; global switcher converts for display only

### 13.3 Exchange Rate in GOM

- [ ] Open GOM Calculator on an INR opportunity
- [ ] Change Exchange Rate to 83 (USD to INR)
- [ ] **Expected:** Cost-per-day and revenue recalculate using the new rate

### 13.4 Presales Data Currency Conversion

- [ ] Save GOM data in INR for an opportunity
- [ ] Switch global display currency to USD
- [ ] Open opportunity → Estimation Summary → **Expected:** Values shown in USD using exchange rate snapshot

---

## 14. Rate Cards & Cost Management

### 14.1 Admin — Rate Card Management

- [ ] Admin → Rate Cards → **Expected:** Grid of skill levels × experience bands with CTC values
- [ ] Edit a rate → save → **Expected:** New rate appears immediately
- [ ] Verify the updated rate is reflected in GOM calculator when that resource type is selected

### 14.2 Resource Assignment — Rate Lookup

- [ ] In the Resource Assignment tab (GOM/Presales), select a role (e.g., ".NET Developer") and experience band ("15+ years")
- [ ] **Expected:** Annual CTC auto-fills from the rate card

### 14.3 Working Days Consistency

- [ ] Admin → Budget Assumptions → confirm `workingDaysPerYear = 220`
- [ ] Resource Assignment: for a .NET Developer (15+ years, 10 days), note the calculated cost
- [ ] Admin GOM Calculator: use same resource → **Expected:** Same daily rate (CTC ÷ 220 working days) *(regression for fix 21.9)*

---

## 15. Admin Panel

### 15.1 User Management

- [ ] Admin → Users → Create new user with a role (Sales)
- [ ] **Expected:** User appears in list; can log in with default password `Welcome@CRM1` and `mustChangePassword = true`
- [ ] Deactivate the user → **Expected:** User cannot log in ("Account is inactive")
- [ ] Assign multiple roles → **Expected:** User sees role switcher on login

### 15.2 Role & Permission Management

- [ ] Admin → Roles → Create new role with custom permissions
- [ ] Assign the role to a user → **Expected:** User's UI reflects only the new role's permissions

### 15.3 Budget Assumptions

- [ ] Admin → System Config → Budget Assumptions
- [ ] Change `workingDaysPerYear` → **Expected:** GOM calculations update immediately
- [ ] Change `minGomPercent` → **Expected:** "Move to Sales" gate updates
- [ ] Change `gomAutoApprovePercent` → **Expected:** Auto-approval threshold updates

### 15.4 Auth Mode Toggle

- [ ] Admin → System Config → Auth Mode
- [ ] Switch to `local` → **Expected:** SSO button hidden on login page
- [ ] Switch to `sso` → **Expected:** Password fields hidden; only Microsoft login shown
- [ ] Switch to `hybrid` → **Expected:** Both login methods available

### 15.5 Notification Rules

- [ ] Admin → Notifications → Create a new rule (e.g., alert Sales when deal closes)
- [ ] Trigger the event → **Expected:** In-app notification fires for the correct users

---

## 16. AI Chatbot

### 16.1 Open Chatbot

- [ ] Click the chatbot icon in the dashboard
- [ ] **Expected:** Chat panel opens

### 16.2 Natural Language Query

- [ ] Type: "Show me all opportunities in the Presales stage"
- [ ] **Expected:** Chatbot returns a list of matching opportunities

- [ ] Type: "What is the total pipeline value for Q1 2026?"
- [ ] **Expected:** Chatbot returns a computed/estimated answer from the data

### 16.3 Context-Aware Response

- [ ] Open a specific opportunity, then open the chatbot
- [ ] Ask: "Summarize this opportunity"
- [ ] **Expected:** Response references the current opportunity's data

---

## 17. Analytics & Reporting

### 17.1 Dashboard Metrics

- [ ] Navigate to `/dashboard`
- [ ] **Expected:** Cards showing total pipeline value, active opportunities count, win rate, average deal size
- [ ] Metrics should update if a new opportunity is created (may need page refresh)

### 17.2 Pipeline by Stage Chart

- [ ] **Expected:** Bar/funnel chart showing count and value by stage (Discovery → Closed Won)
- [ ] Click a stage bar → **Expected:** Navigates to filtered opportunities list for that stage

### 17.3 Reports — Filters

- [ ] Navigate to Reports (if available)
- [ ] Filter by: Date range, Region, Salesperson, Stage
- [ ] **Expected:** Data updates to match filters

---

## 18. Audit Logging

### 18.1 Audit Trail (Admin)

- [ ] Admin → Audit Logs
- [ ] Perform an action (e.g., stage transition) then check audit log
- [ ] **Expected:** Entry shows: timestamp, user, action type, entity (opportunity ID), old/new values

### 18.2 Audit Events to Verify

| Action | Expected Audit Entry |
|--------|---------------------|
| Login | `AUTH_LOGIN` with userId, timestamp |
| Create opportunity | `OPPORTUNITY_CREATED` with initial data |
| Stage change | `STAGE_CHANGED` with old stage, new stage |
| GOM save | `GOM_SAVED` with finalRevenue |
| GOM approval | `GOM_APPROVED` / `GOM_REJECTED` |
| User deactivated | `USER_DEACTIVATED` |

---

## 19. Deal-to-Project Conversion

### 19.1 Convert Closed Won to Project

- [ ] Close an opportunity as "Closed Won" from the Sales stage
- [ ] **Expected:** Prompt or button to "Convert to Project"
- [ ] Confirm conversion → **Expected:**
  - Project record created with budget = opportunity value
  - Project linked to the opportunity
  - Step 4 (Project tab) becomes active and visible

### 19.2 Project Tab

- [ ] Navigate to the Project step (step 4) of a converted opportunity
- [ ] **Expected:** Project details panel shows — project name, budget, start date, linked milestones

---

## 20. May 2026 Fixes — Regression Checklist

Use this section after every deployment to confirm recent fixes haven't regressed.

### 20.1 Proposal Email — Correct Proposed Value *(ce83102)*

- [ ] Create opportunity with estimate = ₹5,00,000
- [ ] GOM quote via calculator = ₹8,50,000 → save estimation
- [ ] Mark Proposal Sent → **Expected email value:** ₹8,50,000 (not ₹5,00,000)

### 20.2 Email — Currency Symbol Present *(21.10)*

- [ ] Create USD opportunity, trigger "New Opportunity" email
- [ ] **Expected:** Email shows `$` symbol, not bare number

### 20.3 Add Client — Required Fields *(56b5afe)*

- [ ] In the Add Client modal:
  - [ ] Blank Contact Person → error on submit
  - [ ] Blank Contact Email → error on submit  
  - [ ] Invalid email format → error on submit
  - [ ] Valid email typed correctly (no blur required before submit is triggered)

### 20.4 Working Days Consistency *(21.9)*

- [ ] Admin GOM Calculator: .NET Developer, 15+ years
- [ ] Resource Assignment tab: same resource
- [ ] **Expected:** Daily rates match (both use `workingDaysPerYear = 220`)

### 20.5 Presales Assignment Modal — Auth Token *(21.8)*

- [ ] As Manager, open "Assign Presales Team" modal
- [ ] **Expected:** Presales user list loads (no "No presales team members found" error)
- [ ] The API call uses `auth_token` key from localStorage (not `token`)

### 20.6 GOM — Projected Revenue Tile *(0ba98a5)*

- [ ] As Sales, send opportunity for re-estimate with a suggested revenue
- [ ] As Presales, open GOM Calculator → **Expected:** "Projected Revenue (Suggested)" tile shows Sales' value as reference
- [ ] Verify this does NOT change the GOM calculation until Presales applies it

### 20.7 Banner — Re-estimation Status Cleared on Proposal Sent *(5bb52ba)*

- [ ] Complete re-estimation flow → status banner shows "Estimation Submitted"
- [ ] Click "Mark Proposal Sent" → **Expected:** Re-estimation banner disappears (status cleared)

### 20.8 Currency in Opportunity List Tooltip *(bf73be1)*

- [ ] In the opportunities list, hover over a value cell with non-INR currency
- [ ] **Expected:** Tooltip shows currency-specific value (not always INR default)

### 20.9 Move-to-Sales Gate *(bf73be1)*

- [ ] On a Presales opportunity with approved GOM, click "Move to Sales"
- [ ] **Expected:** Proceeds without error (backend gate respects GOM approval state)

### 20.10 Final Quote Tiles — Sales View *(bf73be1)*

- [ ] Open Sales-stage opportunity → Presales summary section
- [ ] **Expected:** "Final Quote" tile shows `finalRevenue` value, not the pipeline estimate

---

## Appendix — Quick Smoke Test (5 minutes)

Run this after every deployment to confirm the system is alive:

```
1. [ ] Login as admin → dashboard loads
2. [ ] Login as sales → create a test opportunity → submit
3. [ ] Move to Presales → confirm notification appears for manager
4. [ ] Login as manager → open the opportunity → GOM Calculator loads
5. [ ] Save GOM estimation → "Move to Sales" available
6. [ ] Mark Proposal Sent → confirm stage = "Negotiation"
7. [ ] Check email inbox → proposal email received with correct value
8. [ ] Admin → Audit Logs → confirm events logged
9. [ ] PM2 status on VM: pm2 list → all processes "online"
10. [ ] curl https://qcrm.qbadvisory.com/ → 307 redirect (not 502)
```
