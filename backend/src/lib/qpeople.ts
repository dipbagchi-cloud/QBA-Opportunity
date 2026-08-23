/**
 * Q-People (Frappe/ERPNext + HRMS at hr.qbadvisory.com) read-only client.
 *
 * Everything here is a GET. Q-People is the system of record for projects,
 * employees, skills and allocation; QCRM never writes back.
 *
 * Field notes discovered against the live instance (2026-08-23):
 *  - Project.name          "PROJ-0142"  UNIQUE  -> use this as the mapping key
 *  - Project.custom_project_code         NOT unique (2 collisions today) -> display only
 *  - Employee.custom_skillset_gom        the shared taxonomy with QCRM rate cards
 *                                        (53 values, byte-identical strings), but
 *                                        currently populated for 0 of 354 employees
 *  - Employee.custom_overall_experience  decimal years as a STRING ("8.6"), 48/354
 *  - Employee Project Allocation         2660 monthly docs, child `project_allocations`
 *                                        carries allocation_percent / allowed / booked hours
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.QPEOPLE_BASE_URL || 'https://hr.qbadvisory.com';

export class QPeopleError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'QPeopleError';
  }
}

function token(): string {
  const t = process.env.QPEOPLE_API_TOKEN;
  if (!t) throw new QPeopleError('QPEOPLE_API_TOKEN not configured');
  return t;
}

async function qget<T = any>(path: string, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `token ${token()}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new QPeopleError(
        `Q-People ${res.status} on ${path.split('?')[0]}: ${body.slice(0, 160)}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof QPeopleError) throw err;
    if (err?.name === 'AbortError') throw new QPeopleError(`Q-People timed out on ${path.split('?')[0]}`, 504);
    throw new QPeopleError(`Q-People request failed: ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Frappe list helper. limit_page_length=0 returns everything. */
async function list<T = any>(doctype: string, fields: string[], filters?: any[], limit = 0): Promise<T[]> {
  const params = new URLSearchParams();
  params.set('fields', JSON.stringify(fields));
  params.set('limit_page_length', String(limit));
  if (filters?.length) params.set('filters', JSON.stringify(filters));
  const json = await qget<{ data: T[] }>(`/api/resource/${encodeURIComponent(doctype)}?${params}`);
  return json.data || [];
}

// ── Simple TTL cache ────────────────────────────────────────────────────────
// Q-People masters change rarely; the mapping screen is chatty. 10 minutes keeps
// the UI responsive without serving stale project lists for long.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: any }>();

async function cached<T>(key: string, fn: () => Promise<T>, force = false): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearQPeopleCache() {
  cache.clear();
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface QPeopleProject {
  id: string;             // Project.name — "PROJ-0142", unique
  code: string;           // custom_project_code — display only, NOT unique
  name: string;           // project_name
  customer: string | null;
  company: string | null;
  projectType: string | null;
  status: string | null;  // Open | Completed | Cancelled
  isActive: boolean;
  expectedStartDate: string | null;
  expectedEndDate: string | null;
}

export async function fetchProjects(force = false): Promise<QPeopleProject[]> {
  return cached('projects', async () => {
    const rows = await list<any>('Project', [
      'name', 'project_name', 'custom_project_code', 'customer', 'company',
      'project_type', 'status', 'is_active', 'expected_start_date', 'expected_end_date',
    ]);
    return rows.map((r) => ({
      id: r.name,
      code: r.custom_project_code || '',
      name: r.project_name || r.name,
      customer: r.customer || null,
      company: r.company || null,
      projectType: r.project_type || null,
      status: r.status || null,
      isActive: r.is_active === 'Yes' || r.is_active === 1 || r.is_active === true,
      expectedStartDate: r.expected_start_date || null,
      expectedEndDate: r.expected_end_date || null,
    }));
  }, force);
}

// ── Skillset GOM (the shared taxonomy with QCRM rate cards) ─────────────────

export async function fetchSkillsetGom(force = false): Promise<string[]> {
  return cached('skillset-gom', async () => {
    const rows = await list<any>('Skillset GOM', ['name', 'skillset_name']);
    return rows.map((r) => r.skillset_name || r.name).filter(Boolean).sort();
  }, force);
}

/**
 * QCRM rate cards store SAP skills unprefixed ("FICO", "ABAP", "Basis") while the
 * Skillset GOM master prefixes them ("SAP FICO", "SAP ABAP", "SAP Basis"). Every
 * non-SAP value is already byte-identical. Normalising both sides to a comparison
 * key makes the join exact without hand-maintaining a synonym table.
 */
export function skillKey(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/^sap\s+/, '')      // "SAP FICO" and "FICO" collapse to the same key
    .replace(/[^a-z0-9]+/g, ' ') // punctuation-insensitive
    .trim();
}

