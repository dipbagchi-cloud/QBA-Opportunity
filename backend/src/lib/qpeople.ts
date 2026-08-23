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
import { prisma } from './prisma';
import {
  EXPERIENCE_BANDS, canonicalBandKey, bandForYears, bandLabel,
  type ExperienceBandKey,
} from './experience-bands';

// Re-exported so callers that already import band helpers from here keep working.
export { EXPERIENCE_BANDS, canonicalBandKey, bandForYears, bandLabel };
export type { ExperienceBandKey };

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

/**
 * Frappe serves a child doctype directly when `parent` names the doctype that
 * owns it. That turns "expand every parent's child table" from N requests into
 * one, which is the difference between a 2s response and a timeout.
 */
async function listChild<T = any>(childDoctype: string, parentDoctype: string, fields: string[]): Promise<T[]> {
  const params = new URLSearchParams();
  params.set('fields', JSON.stringify(fields));
  params.set('limit_page_length', '0');
  params.set('parent', parentDoctype);
  const json = await qget<{ data: T[] }>(
    `/api/resource/${encodeURIComponent(childDoctype)}?${params}`, 60000);
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
  /** Band straight from the HR workbook, used only when neither side has years. */
  experienceBandFallback?: string | null;
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
 * Allocation docs are per employee per month with a child table of projects.
 *
 * The obvious approach — fetch each parent doc to expand its children — needs
 * ~333 sequential requests for 2660 docs and reliably times the endpoint out.
 * Frappe will however serve a child doctype directly when `parent` names the
 * owning doctype, which returns all 6881 lines in a single ~2s call. So: two
 * list requests, joined in memory on the parent name.
 */
export async function fetchAllocations(opts: { year?: number; months?: string[] } = {}, force = false)
  : Promise<QPeopleAllocationLine[]> {
  const key = `alloc:${opts.year ?? 'all'}:${(opts.months || []).join(',')}`;
  return cached(key, async () => {
    const filters: any[] = [];
    if (opts.year) filters.push(['year', '=', opts.year]);
    if (opts.months?.length) filters.push(['month', 'in', opts.months]);

    const [parents, lines] = await Promise.all([
      list<any>('Employee Project Allocation',
        ['name', 'employee', 'employee_name', 'month', 'year', 'total_allocation'], filters),
      listChild<any>('Project Allocation Item', 'Employee Project Allocation',
        ['parent', 'project', 'project_name', 'project_manager',
          'allocation_percent', 'allowed_hours', 'booked_hours']),
    ]);

    const byName = new Map(parents.map((p) => [p.name, p]));
    const out: QPeopleAllocationLine[] = [];
    for (const l of lines) {
      const p = byName.get(l.parent);
      if (!p) continue;                     // filtered out by year/month
      out.push({
        employeeId: p.employee,
        employeeName: p.employee_name,
        month: p.month,
        year: p.year,
        projectId: l.project || null,
        projectName: l.project_name || null,
        projectManager: l.project_manager || null,
        allocationPercent: Number(l.allocation_percent) || 0,
        allowedHours: Number(l.allowed_hours) || 0,
        bookedHours: Number(l.booked_hours) || 0,
      });
    }
    return out;
  }, force);
}

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface EmployeeCommitment {
  month: string;
  year: number;
  totalPercent: number;
  projects: { projectId: string | null; projectName: string | null; percent: number; bookedHours: number; allowedHours: number }[];
}

/**
 * What each employee is committed to in the most recent *complete* month.
 *
 * Important: `total_allocation` is NOT spare capacity. It is the person's whole
 * 100% split across their projects, so it reads 100 for anyone allocated to
 * anything at all — every one of the 222 employees with a record sits at 100%.
 * Deriving "remaining capacity = 100 - total_allocation" therefore always yields
 * zero and tells the reader nothing. What is genuinely useful is the split: how
 * many projects the person is spread over, at what percentage, and their booked
 * vs allowed hours. That is what this returns.
 *
 * The reference month skips partial months — the in-progress month has a
 * fraction of the usual record count and would make everyone look idle.
 */
export async function fetchCommitmentDetail(force = false): Promise<Map<string, EmployeeCommitment>> {
  return cached('commitment-detail', async () => {
    const [parents, lines] = await Promise.all([
      list<any>('Employee Project Allocation', ['name', 'employee', 'month', 'year', 'total_allocation']),
      listChild<any>('Project Allocation Item', 'Employee Project Allocation',
        ['parent', 'project', 'project_name', 'allocation_percent', 'allowed_hours', 'booked_hours']),
    ]);
    const out = new Map<string, EmployeeCommitment>();
    if (!parents.length) return out;

    const latestYear = Math.max(...parents.map((p) => Number(p.year) || 0));
    const inYear = parents.filter((p) => Number(p.year) === latestYear);

    // Pick the newest month that looks complete (>=60% of the fullest month).
    const counts = new Map<string, number>();
    inYear.forEach((p) => counts.set(p.month, (counts.get(p.month) || 0) + 1));
    const fullest = Math.max(...counts.values());
    const complete = MONTH_ORDER.filter((m) => (counts.get(m) || 0) >= fullest * 0.6);
    const refMonth = complete.length ? complete[complete.length - 1] : undefined;
    if (!refMonth) return out;

    const refDocs = inYear.filter((p) => p.month === refMonth);
    const docByName = new Map(refDocs.map((p) => [p.name, p]));
    const linesByParent = new Map<string, any[]>();
    for (const l of lines) {
      if (!docByName.has(l.parent)) continue;
      const arr = linesByParent.get(l.parent) || [];
      arr.push(l);
      linesByParent.set(l.parent, arr);
    }

    for (const doc of refDocs) {
      const ls = linesByParent.get(doc.name) || [];
      out.set(doc.employee, {
        month: refMonth,
        year: latestYear,
        totalPercent: Number(doc.total_allocation) || 0,
        projects: ls.map((l) => ({
          projectId: l.project || null,
          projectName: l.project_name || null,
          percent: Number(l.allocation_percent) || 0,
          bookedHours: Number(l.booked_hours) || 0,
          allowedHours: Number(l.allowed_hours) || 0,
        })).sort((a, b) => b.percent - a.percent),
      });
    }
    return out;
  }, force);
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

export interface QPeopleTimesheetEntry {
  employeeId: string;
  employeeName: string;
  date: string;          // YYYY-MM-DD — sheets are one per employee per day
  month: string;         // YYYY-MM
  hours: number;
  submitted: boolean;    // docstatus 1 = submitted, 0 = still a draft
}

/**
 * Per-day timesheet entries for one project, BOTH submitted and draft.
 *
 * Draft time is returned rather than filtered out, because submission lags
 * badly and the lag lands on exactly the projects people care about: 63% of
 * August 2026 hours were still draft, and 20 of the 147 projects with any
 * effort had nothing submitted at all — including every recently started one.
 * Excluding drafts made the feature look empty on new projects while real hours
 * sat in Q-People.
 *
 * The caller keeps the two apart so draft time is never passed off as firm:
 * cost is reported as a submitted figure plus a clearly-labelled provisional
 * one. Cancelled sheets (docstatus 2) are dropped outright.
 *
 * Note Frappe's separate workflow `status` field is NOT used — it disagrees
 * badly with docstatus, reading "Draft" on 81,267 sheets.
 */
export async function fetchTimesheetEntries(projectId: string, force = false)
  : Promise<QPeopleTimesheetEntry[]> {
  return cached(`ts-entries:${projectId}`, async () => {
    const rows = await list<any>('Timesheet', [
      'name', 'employee', 'employee_name', 'start_date', 'end_date',
      'total_hours', 'docstatus',
    ], [['parent_project', '=', projectId], ['docstatus', '!=', 2]]);

    return rows
      .filter((r) => r.start_date && Number(r.total_hours) > 0)
      .map((r) => ({
        employeeId: r.employee,
        employeeName: r.employee_name || r.employee,
        date: String(r.start_date).slice(0, 10),
        month: String(r.start_date).slice(0, 7),
        hours: Number(r.total_hours) || 0,
        submitted: r.docstatus === 1,
      }));
  }, force);
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

export interface EmployeeMatch {
  employee: QPeopleEmployee;
  /** Committed split for the reference month; null when Q-People has no record. */
  commitment: EmployeeCommitment | null;
  projectCount: number;
  experienceMatches: boolean;    // false when the band is missed OR experience is unknown
  experienceKnown: boolean;
  /** The candidate's own band, derived from their fractional years. */
  experienceBandKey: ExperienceBandKey | null;
  experienceBandLabel: string | null;
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
  commitment: Map<string, EmployeeCommitment>,
): EmployeeMatch[] {
  const want = skillKey(skill);
  if (!want) return [];
  const wantBand = canonicalBandKey(experienceBand);

  return employees
    .filter((e) => e.status === 'Active' && skillKey(e.skillsetGom) === want)
    .map((e) => {
      const c = commitment.get(e.id) || null;
      // Prefer the numeric years — 4.17 places precisely on the ladder. Fall
      // back to the band the HR workbook recorded when years are missing.
      const ownBand = bandForYears(e.experienceYears)
        ?? canonicalBandKey(e.experienceBandFallback);
      const known = ownBand !== null;
      // Band-to-band comparison, not a range test: it makes a boundary value
      // land in exactly one band instead of satisfying two adjacent ones.
      const fits = wantBand ? ownBand === wantBand : true;
      return {
        employee: e,
        commitment: c,
        projectCount: c ? c.projects.length : 0,
        experienceMatches: fits,
        experienceKnown: known,
        experienceBandKey: ownBand,
        experienceBandLabel: bandLabel(ownBand),
      };
    })
    .sort((a, b) => {
      // Band matches first, then the least thinly-spread people.
      if (a.experienceMatches !== b.experienceMatches) return a.experienceMatches ? -1 : 1;
      return a.projectCount - b.projectCount;
    });
}

// ── Resolved employees (Q-People + temporary Excel overlay) ─────────────────

/**
 * Q-People is the system of record, but its custom_skillset_gom is unpopulated
 * today, so the HR "Associate Mapping" workbook fills the gap via
 * associate_skill_overrides. Precedence is deliberate and one-way:
 *
 *   skillset / experience from Q-People  ->  used whenever present
 *   otherwise                            ->  taken from the override table
 *
 * So each employee flips to the real source the moment HR tags them, with no
 * code change and no re-import; once every employee is tagged the override
 * table stops being read at all.
 */
export async function getEmployeesResolved(force = false): Promise<QPeopleEmployee[]> {
  const [employees, overrides] = await Promise.all([
    fetchEmployees(force),
    prisma.associateSkillOverride.findMany().catch(() => []),
  ]);
  const byId = new Map(overrides.map((o) => [o.employeeId, o]));

  return employees.map((e) => {
    const o = byId.get(e.id);
    if (!o) return e;
    return {
      ...e,
      skillsetGom: e.skillsetGom || o.skillset || null,
      experienceYears: e.experienceYears !== null ? e.experienceYears : (o.experienceYears ?? null),
      // The workbook also carries a band directly; keep it for display when the
      // numeric years are missing on both sides.
      experienceBandFallback: o.experienceBand || null,
    } as QPeopleEmployee;
  });
}

/**
 * Why a match list is empty — and which source is currently carrying it.
 * Without this the UI cannot tell "nobody has that skill" from "nobody has been
 * tagged at all", and the second was the situation before the workbook import.
 */
export async function skillsetCoverage(force = false) {
  const [raw, overrides] = await Promise.all([
    fetchEmployees(force),
    prisma.associateSkillOverride.findMany().catch(() => []),
  ]);
  const resolved = await getEmployeesResolved(force);

  const active = resolved.filter((e) => e.status === 'Active');
  const tagged = active.filter((e) => !!e.skillsetGom);
  const fromQPeople = raw.filter((e) => e.status === 'Active' && !!e.skillsetGom).length;

  return {
    activeEmployees: active.length,
    taggedWithSkillset: tagged.length,
    taggedInQPeople: fromQPeople,
    taggedFromOverride: Math.max(0, tagged.length - fromQPeople),
    overrideRows: overrides.length,
    withExperience: active.filter((e) => e.experienceYears !== null).length,
    ready: tagged.length > 0,
  };
}
