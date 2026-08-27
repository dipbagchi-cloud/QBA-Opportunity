/**
 * Actual GOM — "Project / Resource Mapping" sub-tab.
 *
 * Maps a won opportunity to the Q-People project people book time against, then
 * builds the delivery resource plan from the presales Resource Assignment and
 * matches Q-People employees to each row.
 */
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  fetchProjects, getEmployeesResolved, fetchCommitmentDetail, fetchAllocations,
  fetchTimesheetTotalsForProject, matchEmployees, skillsetCoverage, EmployeeCommitment, skillKey,
  clearQPeopleCache, QPeopleError,
} from '../lib/qpeople';
import { getSkillAliasMap } from '../lib/skill-aliases';
import { recordAudit } from '../lib/audit';

/** Actual GOM only exists for won deals — mirrors the frontend tab gate. */
const WON_STAGES = new Set(['Closed Won', 'Closed-Won', 'Delivered']);

type LoadResult =
  | { ok: true; opp: any }
  | { ok: false; status: number; message: string };

async function loadWonOpportunity(id: string): Promise<LoadResult> {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { stage: true, client: true },
  });
  if (!opp) return { ok: false, status: 404, message: 'Opportunity not found' };
  const stageName = opp.stage?.name || opp.currentStage || '';
  if (!WON_STAGES.has(stageName)) {
    return {
      ok: false,
      status: 409,
      message: `Actual GOM is only available on a won opportunity (this one is in "${stageName}")`,
    };
  }
  return { ok: true, opp };
}

function handleQPeopleError(res: Response, err: unknown) {
  if (err instanceof QPeopleError) {
    console.error('Q-People error:', err.message);
    return res.status(err.status && err.status >= 500 ? 502 : 502)
      .json({ error: 'Could not reach Q-People', detail: err.message });
  }
  console.error('Actual GOM error:', err);
  return res.status(500).json({ error: 'Unexpected error' });
}

// ── Project mapping ─────────────────────────────────────────────────────────

/**
 * GET /api/opportunities/:id/qpeople/projects
 * Selectable Q-People projects: active + open, minus any already claimed by
 * another opportunity. The current opportunity's own mapping stays in the list
 * so the UI can show it as selected.
 */
export async function listSelectableProjects(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const loaded = await loadWonOpportunity(id);
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const includeInactive = req.query.includeInactive === 'true';
    const force = req.query.refresh === 'true';

    const [projects, mappings] = await Promise.all([
      fetchProjects(force),
      prisma.qPeopleProjectMapping.findMany({
        select: { qpeopleProjectId: true, opportunityId: true, opportunity: { select: { title: true } } },
      }),
    ]);

    const claimedByOther = new Map(
      mappings.filter((m) => m.opportunityId !== id)
        .map((m) => [m.qpeopleProjectId, m.opportunity?.title || 'another opportunity']),
    );

    const selectable = projects
      .filter((p) => includeInactive || (p.isActive && p.status === 'Open'))
      .filter((p) => !claimedByOther.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      projects: selectable,
      totals: {
        inQPeople: projects.length,
        selectable: selectable.length,
        alreadyMapped: claimedByOther.size,
      },
    });
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}

