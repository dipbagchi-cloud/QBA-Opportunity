# Q-CRM Opportunity Workflow - Functional Specification

## Document Info
- **Version:** 1.0
- **Date:** March 29, 2026
- **Purpose:** Comprehensive functional specification for Selenium UI testing

---

## 1. Opportunity Lifecycle Overview

### 1.1 Pipeline Stages

| Stage | Order | Probability | Description | Terminal |
|-------|-------|-------------|-------------|----------|
| Discovery | 1 | 10% | Initial opportunity capture | No |
| Qualification | 2 | 30% | Presales estimation & GOM | No |
| Proposal | 3 | 50% | Sales proposal submitted | No |
| Negotiation | 4 | 80% | Active negotiation | No |
| Closed Won | 5 | 100% | Deal won, convert to project | Yes |
| Closed Lost | 6 | 0% | Deal lost during sales | Yes |
| Proposal Lost | 7 | 0% | Deal lost during presales | Yes |

### 1.2 Stage Transition Rules

```
Discovery → Qualification (Move to Presales)
Qualification → Proposal (Move to Sales) ** REQUIRES GOM APPROVAL **
Qualification → Proposal Lost (Mark as Lost)
Proposal → Negotiation (Proposal Sent)
Proposal → Qualification (Send Back for Re-estimate)
Proposal → Closed Lost (Mark as Lost)
Negotiation → Closed Won (Convert to Project)
Negotiation → Qualification (Send Back for Re-estimate)
Negotiation → Closed Lost (Mark as Lost)
```

---

## 2. Test Scenarios

### 2.1 Authentication Tests (PRE-REQUISITE)
| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| AUTH-01 | Login with valid credentials | Redirect to /dashboard |
| AUTH-02 | Login with invalid credentials | Error message displayed |
| AUTH-03 | Access protected route without login | Redirect to /login |
| AUTH-04 | Logout functionality | Redirect to /login, session cleared |

### 2.2 Opportunity List Page Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| LIST-01 | List page loads | Navigate to /dashboard/opportunities | Page loads with opportunities grid/kanban |
| LIST-02 | Search functionality | Enter search term in search box | Results filtered by name/client/owner |
| LIST-03 | Stage filter dropdown | Select stage from dropdown | Only opportunities in that stage shown |
| LIST-04 | Pagination | Click page numbers | Page content changes |
| LIST-05 | Sort by column | Click column header | Data sorted ascending/descending |
| LIST-06 | Toggle List/Kanban view | Click view toggle button | View switches between list and kanban |
| LIST-07 | Click opportunity row | Click on an opportunity | Navigate to detail page |
| LIST-08 | Create new opportunity button | Click "+ New" or "Create" button | Navigate to /dashboard/opportunities/new |

### 2.3 Kanban Board Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| KAN-01 | Kanban columns display | View kanban board | All 7 stage columns visible |
| KAN-02 | Opportunity cards display | View kanban board | Cards show name, client, value, stage |
| KAN-03 | Drag card to next stage | Drag Discovery card to Qualification | Card moves, stage updates |
| KAN-04 | Drag to Proposal without GOM | Drag Qualification card to Proposal | Error: GOM approval required |
| KAN-05 | Card click navigation | Click opportunity card | Navigate to detail page |
| KAN-06 | Stalled opportunity indicator | View card >30 days in stage | Amber border/badge visible |

### 2.4 Create Opportunity Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CREATE-01 | New opportunity form loads | Navigate to /dashboard/opportunities/new | Form with all fields displayed |
| CREATE-02 | Required fields validation | Submit form without required fields | Validation errors shown |
| CREATE-03 | Create with all required fields | Fill: Client, Region, Project Type, Name, Technology, Start Date, Sales Rep | Opportunity created in Discovery |
| CREATE-04 | Staffing type auto-calculates value | Select Project Type = Staffing, enter Day Rate | Value auto-calculated |
| CREATE-05 | Duration auto-calculates end date | Enter Start Date + Duration | End Date auto-calculated |
| CREATE-06 | Technology multi-select | Click tech dropdown, select multiple | Multiple technologies selected |
| CREATE-07 | Client autocomplete | Type client name | Suggestions appear, can select or create new |
| CREATE-08 | Attachment upload on create | Upload file during creation | File attached to new opportunity |