// ── Employees ───────────────────────────────────────────────────────────────

export interface QPeopleEmployee {
  id: string;                       // Employee.name — "QBA0271"
  name: string;
  email: string | null;
  status: string | null;            // Active | Left | Inactive
  designation: string | null;
  department: string | null;
  grade: string | null;
  skillsetGom: string | null;       // the exact join key — sparsely populated today
  freeTextSkill: string | null;     // custom_skill, noisy fallback (not used for matching)
  experienceYears: number | null;   // custom_overall_experience, parsed from string
  dateOfJoining: string | null;
  timesheetApplicable: boolean;
}

export async function fetchEmployees(force = false): Promise<QPeopleEmployee[]> {
  return cached('employees', async () => {
    const rows = await list<any>('Employee', [
      'name', 'employee_name', 'company_email', 'prefered_email', 'user_id', 'status',
      'designation', 'department', 'grade', 'custom_skillset_gom', 'custom_skill',
      'custom_overall_experience', 'date_of_joining', 'custom_timesheet_applicable',
    ]);
    return rows.map((r) => {
      const raw = r.custom_overall_experience;
      const years = raw === null || raw === undefined || raw === '' ? null : Number(raw);
      return {
        id: r.name,
        name: r.employee_name || r.name,
        email: r.user_id || r.company_email || r.prefered_email || null,
        status: r.status || null,
        designation: r.designation || null,
        department: r.department || null,
        grade: r.grade || null,
        skillsetGom: r.custom_skillset_gom || null,
        freeTextSkill: r.custom_skill || null,
        experienceYears: years !== null && Number.isFinite(years) ? years : null,
        dateOfJoining: r.date_of_joining || null,
        timesheetApplicable: r.custom_timesheet_applicable === 1 || r.custom_timesheet_applicable === true,
      };
    });
  }, force);
}

// ── Employee Project Allocation (planned allocation) ────────────────────────

export interface QPeopleAllocationLine {
  employeeId: string;
  employeeName: string;
  month: string;                 // "Apr"
  year: number;
  projectId: string | null;      // "PROJ-0142"
  projectName: string | null;
  projectManager: string | null;
  allocationPercent: number;
  allowedHours: number;
  bookedHours: number;
}

/**
 * Allocation docs are per employee per month, with a child table of projects.
 * The list API does not expand child tables, so each doc must be fetched — 2660
 * docs is far too many. We therefore fetch the parents (cheap) for the requested
 * period and only expand those, which keeps it to a few dozen requests.
 */
export async function fetchAllocations(opts: { year?: number; months?: string[] } = {}, force = false)
  : Promise<QPeopleAllocationLine[]> {
  const key = `alloc:${opts.year ?? 'all'}:${(opts.months || []).join(',')}`;
  return cached(key, async () => {
    const filters: any[] = [];
    if (opts.year) filters.push(['year', '=', opts.year]);
    if (opts.months?.length) filters.push(['month', 'in', opts.months]);

    const parents = await list<any>('Employee Project Allocation',
      ['name', 'employee', 'employee_name', 'month', 'year', 'total_allocation'], filters);

    const out: QPeopleAllocationLine[] = [];
    // Bounded concurrency — Frappe rate-limits aggressive parallel fetches.
    const BATCH = 8;
    for (let i = 0; i < parents.length; i += BATCH) {
      const slice = parents.slice(i, i + BATCH);
      const docs = await Promise.all(slice.map(async (p) => {
        try {
          const j = await qget<{ data: any }>(
            `/api/resource/${encodeURIComponent('Employee Project Allocation')}/${encodeURIComponent(p.name)}`);
          return { parent: p, doc: j.data };
        } catch {
          return null;   // one bad doc must not sink the whole view
        }
      }));
      for (const entry of docs) {
        if (!entry?.doc) continue;
        const lines: any[] = entry.doc.project_allocations || [];
        for (const l of lines) {
          out.push({
            employeeId: entry.parent.employee,
            employeeName: entry.parent.employee_name,
            month: entry.parent.month,
            year: entry.parent.year,
            projectId: l.project || null,
            projectName: l.project_name || null,
            projectManager: l.project_manager || null,
            allocationPercent: Number(l.allocation_percent) || 0,
            allowedHours: Number(l.allowed_hours) || 0,
            bookedHours: Number(l.booked_hours) || 0,
          });
        }
      }
    }
    return out;
  }, force);
}