/** GET /api/opportunities/:id/qpeople/mapping */
export async function getMapping(req: Request, res: Response) {
  try {
    const mapping = await prisma.qPeopleProjectMapping.findUnique({
      where: { opportunityId: req.params.id },
    });
    res.json(mapping || null);
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}

/** PUT /api/opportunities/:id/qpeople/mapping  { qpeopleProjectId } */
export async function saveMapping(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { qpeopleProjectId } = req.body || {};
    if (!qpeopleProjectId) return res.status(400).json({ error: 'qpeopleProjectId is required' });

    const loaded = await loadWonOpportunity(id);
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const projects = await fetchProjects();
    const project = projects.find((p) => p.id === qpeopleProjectId);
    if (!project) return res.status(404).json({ error: `Q-People project ${qpeopleProjectId} not found` });

    // Re-check the claim inside the request rather than trusting the list the
    // client rendered — two users can map the same project concurrently.
    const claimed = await prisma.qPeopleProjectMapping.findUnique({
      where: { qpeopleProjectId },
      include: { opportunity: { select: { id: true, title: true } } },
    });
    if (claimed && claimed.opportunityId !== id) {
      return res.status(409).json({
        error: `"${project.name}" is already mapped to "${claimed.opportunity?.title}"`,
      });
    }

    // The JWT payload carries userId/permissions but not a display name, so read
    // it once for the audit trail rather than leaving the mapping anonymous.
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    const data = {
      qpeopleProjectId: project.id,
      qpeopleProjectCode: project.code,
      qpeopleProjectName: project.name,
      qpeopleCustomer: project.customer,
      mappedById: req.user!.userId,
      mappedByName: actor?.name || null,
    };

    const mapping = await prisma.qPeopleProjectMapping.upsert({
      where: { opportunityId: id },
      create: { opportunityId: id, ...data },
      update: data,
    });

    await recordAudit({
      req,
      entity: 'QPeopleProjectMapping',
      entityId: mapping.id,
      action: 'UPSERT',
      changes: { opportunityId: id, project: project.id, code: project.code, name: project.name },
    });

    res.json(mapping);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'That Q-People project has just been mapped by someone else' });
    }
    return handleQPeopleError(res, err);
  }
}

/** DELETE /api/opportunities/:id/qpeople/mapping */
export async function deleteMapping(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.qPeopleProjectMapping.findUnique({ where: { opportunityId: id } });
    if (!existing) return res.status(404).json({ error: 'No mapping to remove' });

    await prisma.qPeopleProjectMapping.delete({ where: { opportunityId: id } });
    await recordAudit({
      req,
      entity: 'QPeopleProjectMapping',
      entityId: existing.id,
      action: 'DELETE',
      changes: { opportunityId: id, project: existing.qpeopleProjectId, code: existing.qpeopleProjectCode },
    });
    res.json({ message: 'Mapping removed' });
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}

// ── Resource plan ───────────────────────────────────────────────────────────

interface PresalesResource {
  id?: string;
  skill?: string;
  experienceBand?: string;
  projectRole?: string;
  role?: string;
}

function presalesResources(opp: any): PresalesResource[] {
  const pd = opp?.presalesData;
  const rows = pd && typeof pd === 'object' ? (pd as any).resources : null;
  return Array.isArray(rows) ? rows : [];
}

/**
 * GET /api/opportunities/:id/qpeople/resource-plan
 *
 * Returns the saved plan (seeding it from the presales Resource Assignment the
 * first time), each row's Q-People candidates, and the coverage figures that
 * explain an empty candidate list.
 */