### 2.5 Opportunity Detail Page Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| DETAIL-01 | Detail page loads | Navigate to /dashboard/opportunities/{id} | Page loads with stepper navigation |
| DETAIL-02 | Stepper shows 4 steps | View stepper | Pipeline, Presales, Sales, Project steps |
| DETAIL-03 | Current step highlighted | View stepper | Active step has different styling |
| DETAIL-04 | Edit fields in Discovery | Edit any field in Discovery stage | Changes saved |
| DETAIL-05 | Comments panel | View comments section | Comments list with add form |
| DETAIL-06 | Add comment | Enter text, click Add | Comment appears in list |
| DETAIL-07 | Audit log tab | Click Audit Log tab | History of all changes shown |
| DETAIL-08 | Attachment upload | Upload file in detail page | File appears in attachments list |
| DETAIL-09 | Attachment download | Click download button | File downloads |
| DETAIL-10 | Attachment delete | Click delete, confirm | File removed from list |

### 2.6 Stage Transition: Discovery → Qualification (Presales)
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| TRANS-01 | Move to Presales button visible | View Discovery opportunity | "Move to Presales" button visible |
| TRANS-02 | Click Move to Presales | Click button | Modal appears with Manager, Due Date fields |
| TRANS-03 | Submit without manager | Click Submit without manager | Validation error |
| TRANS-04 | Submit with required fields | Select Manager, Due Date, click Submit | Stage changes to Qualification |
| TRANS-05 | Stepper updates | After move to Presales | Presales step now current |
| TRANS-06 | Audit log records transition | Check audit log | STAGE_CHANGE entry visible |

### 2.7 GOM Calculator & Approval Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| GOM-01 | GOM Calculator tab visible | In Qualification stage | GOM Calculator tab available |
| GOM-02 | Enter GOM inputs | Enter CTC, Markup, Day Rate, Duration | Calculations update in real-time |
| GOM-03 | GOM outputs display | After entering inputs | Shows GOM %, Profit %, Revenue |
| GOM-04 | Auto-approve high GOM | GOM >= threshold (e.g., 25%) | "GOM Approved" status shown |
| GOM-05 | Manual approval low GOM | GOM < threshold | "Request Approval" button appears |
| GOM-06 | Request GOM approval | Click Request Approval | Status shows "Pending Approval" |
| GOM-07 | Move to Sales disabled | GOM not approved | "Move to Sales" button disabled |
| GOM-08 | Move to Sales enabled | GOM approved | "Move to Sales" button enabled |

### 2.8 Stage Transition: Qualification → Proposal (Sales)
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| TRANS-07 | Move to Sales blocked without GOM | Click Move to Sales (GOM not approved) | Error: GOM must be approved |
| TRANS-08 | Move to Sales with GOM | GOM approved, click Move to Sales | Stage changes to Proposal |
| TRANS-09 | Sales step in stepper | After move | Sales step highlighted |
| TRANS-10 | Pipeline/Presales data visible | In Sales step | Previous stage data shown read-only |

### 2.9 Stage Transition: Proposal → Negotiation
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| TRANS-11 | Proposal Sent button visible | In Proposal stage | "Proposal Sent" button visible |
| TRANS-12 | Click Proposal Sent | Click button | Stage changes to Negotiation |
| TRANS-13 | Negotiation actions visible | In Negotiation stage | Convert, Mark Lost, Re-estimate buttons |

### 2.10 Send Back for Re-Estimate Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| REEST-01 | Re-estimate button in Proposal | In Proposal stage | "Send Back for Re-estimate" button |
| REEST-02 | Re-estimate button in Negotiation | In Negotiation stage | "Send Back for Re-estimate" button |
| REEST-03 | Click re-estimate opens modal | Click button | Modal with comment field appears |
| REEST-04 | Submit without comment | Click Submit without comment | Validation error |
| REEST-05 | Submit with comment | Enter comment, click Submit | Stage returns to Qualification |
| REEST-06 | GOM reset after re-estimate | After re-estimate | gomApproved = false, must re-approve |
| REEST-07 | Re-estimate count increments | Check detail | reEstimateCount increased |
| REEST-08 | Audit log shows re-estimate | Check audit log | SEND_BACK_REESTIMATE entry |

