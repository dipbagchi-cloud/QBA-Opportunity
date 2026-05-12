/**
 * Test script for notification engine - validates that resolveAssignedRecipients
 * only returns assigned users (+ all Admins) per notification rules.
 * 
 * Run: cd backend && npx ts-node test-notification-engine.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GLOBAL_ROLES = ['Admin'];

// Replica of resolveAssignedRecipients from notification-engine.ts for testing
async function resolveAssignedRecipients(
  opportunityId: string,
  recipientRoles: string[],
  recipientUsers: Record<string, string[]> | null
) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      ownerId: true,
      owner: { select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } } },
      salesRepName: true,
      managerName: true,
      presalesAssigneeName: true,
    },
  });
  if (!opp) return [];

  const assignedUserIds = new Set<string>();
  const assignedNames: string[] = [];

  if (opp.owner) {
    assignedUserIds.add(opp.owner.id);
  }

  if (opp.salesRepName) assignedNames.push(opp.salesRepName);
  if (opp.managerName) assignedNames.push(opp.managerName);
  if (opp.presalesAssigneeName) assignedNames.push(opp.presalesAssigneeName);

  if (assignedNames.length > 0) {
    const namedUsers = await prisma.user.findMany({
      where: { name: { in: assignedNames }, isActive: true },
      select: { id: true },
    });
    namedUsers.forEach(u => assignedUserIds.add(u.id));
  }

  const globalRoles = recipientRoles.filter(r => GLOBAL_ROLES.includes(r));
  const scopedRoles = recipientRoles.filter(r => !GLOBAL_ROLES.includes(r));

  let allRecipients: any[] = [];
  if (globalRoles.length > 0) {
    const globalUsers = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { name: { in: globalRoles } } } },
      select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } },
    });
    allRecipients.push(...globalUsers);
  }

  if (scopedRoles.length > 0 && assignedUserIds.size > 0) {
    const scopedUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { in: Array.from(assignedUserIds) },
        roles: { some: { name: { in: scopedRoles } } },
      },
      select: { id: true, email: true, name: true, muteNotification: true, roles: { select: { name: true } } },
    });
    scopedUsers.forEach(u => {
      if (!allRecipients.find((r: any) => r.id === u.id)) {
        allRecipients.push(u);
      }
    });
  }

  if (recipientUsers) {
    allRecipients = allRecipients.filter((u: any) => u.roles.some((r: any) => {
      if (!recipientRoles.includes(r.name)) return false;
      const specific = recipientUsers[r.name];
      if (!specific || specific.length === 0) return true;
      return specific.includes(u.id);
    }));
  }

  return allRecipients;
}

// OLD logic for comparison
async function oldResolveAllByRole(recipientRoles: string[]) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { name: { in: recipientRoles } } },
    },
    select: { id: true, email: true, name: true, roles: { select: { name: true } } },
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  FAIL: ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

async function main() {
  console.log('=== Notification Engine Test ===\n');

  // Get all users and roles for context
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, roles: { select: { name: true } } },
  });
  console.log(`Total active users: ${allUsers.length}`);
  
  const roleGroups: Record<string, string[]> = {};
  allUsers.forEach(u => {
    u.roles.forEach(r => {
      if (!roleGroups[r.name]) roleGroups[r.name] = [];
      roleGroups[r.name].push(u.name);
    });
  });
  console.log('Users per role:');
  Object.entries(roleGroups).forEach(([role, names]) => {
    console.log(`  ${role}: ${names.length} users (${names.join(', ')})`);
  });

  // Get notification rules
  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true },
  });
  console.log(`\nActive notification rules: ${rules.length}`);
  rules.forEach(r => {
    console.log(`  - ${r.name} [${r.triggerType}] To: ${JSON.stringify(r.recipientRoles)} CC: ${JSON.stringify((r as any).recipientRolesCc || [])}`);
  });

  // Pick a few opportunities with different assignment patterns
  const opps = await prisma.opportunity.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true, roles: { select: { name: true } } } },
      salesRepName: true,
      managerName: true,
      presalesAssigneeName: true,
      currentStage: true,
    },
  });

  console.log(`\n--- Testing with ${opps.length} recent opportunities ---\n`);

  for (const opp of opps) {
    console.log(`\nOpportunity: "${opp.title}" (stage: ${opp.currentStage})`);
    console.log(`  Owner: ${opp.owner?.name} (roles: ${opp.owner?.roles.map(r => r.name).join(', ')})`);
    console.log(`  SalesRep: ${opp.salesRepName || 'N/A'}`);
    console.log(`  Manager: ${opp.managerName || 'N/A'}`);
    console.log(`  Presales: ${opp.presalesAssigneeName || 'N/A'}`);

    // Test each rule against this opportunity
    for (const rule of rules) {
      const recipientRoles = (rule.recipientRoles as string[]) || [];
      const recipientRolesCc = ((rule as any).recipientRolesCc as string[]) || [];
      const recipientUsers = rule.recipientUsers as Record<string, string[]> | null;

      // NEW: assigned-only recipients
      const newTo = await resolveAssignedRecipients(opp.id, recipientRoles, recipientUsers);
      const newCc = recipientRolesCc.length > 0
        ? (await resolveAssignedRecipients(opp.id, recipientRolesCc, recipientUsers))
            .filter(u => !newTo.find(t => t.id === u.id))
        : [];

      // OLD: all users with role
      const oldTo = await oldResolveAllByRole(recipientRoles);

      const newNames = newTo.map(u => `${u.name}(${u.roles.map((r:any) => r.name).join('+')})`);
      const oldNames = oldTo.map(u => `${u.name}(${u.roles.map((r:any) => r.name).join('+')})`);

      console.log(`\n  Rule: "${rule.name}" [To: ${JSON.stringify(recipientRoles)}]`);
      console.log(`    OLD (all by role): ${oldNames.join(', ') || 'none'} (${oldTo.length} users)`);
      console.log(`    NEW (assigned only): ${newNames.join(', ') || 'none'} (${newTo.length} users)`);
      if (newCc.length > 0) {
        console.log(`    NEW CC: ${newCc.map(u => u.name).join(', ')}`);
      }

      // ─── Assertions ───
      // 1. NEW should never have MORE users than OLD (we're filtering, not adding)
      assert(
        newTo.length <= oldTo.length,
        `New recipients <= old recipients`,
        `new=${newTo.length}, old=${oldTo.length}`
      );

      // 2. All Admins in the role list should still be included
      const adminRolesInRule = recipientRoles.filter(r => GLOBAL_ROLES.includes(r));
      if (adminRolesInRule.length > 0) {
        const allAdmins = allUsers.filter(u => u.roles.some(r => r.name === 'Admin'));
        const adminInNew = newTo.filter(u => u.roles.some((r:any) => r.name === 'Admin'));
        assert(
          adminInNew.length === allAdmins.length,
          `All Admins included when Admin is in recipientRoles`,
          `expected=${allAdmins.length}, got=${adminInNew.length}`
        );
      }

      // 3. Non-admin scoped users should only be assigned users
      const assignedNames = [opp.owner?.name, opp.salesRepName, opp.managerName, opp.presalesAssigneeName].filter(Boolean);
      const scopedInNew = newTo.filter(u => !u.roles.some((r:any) => GLOBAL_ROLES.includes(r.name)));
      for (const user of scopedInNew) {
        assert(
          assignedNames.includes(user.name),
          `Scoped user "${user.name}" is assigned to opportunity`,
          `assigned: [${assignedNames.join(', ')}]`
        );
      }

      // 4. No duplicates in combined To + CC
      const allIds = [...newTo, ...newCc].map(u => u.id);
      const uniqueIds = new Set(allIds);
      assert(
        allIds.length === uniqueIds.size,
        `No duplicate recipients in To + CC`
      );
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch(e => { console.error('Test error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