/** Current commitment per employee: summed allocation % over the latest period held. */
export async function fetchCurrentCommitment(force = false): Promise<Map<string, number>> {
  const all = await fetchAllocations({}, force);
  if (!all.length) return new Map();
  const latestYear = Math.max(...all.map((a) => a.year || 0));
  const inYear = all.filter((a) => a.year === latestYear);
  const byEmployee = new Map<string, number>();
  // Take the busiest month in the latest year as the representative commitment.
  const byEmpMonth = new Map<string, number>();
  for (const a of inYear) {
    const k = `${a.employeeId}|${a.month}`;
    byEmpMonth.set(k, (byEmpMonth.get(k) || 0) + a.allocationPercent);
  }
  for (const [k, pct] of byEmpMonth) {
    const emp = k.split('|')[0];
    byEmployee.set(emp, Math.max(byEmployee.get(emp) || 0, pct));
  }
  return byEmployee;
}

// ── Timesheets (actual hours / cost — feeds Actual GOM) ─────────────────────

export interface QPeopleTimesheetTotals {
  projectId: string;
  totalHours: number;
  billableHours: number;
  costingAmount: number;
  billableAmount: number;
  billedAmount: number;
  employees: number;
}

export async function fetchTimesheetTotalsForProject(projectId: string, force = false)
  : Promise<QPeopleTimesheetTotals> {
  return cached(`ts:${projectId}`, async () => {
    const rows = await list<any>('Timesheet', [
      'name', 'employee', 'total_hours', 'total_billable_hours',
      'total_costing_amount', 'total_billable_amount', 'total_billed_amount', 'docstatus',
    ], [['parent_project', '=', projectId]]);
    const submitted = rows.filter((r) => r.docstatus !== 2);   // drop cancelled
    const sum = (f: string) => submitted.reduce((a, r) => a + (Number(r[f]) || 0), 0);
    return {
      projectId,
      totalHours: sum('total_hours'),
      billableHours: sum('total_billable_hours'),
      costingAmount: sum('total_costing_amount'),
      billableAmount: sum('total_billable_amount'),
      billedAmount: sum('total_billed_amount'),
      employees: new Set(submitted.map((r) => r.employee).filter(Boolean)).size,
    };
  }, force);
}

// ── Matching ────────────────────────────────────────────────────────────────

/** QCRM experience bands come in two spellings; both map to the same year range. */
export function parseExperienceBand(band?: string | null): { min: number; max: number } | null {
  if (!band) return null;
  const b = band.trim().toLowerCase();
  if (/^(>|15\+)/.test(b) || b.startsWith('15+')) return { min: 15, max: 99 };
  const m = b.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const single = b.match(/^(\d+)/);
  if (single) return { min: Number(single[1]), max: 99 };
  return null;
}

export interface EmployeeMatch {
  employee: QPeopleEmployee;
  allocationPercent: number;     // current commitment, 0 when unknown
  remainingPercent: number;
  experienceMatches: boolean;    // false when the band is missed OR experience is unknown
  experienceKnown: boolean;
}

/**
 * Exact-only matching, per product decision: an employee is a candidate solely
 * when their custom_skillset_gom equals the row's skill (after SAP-prefix
 * normalisation). Experience narrows the list but never invents a match — a
 * candidate with no recorded experience is returned flagged, not silently kept
 * or dropped, so the gap is visible rather than disguised as a result.
 */
export function matchEmployees(
  employees: QPeopleEmployee[],
  skill: string | null | undefined,
  experienceBand: string | null | undefined,
  commitment: Map<string, number>,
): EmployeeMatch[] {
  const want = skillKey(skill);
  if (!want) return [];
  const range = parseExperienceBand(experienceBand);

  return employees
    .filter((e) => e.status === 'Active' && skillKey(e.skillsetGom) === want)
    .map((e) => {
      const pct = commitment.get(e.id) || 0;
      const known = e.experienceYears !== null;
      const fits = known && range
        ? e.experienceYears! >= range.min && e.experienceYears! <= range.max
        : !range;
      return {
        employee: e,
        allocationPercent: pct,
        remainingPercent: Math.max(0, 100 - pct),
        experienceMatches: fits,
        experienceKnown: known,
      };
    })
    .sort((a, b) => {
      if (a.experienceMatches !== b.experienceMatches) return a.experienceMatches ? -1 : 1;
      return b.remainingPercent - a.remainingPercent;
    });
}

/**
 * Why a match list is empty. Without this the UI cannot tell "nobody has that
 * skill" from "nobody has been tagged at all", and the second is the situation
 * today (0 of 354 employees carry a Skillset GOM).
 */
export async function skillsetCoverage(force = false) {
  const employees = await fetchEmployees(force);
  const active = employees.filter((e) => e.status === 'Active');
  const tagged = active.filter((e) => !!e.skillsetGom);
  const withExperience = active.filter((e) => e.experienceYears !== null);
  return {
    activeEmployees: active.length,
    taggedWithSkillset: tagged.length,
    withExperience: withExperience.length,
    ready: tagged.length > 0,
  };
}

export type { PrismaClient };