### 2.11 Mark as Lost Tests
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| LOST-01 | Mark as Lost in Qualification | Click "Proposal Lost" button | Modal opens |
| LOST-02 | Mark as Lost in Proposal | Click "Proposal Lost" button | Modal opens |
| LOST-03 | Mark as Lost in Negotiation | Click "Mark as Lost" button | Modal opens |
| LOST-04 | Lost remarks required | Submit without remarks | Validation error |
| LOST-05 | Submit lost with remarks | Enter remarks, submit | Stage = Closed Lost or Proposal Lost |
| LOST-06 | Lost opportunity locked | After marking lost | No action buttons, opportunity frozen |
| LOST-07 | Audit log shows lost | Check audit log | MARK_LOST entry with remarks |

### 2.12 Convert to Project (Closed Won)
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CONV-01 | Convert button in Negotiation | In Negotiation stage | "Move to Project" or "Convert" button |
| CONV-02 | Click convert | Click button | Confirmation or form appears |
| CONV-03 | Confirm conversion | Confirm action | Stage = Closed Won, Project created |
| CONV-04 | Project step visible | After conversion | Project step in stepper active |
| CONV-05 | Opportunity locked after conversion | After conversion | No further stage changes allowed |
| CONV-06 | Audit log shows conversion | Check audit log | CONVERT_TO_PROJECT entry |

### 2.13 Complete Happy Path (End-to-End)
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| E2E-01 | Full lifecycle | Create → Move to Presales → GOM → Sales → Proposal Sent → Convert | All stages traversed, Project created |

### 2.14 Negative Test Cases
| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| NEG-01 | Create without client | Submit form without client | Validation error |
| NEG-02 | Move to Sales without GOM | Attempt via API or drag | Blocked with error |
| NEG-03 | Invalid stage transition | Try Discovery → Negotiation directly | Not allowed |
| NEG-04 | Access non-existent opportunity | Navigate to /opportunities/invalid-id | 404 or error page |
| NEG-05 | Unauthorized access | Access without login | Redirect to login |

---

## 3. UI Element Locators

### 3.1 Login Page
- Email input: `input[type='email']`, `input[name='email']`
- Password input: `input[type='password']`
- Login button: `button[type='submit']`
- Error message: `.error`, `[role='alert']`, `text*='error'`

### 3.2 Opportunities List Page
- Page container: URL contains `/dashboard/opportunities`
- Search input: `input[placeholder*='search' i]`, `input[type='search']`
- Stage filter: `select`, `[class*='filter']`, `[class*='dropdown']`
- Create button: `button:has-text('Create')`, `button:has-text('New')`, `a[href*='/new']`
- View toggle: `button:has-text('List')`, `button:has-text('Kanban')`
- Opportunity rows: `tr`, `[class*='card']`, `[class*='opportunity']`
- Pagination: `button[class*='page']`, `nav[aria-label='pagination']`

### 3.3 Kanban Board
- Kanban container: `[class*='kanban']`, `[class*='board']`
- Stage columns: `[class*='column']`, `[class*='stage']`
- Opportunity cards: `[class*='card']`, `[draggable='true']`
- Card title: `.card h3`, `.card-title`, `[class*='opportunity-name']`
- Card value: `[class*='value']`

### 3.4 Opportunity Detail Page
- Stepper: `[class*='stepper']`, `[class*='steps']`, `nav[class*='step']`
- Step items: `[class*='step']`, `button[class*='step']`
- Action buttons:
  - Move to Presales: `button:has-text('Move to Presales')`, `button:has-text('Presales')`
  - Move to Sales: `button:has-text('Move to Sales')`, `button:has-text('Sales')`
  - Proposal Sent: `button:has-text('Proposal Sent')`
  - Mark as Lost: `button:has-text('Lost')`, `button:has-text('Mark as Lost')`
  - Re-estimate: `button:has-text('Re-estimate')`, `button:has-text('Send Back')`
  - Convert: `button:has-text('Convert')`, `button:has-text('Project')`
- Comments section: `[class*='comment']`, `textarea`, `#comment`
- Add comment button: `button:has-text('Add Comment')`, `button:has-text('Post')`
- Attachments: `input[type='file']`, `button:has-text('Upload')`
- Audit log tab: `button:has-text('Audit')`, `[class*='tab']:has-text('Audit')`