export async function getResourcePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const loaded = await loadWonOpportunity(id);
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });
    const { opp } = loaded;

    const force = req.query.refresh === 'true';
    if (force) clearQPeopleCache();

    let rows = await prisma.actualResourceRow.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: 'asc' },
    });

    // First visit: seed the plan from the presales estimate. Every seeded row is
    // MATCHED because at this point the plan is the estimate.
    if (rows.length === 0) {
      const seed = presalesResources(opp);
      if (seed.length) {
        await prisma.actualResourceRow.createMany({
          data: seed.map((r) => ({
            opportunityId: id,
            sourceRowId: r.id || null,
            origin: 'MATCHED',
            skill: r.skill || null,
            experienceBand: r.experienceBand || null,
            projectRole: r.projectRole || r.role || null,
            originalSkill: r.skill || null,
            originalExperienceBand: r.experienceBand || null,
            originalProjectRole: r.projectRole || r.role || null,
          })),
        });
        rows = await prisma.actualResourceRow.findMany({
          where: { opportunityId: id },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    const [employees, commitment, coverage, aliases] = await Promise.all([
      getEmployeesResolved(force),
      fetchCommitmentDetail(force).catch(() => new Map<string, EmployeeCommitment>()),
      skillsetCoverage(force),
      getSkillAliasMap(force),
    ]);

    const withCandidates = rows.map((row) => ({
      ...row,
      candidates: matchEmployees(employees, row.skill, row.experienceBand, commitment, aliases)
        .map((m) => ({
          employeeId: m.employee.id,
          employeeName: m.employee.name,
          designation: m.employee.designation,
          department: m.employee.department,
          grade: m.employee.grade,
          skillsetGom: m.employee.skillsetGom,
          experienceYears: m.employee.experienceYears,
          experienceKnown: m.experienceKnown,
          experienceMatches: m.experienceMatches,
          // Fractional years placed on the shared band ladder (4.17 -> "4 - 6 Years")
          experienceBandKey: m.experienceBandKey,
          experienceBandLabel: m.experienceBandLabel,
          // Commitment is the split across projects, not spare capacity —
          // Q-People's total_allocation is 100 for anyone allocated at all.
          projectCount: m.projectCount,
          commitmentMonth: m.commitment ? `${m.commitment.month} ${m.commitment.year}` : null,
          commitmentProjects: m.commitment
            ? m.commitment.projects.map((p) => ({
                projectId: p.projectId,
                projectName: p.projectName,
                percent: p.percent,
                bookedHours: p.bookedHours,
                allowedHours: p.allowedHours,
              }))
            : [],
        })),
    }));

    // Reconciliation against who Q-People actually has booked on the mapped
    // project. Additive: `rows` keeps exactly the shape it had, and this block
    // is null when no project is mapped, so the existing UI is unaffected.
    let reconciliation: Awaited<ReturnType<typeof buildReconciliation>> | null = null;
    const mapping = await prisma.qPeopleProjectMapping.findUnique({ where: { opportunityId: id } });
    if (mapping) {
      reconciliation = await buildReconciliation(mapping.qpeopleProjectId, rows, employees, force)
        .catch(() => null);
    }

    res.json({
      rows: withCandidates,
      coverage,
      presalesRowCount: presalesResources(opp).length,
      reconciliation,
    });
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}

/**
 * Compare the QCRM resource plan against Q-People's actual allocation for the
 * mapped project, and classify every person on either side:
 *
 *   MATCHED       planned in QCRM and allocated in Q-People, skill agrees
 *   SKILL_MISMATCH allocated to the project, but their skillset is not one the
 *                  plan asks for — the commonest real finding
 *   NOT_ALLOCATED  named on a QCRM plan line but not booked on the project
 *   UNPLANNED      booked on the project but not on any plan line
 *
 * Planned lines with no named person are reported separately as unfilled demand
 * rather than being forced into one of the above.
 */
async function buildReconciliation(
  projectId: string,
  planRows: { id: string; skill: string | null; experienceBand: string | null; projectRole: string | null; employeeId: string | null; employeeName: string | null; quantity: number }[],
  employees: Awaited<ReturnType<typeof getEmployeesResolved>>,
  force: boolean,
) {
  const allocations = await fetchAllocations({}, force);
  const forProject = allocations.filter((a) => a.projectId === projectId);

  // Latest period held for this project — earlier months describe a staffing
  // shape that has since moved on.
  const latestYear = forProject.length ? Math.max(...forProject.map((a) => a.year || 0)) : null;
  const inScope = forProject.filter((a) => a.year === latestYear);

  const byEmployee = new Map<string, { employeeId: string; employeeName: string; percent: number; bookedHours: number; allowedHours: number; months: Set<string> }>();
  for (const a of inScope) {
    const e = byEmployee.get(a.employeeId) || {
      employeeId: a.employeeId, employeeName: a.employeeName,
      percent: 0, bookedHours: 0, allowedHours: 0, months: new Set<string>(),
    };
    e.percent = Math.max(e.percent, a.allocationPercent);
    e.bookedHours += a.bookedHours;
    e.allowedHours += a.allowedHours;
    e.months.add(a.month);
    byEmployee.set(a.employeeId, e);
  }

  const empById = new Map(employees.map((e) => [e.id, e]));
  const plannedByEmployee = new Map(planRows.filter((r) => r.employeeId).map((r) => [r.employeeId!, r]));
  const wantedSkills = new Set(planRows.map((r) => skillKey(r.skill)).filter(Boolean));

  const findings: any[] = [];

  // Everyone Q-People has on the project
  for (const [empId, alloc] of byEmployee) {
    const emp = empById.get(empId);
    const planned = plannedByEmployee.get(empId);
    const empSkillKey = skillKey(emp?.skillsetGom);
    const base = {
      employeeId: empId,
      employeeName: alloc.employeeName || emp?.name || empId,
      qpeopleSkill: emp?.skillsetGom || null,
      designation: emp?.designation || null,
      allocationPercent: alloc.percent,
      bookedHours: alloc.bookedHours,
      allowedHours: alloc.allowedHours,
      months: [...alloc.months],
      plannedRowId: planned?.id || null,
      plannedSkill: planned?.skill || null,
      plannedBand: planned?.experienceBand || null,
    };

    if (planned) {
      const agrees = !!empSkillKey && empSkillKey === skillKey(planned.skill);
      findings.push({
        ...base,
        status: agrees ? 'MATCHED' : 'SKILL_MISMATCH',
        detail: agrees
          ? null
          : `Planned as "${planned.skill || '—'}" but Q-People has them as "${emp?.skillsetGom || 'no skillset set'}"`,
      });
    } else {
      const skillIsWanted = !!empSkillKey && wantedSkills.has(empSkillKey);
      findings.push({
        ...base,
        status: 'UNPLANNED',
        detail: skillIsWanted
          ? 'Booked on the project and their skill is in the plan, but they are not named on any line'
          : 'Booked on the project but their skill is not in the plan at all',
      });
    }
  }

  // Named on the plan but absent from Q-People's allocation
  for (const r of planRows) {
    if (!r.employeeId || byEmployee.has(r.employeeId)) continue;
    const emp = empById.get(r.employeeId);
    findings.push({
      employeeId: r.employeeId,
      employeeName: r.employeeName || emp?.name || r.employeeId,
      qpeopleSkill: emp?.skillsetGom || null,
      designation: emp?.designation || null,
      allocationPercent: 0,
      bookedHours: 0,
      allowedHours: 0,
      months: [],
      plannedRowId: r.id,
      plannedSkill: r.skill,
      plannedBand: r.experienceBand,
      status: 'NOT_ALLOCATED',
      detail: 'On the QCRM plan but not allocated to this project in Q-People',
    });
  }

  const unfilled = planRows
    .filter((r) => !r.employeeId)
    .map((r) => ({ rowId: r.id, skill: r.skill, experienceBand: r.experienceBand, projectRole: r.projectRole, quantity: r.quantity }));

  const count = (s: string) => findings.filter((f) => f.status === s).length;
  return {
    projectId,
    period: latestYear,
    findings: findings.sort((a, b) => {
      const order: Record<string, number> = { SKILL_MISMATCH: 0, UNPLANNED: 1, NOT_ALLOCATED: 2, MATCHED: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.employeeName.localeCompare(b.employeeName);
    }),
    unfilledPlanLines: unfilled,
    totals: {
      allocatedInQPeople: byEmployee.size,
      matched: count('MATCHED'),
      skillMismatch: count('SKILL_MISMATCH'),
      unplanned: count('UNPLANNED'),
      notAllocated: count('NOT_ALLOCATED'),
      unfilledPlanLines: unfilled.length,
    },
  };
}

/**
 * PUT /api/opportunities/:id/qpeople/resource-plan  { rows: [...] }
 *
 * Replaces the plan. origin is derived server-side rather than trusted from the
 * client: a row with no sourceRowId is NEW, and one that differs from the
 * presales values it came from is CHANGED. That keeps the colour coding honest
 * even if the UI gets it wrong.
 */
export async function saveResourcePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const loaded = await loadWonOpportunity(id);
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });
    const { opp } = loaded;

    const incoming = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!incoming) return res.status(400).json({ error: 'rows array is required' });

    const seedById = new Map(presalesResources(opp).filter((r) => r.id).map((r) => [r.id!, r]));

    const prepared = incoming.map((r: any) => {
      const source = r.sourceRowId ? seedById.get(r.sourceRowId) : undefined;
      const originalSkill = source?.skill ?? r.originalSkill ?? null;
      const originalBand = source?.experienceBand ?? r.originalExperienceBand ?? null;
      const originalRole = (source?.projectRole || source?.role) ?? r.originalProjectRole ?? null;

      let origin: string;
      if (!r.sourceRowId) {
        origin = 'NEW';
      } else if (
        (r.skill || null) !== originalSkill ||
        (r.experienceBand || null) !== originalBand ||
        (r.projectRole || null) !== originalRole
      ) {
        origin = 'CHANGED';
      } else {
        origin = 'MATCHED';
      }

      return {
        opportunityId: id,
        sourceRowId: r.sourceRowId || null,
        origin,
        skill: r.skill || null,
        experienceBand: r.experienceBand || null,
        projectRole: r.projectRole || null,
        quantity: Number.isFinite(Number(r.quantity)) && Number(r.quantity) > 0 ? Number(r.quantity) : 1,
        originalSkill,
        originalExperienceBand: originalBand,
        originalProjectRole: originalRole,
        employeeId: r.employeeId || null,
        employeeName: r.employeeName || null,
      };
    });

    await prisma.$transaction([
      prisma.actualResourceRow.deleteMany({ where: { opportunityId: id } }),
      prisma.actualResourceRow.createMany({ data: prepared }),
    ]);

    await recordAudit({
      req,
      entity: 'ActualResourceRow',
      entityId: id,
      action: 'REPLACE',
      changes: {
        rows: prepared.length,
        matched: prepared.filter((p: { origin: string }) => p.origin === 'MATCHED').length,
        changed: prepared.filter((p: { origin: string }) => p.origin === 'CHANGED').length,
        added: prepared.filter((p: { origin: string }) => p.origin === 'NEW').length,
      },
    });

    const rows = await prisma.actualResourceRow.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ rows });
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}

