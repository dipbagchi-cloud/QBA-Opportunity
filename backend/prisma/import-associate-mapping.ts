/**
 * Import the HR "Associate Mapping" workbook into associate_skill_overrides.
 *
 * TEMPORARY bridge while Q-People's Employee.custom_skillset_gom is unpopulated.
 * Q-People always wins where it has a value (see getEmployeesResolved), so this
 * import only fills gaps and can be re-run safely — it upserts on employeeId.
 *
 *   npx ts-node prisma/import-associate-mapping.ts "<path to .xlsx>"
 *
 * Expected sheet: "Associate Mapping", with at least ID / Full Name / Status /
 * Skillset / Exp Band (Total Relevant Exp Based) / Total Experience.
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SHEET = 'Associate Mapping';

/** "3 Years, 6 Months" -> 3.5 ; "0 Years, 7 Months" -> 0.58 ; blank -> null */
function parseYears(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const y = s.match(/(\d+)\s*Years?/i);
  const m = s.match(/(\d+)\s*Months?/i);
  if (!y && !m) {
    const plain = Number(s);
    return Number.isFinite(plain) ? plain : null;
  }
  const years = y ? Number(y[1]) : 0;
  const months = m ? Number(m[1]) : 0;
  return Math.round((years + months / 12) * 100) / 100;
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s && s.toLowerCase() !== 'nan' ? s : null;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: ts-node prisma/import-associate-mapping.ts "<path to .xlsx>"');
    process.exit(1);
  }

  const wb = XLSX.readFile(file);
  if (!wb.SheetNames.includes(SHEET)) {
    console.error(`Sheet "${SHEET}" not found. Sheets: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { defval: null });
  console.log(`Read ${rows.length} rows from "${SHEET}"`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let withSkillset = 0;

  for (const r of rows) {
    const employeeId = clean(r['ID']);
    if (!employeeId) { skipped++; continue; }

    const skillset = clean(r['Skillset']);
    if (skillset) withSkillset++;

    const data = {
      employeeName: clean(r['Full Name']),
      skillset,
      experienceBand: clean(r['Exp Band (Total Relevant Exp Based)']),
      experienceYears: parseYears(r['Total Experience']),
      domain: clean(r['Domain']),
      jobLevel: clean(r['Current Job Level']),
      status: clean(r['Status']),
      source: 'excel',
      importedAt: new Date(),
    };

    const existing = await prisma.associateSkillOverride.findUnique({ where: { employeeId } });
    if (existing) {
      await prisma.associateSkillOverride.update({ where: { employeeId }, data });
      updated++;
    } else {
      await prisma.associateSkillOverride.create({ data: { employeeId, ...data } });
      created++;
    }
  }

  const distinctSkillsets = await prisma.associateSkillOverride.findMany({
    where: { skillset: { not: null } },
    select: { skillset: true },
    distinct: ['skillset'],
  });

  console.log('');
  console.log(`  created            ${created}`);
  console.log(`  updated            ${updated}`);
  console.log(`  skipped (no ID)    ${skipped}`);
  console.log(`  rows with skillset ${withSkillset}`);
  console.log(`  distinct skillsets ${distinctSkillsets.length}`);
  console.log('');
  console.log('Q-People still wins wherever custom_skillset_gom is set — this only fills gaps.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