### 3.5 Modals
- Modal container: `[role='dialog']`, `[class*='modal']`, `[class*='dialog']`
- Modal title: `[class*='modal-title']`, `h2`, `h3`
- Modal inputs: `input`, `select`, `textarea`
- Submit button: `button[type='submit']`, `button:has-text('Submit')`, `button:has-text('Confirm')`
- Cancel button: `button:has-text('Cancel')`, `button:has-text('Close')`

### 3.6 Forms (Create/Edit)
- Client field: `input[name='client']`, `[class*='client']`, `select[name='client']`
- Region field: `select[name='region']`, `[class*='region']`
- Project Type: `select[name='projectType']`
- Project Name: `input[name='projectName']`, `input[name='title']`
- Technology: `[class*='technology']`, `[class*='multi-select']`
- Sales Rep: `select[name='salesRep']`, `[class*='sales-rep']`
- Start Date: `input[type='date'][name*='start']`, `[class*='start-date']`
- Duration: `input[name='duration']`
- Duration Unit: `select[name='durationUnit']`
- Day Rate: `input[name='dayRate']`, `input[name='expectedDayRate']`
- Value: `input[name='value']`
- Save button: `button:has-text('Save')`, `button[type='submit']`

### 3.7 GOM Calculator
- GOM tab: `button:has-text('GOM')`, `[class*='tab']:has-text('GOM')`
- CTC input: `input[name='annualCtc']`
- Markup input: `input[name='markup']`
- GOM % output: `[class*='gom-percent']`, `text*='GOM'`
- Approve button: `button:has-text('Approve GOM')`, `button:has-text('Approve')`
- Request Approval: `button:has-text('Request Approval')`

---

## 4. Test Data

### 4.1 Valid Test User
```
Email: dip.bagchi@example.com
Password: password123
```

### 4.2 Sample Opportunity Data
```json
{
  "clientName": "Test Client Selenium",
  "region": "UK",
  "projectType": "New Development",
  "projectName": "Selenium Test Project",
  "technology": ".NET, React",
  "tentativeStartDate": "2026-04-15",
  "duration": 6,
  "durationUnit": "months",
  "salesRep": "Test Sales Rep",
  "value": 250000,
  "description": "Test opportunity created by Selenium"
}
```

### 4.3 Staffing Project Data
```json
{
  "projectType": "Staffing",
  "expectedDayRate": 500,
  "duration": 3,
  "durationUnit": "months"
}
// Value auto-calculated: 500 × 20 × 3 = 30,000
```

---

## 5. Test Execution Order

### 5.1 Recommended Execution Sequence
1. Authentication tests (AUTH-01 to AUTH-04)
2. List page tests (LIST-01 to LIST-08)
3. Create opportunity tests (CREATE-01 to CREATE-08)
4. Detail page tests (DETAIL-01 to DETAIL-10)
5. Stage transitions in order:
   - Discovery → Qualification (TRANS-01 to TRANS-06)
   - GOM Calculator (GOM-01 to GOM-08)
   - Qualification → Proposal (TRANS-07 to TRANS-10)
   - Proposal → Negotiation (TRANS-11 to TRANS-13)
6. Re-estimate flow (REEST-01 to REEST-08)
7. Mark as Lost flow (LOST-01 to LOST-07)
8. Convert to Project (CONV-01 to CONV-06)
9. End-to-end happy path (E2E-01)
10. Negative tests (NEG-01 to NEG-05)
11. Kanban tests (KAN-01 to KAN-06)

---

## 6. Acceptance Criteria

### 6.1 Pass Criteria
- All critical path tests pass (CREATE, TRANS, GOM, CONV)
- GOM approval gate enforced correctly
- Stage transitions follow defined rules
- Audit log records all changes
- Data persists correctly after each action

### 6.2 Known Limitations
- Drag-and-drop tests may be flaky in headless mode
- GOM auto-approval depends on system threshold configuration
- Some tests require specific master data (clients, regions)

---

## 7. Environment Requirements

- **Frontend URL:** http://20.124.178.41:3000
- **API URL:** http://20.124.178.41:3001/api
- **Browser:** Chrome (latest)
- **Screen Resolution:** 1920x1080 (desktop tests)
- **Mobile Viewport:** 375x812 (mobile tests)
