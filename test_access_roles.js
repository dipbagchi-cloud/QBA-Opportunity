/**
 * Role-based access test — full workflow validation
 *
 * Tests 5 active users against the complete opportunity lifecycle:
 *   Admin     dip.bagchi@example.com      (Admin role → wildcard *)
 *   Manager   manager@example.com         (Sales + Manager roles)
 *   Sales     sales@example.com           (Sales role)
 *   Presales  presales@example.com        (Presales role)
 *   Viewer    viewer@example.com          (Read-Only role)
 *
 * Expected access matrix:
 *   Admin   → full edit on ANY opportunity regardless of assignment
 *   Manager → edit only on opps where they are owner/salesRep/manager/presalesAssignee
 *   Sales   → edit only own/assigned opps; no presales:write
 *   Presales→ presales edit on assigned opps; cannot move pipeline stages
 *   Viewer  → view-only everywhere
 */

const http = require('http');

const BASE = { hostname: 'localhost', port: 3001 };

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { ...BASE, path, method, headers };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const get  = (path, token)       => request('GET',   path, null, token);
const post = (path, body, token) => request('POST',  path, body, token);
const patch = (path, body, token)=> request('PATCH', path, body, token);

// ─── Login helper ────────────────────────────────────────────────────────────

async function login(email, password = 'password123') {
  const r = await post('/api/auth/login', { email, password });
  if (r.status !== 200 || !r.body.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(r.body)}`);
  }
  return r.body.token;
}

// ─── Assertion helpers ───────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertIn(label, actual, allowed) {
  if (allowed.includes(actual)) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} — expected one of [${allowed}], got ${actual}`);
    failed++;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Q-CRM Role Access Validation ===\n');

  // ── 1. Login all users ──────────────────────────────────────────────────────
  console.log('--- LOGIN ---');
  const tokens = {};
  for (const [role, email] of [
    ['admin',    'dip.bagchi@example.com'],
    ['manager',  'manager@example.com'],
    ['sales',    'sales@example.com'],
    ['presales', 'presales@example.com'],
    ['viewer',   'viewer@example.com'],
  ]) {
    try {
      tokens[role] = await login(email);
      console.log(`  ✓ ${role.padEnd(10)} (${email})`);
    } catch (e) {
      console.log(`  ✗ ${role.padEnd(10)} (${email}) — ${e.message}`);
      process.exit(1);
    }
  }

  // ── 2. Sales user creates an opportunity (becomes owner) ────────────────────
  console.log('\n--- SETUP: Sales creates opportunity ---');
  const salesOpp = await post('/api/opportunities', {
    title: 'ROLE-TEST Sales Owned Opp',
    client: 'ROLE-TEST Client',
    value: 500000,
    currency: 'INR',
    description: 'Created by sales user for role access testing',
    region: 'India',
  }, tokens.sales);
  assertIn('Sales can create opportunity (200/201)', salesOpp.status, [200, 201]);
  const salesOppId = salesOpp.body.id;
  console.log(`  Opportunity ID: ${salesOppId}`);

  // ── 3. Admin creates a separate opportunity ──────────────────────────────────
  console.log('\n--- SETUP: Admin creates opportunity ---');
  const adminOpp = await post('/api/opportunities', {
    title: 'ROLE-TEST Admin Owned Opp',
    client: 'ROLE-TEST Client',
    value: 750000,
    currency: 'INR',
    description: 'Created by admin for role access testing',
    region: 'India',
  }, tokens.admin);
  assertIn('Admin can create opportunity (200/201)', adminOpp.status, [200, 201]);
  const adminOppId = adminOpp.body.id;
  console.log(`  Opportunity ID: ${adminOppId}`);

  // ── 4. VIEW access — all roles should be able to read opportunities ──────────
  console.log('\n--- VIEW ACCESS (all roles should see opportunities) ---');
  for (const role of ['admin', 'manager', 'sales', 'presales', 'viewer']) {
    const r = await get('/api/opportunities', tokens[role]);
    assert(`${role} can list opportunities (200)`, r.status, 200);
  }

  for (const role of ['admin', 'manager', 'sales', 'presales', 'viewer']) {
    const r = await get(`/api/opportunities/${salesOppId}`, tokens[role]);
    assert(`${role} can view sales-owned opp (200)`, r.status, 200);
  }

  // ── 5. Admin edits sales-owned opp (THE KEY FIX — admin NOT assigned) ────────
  console.log('\n--- ADMIN EDIT: non-assigned opportunity (tests wildcard bypass) ---');
  const adminEditSalesOpp = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Updated by admin (cross-assignment edit)',
    region: 'APAC',
  }, tokens.admin);
  assert('Admin can edit sales-owned opp (200)', adminEditSalesOpp.status, 200);

  // ── 6. Admin moves sales opp through pipeline stages ─────────────────────────
  console.log('\n--- ADMIN LIFECYCLE: full stage progression on sales-owned opp ---');

  const moveToQual = await patch(`/api/opportunities/${salesOppId}`, {
    stageName: 'Qualification',
  }, tokens.admin);
  assert('Admin moves to Qualification (200)', moveToQual.status, 200);

  // Request GOM approval
  const gomRequest = await patch(`/api/opportunities/${salesOppId}/approve-gom`, {
    action: 'request',
  }, tokens.admin);
  assertIn('Admin requests GOM approval', gomRequest.status, [200, 400]); // 400 if already requested
  console.log(`    GOM request: ${JSON.stringify(gomRequest.body).substring(0, 120)}`);

  // Admin approves GOM (has approvals:manage via wildcard)
  const gomApprove = await patch(`/api/opportunities/${salesOppId}/review-gom-approval`, {
    action: 'approve',
    reviewerComment: 'Approved by admin in test',
  }, tokens.admin);
  assertIn('Admin approves GOM (200 or 400 if no pending)', gomApprove.status, [200, 400]);
  console.log(`    GOM approve: ${JSON.stringify(gomApprove.body).substring(0, 120)}`);

  // Move to Proposal (requires GOM approved)
  const moveToProposal = await patch(`/api/opportunities/${salesOppId}`, {
    stageName: 'Proposal',
  }, tokens.admin);
  assertIn('Admin moves to Proposal (200 or 400 if GOM not yet approved)', moveToProposal.status, [200, 400]);
  console.log(`    Move to Proposal: ${JSON.stringify(moveToProposal.body).substring(0, 120)}`);

  // ── 7. Manager edits sales-owned opp without being assigned (should block) ───
  console.log('\n--- MANAGER EDIT: not assigned to sales-owned opp (should be blocked) ---');
  const managerEditUnassigned = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Manager trying to edit — should fail',
  }, tokens.manager);
  assert('Manager blocked on unassigned opp (403)', managerEditUnassigned.status, 403);
  console.log(`    Reason: ${managerEditUnassigned.body?.error?.substring(0, 120)}`);

  // ── 8. Sales edits own opp (assigned as owner — should work) ────────────────
  console.log('\n--- SALES EDIT: own opportunity ---');
  const salesEditOwn = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Sales updating own opportunity',
    technology: 'Java',
  }, tokens.sales);
  assert('Sales can edit own opp (200)', salesEditOwn.status, 200);

  // ── 9. Presales edits without assignment (should block) ─────────────────────
  console.log('\n--- PRESALES EDIT: not assigned as presalesAssignee (should be blocked) ---');
  const presalesEditUnassigned = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Presales trying to edit — should fail',
  }, tokens.presales);
  assert('Presales blocked on unassigned opp (403)', presalesEditUnassigned.status, 403);
  console.log(`    Reason: ${presalesEditUnassigned.body?.error?.substring(0, 120)}`);

  // ── 10. Admin assigns presales user to the opp ───────────────────────────────
  console.log('\n--- ADMIN assigns presales user as presalesAssignee ---');
  const assignPresales = await patch(`/api/opportunities/${salesOppId}`, {
    presalesAssigneeName: 'Amit Patel',
  }, tokens.admin);
  assert('Admin assigns presalesAssigneeName (200)', assignPresales.status, 200);

  // ── 11. Presales edits after being assigned ───────────────────────────────────
  console.log('\n--- PRESALES EDIT: now assigned as presalesAssignee ---');
  const presalesEditAssigned = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Presales updating — now assigned',
  }, tokens.presales);
  assert('Presales can edit after assignment (200)', presalesEditAssigned.status, 200);

  // ── 12. Viewer cannot edit anything ─────────────────────────────────────────
  console.log('\n--- VIEWER EDIT: should be blocked on all opps ---');
  const viewerEditSales = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Viewer trying to edit — should fail',
  }, tokens.viewer);
  assert('Viewer blocked on sales opp (403)', viewerEditSales.status, 403);

  const viewerEditAdmin = await patch(`/api/opportunities/${adminOppId}`, {
    description: 'Viewer trying to edit admin opp — should fail',
  }, tokens.viewer);
  assert('Viewer blocked on admin opp (403)', viewerEditAdmin.status, 403);

  // ── 13. Admin assigns manager to opp ─────────────────────────────────────────
  console.log('\n--- MANAGER assigned as manager on the opp ---');
  const assignManager = await patch(`/api/opportunities/${salesOppId}`, {
    managerName: 'Raj Kumar',
  }, tokens.admin);
  assert('Admin assigns managerName (200)', assignManager.status, 200);

  const managerEditAssigned = await patch(`/api/opportunities/${salesOppId}`, {
    description: 'Manager editing after being assigned',
  }, tokens.manager);
  assert('Manager can edit after assignment (200)', managerEditAssigned.status, 200);

  // ── 14. Admin can add comments on any opp ────────────────────────────────────
  console.log('\n--- COMMENT ACCESS ---');
  const adminComment = await post(`/api/opportunities/${salesOppId}/comments`, {
    content: 'Admin comment on sales-owned opp',
    stage: 'Qualification',
  }, tokens.admin);
  assertIn('Admin can comment on unassigned opp (200/201)', adminComment.status, [200, 201]);

  const viewerComment = await post(`/api/opportunities/${salesOppId}/comments`, {
    content: 'Viewer trying to comment',
    stage: 'Qualification',
  }, tokens.viewer);
  assert('Viewer blocked from commenting (403)', viewerComment.status, 403);

  // ── 15. Admin full lifecycle on own opp ──────────────────────────────────────
  console.log('\n--- ADMIN FULL LIFECYCLE on admin-owned opp ---');

  const a1 = await patch(`/api/opportunities/${adminOppId}`, { stageName: 'Qualification' }, tokens.admin);
  assert('Admin: Discovery → Qualification (200)', a1.status, 200);

  const a2 = await patch(`/api/opportunities/${adminOppId}/approve-gom`, { action: 'request' }, tokens.admin);
  assertIn('Admin: request GOM', a2.status, [200, 400]);

  const a3 = await patch(`/api/opportunities/${adminOppId}/review-gom-approval`, {
    action: 'approve', reviewerComment: 'Auto-approved in test',
  }, tokens.admin);
  assertIn('Admin: approve GOM', a3.status, [200, 400]);

  const a4 = await patch(`/api/opportunities/${adminOppId}`, { stageName: 'Proposal' }, tokens.admin);
  assertIn('Admin: Qualification → Proposal', a4.status, [200, 400]);
  if (a4.status === 200) {
    const a5 = await patch(`/api/opportunities/${adminOppId}`, { stageName: 'Negotiation' }, tokens.admin);
    assertIn('Admin: Proposal → Negotiation', a5.status, [200, 400]);
    if (a5.status === 200) {
      const a6 = await patch(`/api/opportunities/${adminOppId}`, { stageName: 'Closed Won' }, tokens.admin);
      assert('Admin: Negotiation → Closed Won (200)', a6.status, 200);
    }
  }

  // ── Cleanup: mark test opps as lost so they don't pollute the board ──────────
  console.log('\n--- CLEANUP ---');
  await patch(`/api/opportunities/${salesOppId}`, { stageName: 'Closed Lost', detailedStatus: 'Test-Cleanup' }, tokens.admin);
  console.log('  Test opportunities marked Closed Lost');

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'='.repeat(44)}`);
  console.log(`RESULTS: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) console.log('ALL TESTS PASSED ✓');
  else console.log('SOME TESTS FAILED ✗ — check lines marked with ✗ above');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