/**
 * GET /api/opportunities/:id/qpeople/allocation
 * Q-People's own view of who is booked on the mapped project: planned allocation
 * from Employee Project Allocation plus logged hours/cost from Timesheets.
 */
export async function getProjectAllocation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const mapping = await prisma.qPeopleProjectMapping.findUnique({ where: { opportunityId: id } });
    if (!mapping) return res.status(409).json({ error: 'Map a Q-People project first' });

    const force = req.query.refresh === 'true';
    const [allocations, timesheets] = await Promise.all([
      fetchAllocations({}, force).catch(() => []),
      fetchTimesheetTotalsForProject(mapping.qpeopleProjectId, force)
        .catch(() => null),
    ]);

    const forProject = allocations.filter((a) => a.projectId === mapping.qpeopleProjectId);
    const byEmployee = new Map<string, { employeeId: string; employeeName: string; months: number; allocationPercent: number; allowedHours: number; bookedHours: number }>();
    for (const a of forProject) {
      const e = byEmployee.get(a.employeeId) || {
        employeeId: a.employeeId, employeeName: a.employeeName,
        months: 0, allocationPercent: 0, allowedHours: 0, bookedHours: 0,
      };
      e.months += 1;
      e.allocationPercent = Math.max(e.allocationPercent, a.allocationPercent);
      e.allowedHours += a.allowedHours;
      e.bookedHours += a.bookedHours;
      byEmployee.set(a.employeeId, e);
    }

    res.json({
      project: {
        id: mapping.qpeopleProjectId,
        code: mapping.qpeopleProjectCode,
        name: mapping.qpeopleProjectName,
      },
      allocation: [...byEmployee.values()].sort((a, b) => b.bookedHours - a.bookedHours),
      timesheets,
    });
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}

/** GET /api/qpeople/skillsets — the shared taxonomy, for the skill dropdown. */
export async function listSkillsets(req: Request, res: Response) {
  try {
    const { fetchSkillsetGom } = await import('../lib/qpeople');
    res.json(await fetchSkillsetGom(req.query.refresh === 'true'));
  } catch (err) {
    return handleQPeopleError(res, err);
  }
}
