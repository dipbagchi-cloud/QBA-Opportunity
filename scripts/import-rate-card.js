#!/usr/bin/env node
/**
 * Replace the active rate card with a new one from the cost-card spreadsheet.
 *
 * The old rows are ARCHIVED, never deleted. That is what keeps existing deals
 * intact: a saved resource row stores its own annualCTC, dailyCost and
 * dailyRate, and only re-reads the rate card when someone edits that row. The
 * archived rows also keep the history readable — a deal quoted last year can
 * still be traced to the card it was quoted from.
 *
 * Usage:
 *   node import-rate-card.js <file.xlsx> [--sheet NAME]        # dry run
 *   node import-rate-card.js <file.xlsx> [--sheet NAME] --apply
 *
 * Expected columns (header row 1):
 *   #, Vertical, Domain, Skillset, Level, Relevant Exp, Annual CTC
 *
 * Mapping, as agreed:
 *   Vertical      → ignored
 *   Domain        → role
 *   Skillset      → skill
 *   Level         → level          (new column, L2..L8)
 *   Relevant Exp  → experienceBand, with the "04) " ordering prefix stripped
 *   Annual CTC    → ctc
 *   every other CTC column → 0
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FILE = args.find(a => !a.startsWith('--'));
const SHEET = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;

/** "04) 8 - 12 Years" → "8 - 12 Years". The ordering prefix is for sorting a
 *  spreadsheet, not something anyone wants to read in a picker. */
function cleanBand(raw) {
    return String(raw || '').replace(/^\s*\d+\s*\)\s*/, '').replace(/\s+/g, ' ').trim();
}

/** A code that identifies the row and cannot collide with the old scheme.
 *  The old codes look like "AI-ML_08-12"; these carry the level, so an old
 *  deal's code can never silently resolve to a new — and different — rate. */
function makeCode(role, skill, level) {
    const slug = (s) => String(s || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 28);
    return [slug(role), slug(skill), String(level || '').toUpperCase()].filter(Boolean).join('_');
}

async function main() {
    if (!FILE || !fs.existsSync(FILE)) {
        console.error(`Spreadsheet not found: ${FILE || '(no file given)'}`);
        process.exitCode = 1;
        return;
    }

    const wb = XLSX.readFile(FILE);
    const sheetName = SHEET || wb.SheetNames[0];
    if (!wb.Sheets[sheetName]) {
        console.error(`No sheet "${sheetName}". Available: ${wb.SheetNames.join(', ')}`);
        process.exitCode = 1;
        return;
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

    // Headers are matched by prefix, case-insensitively. The experience column
    // is actually called "Relevant Exp (And not total experience)", and an exact
    // match silently produced 323 rows with no experience band at all — the
    // import looked successful and the data was wrong.
    const headers = Object.keys(rows[0] || {});
    const column = (want) => {
        const hit = headers.find(h => h.toLowerCase().trim().startsWith(want.toLowerCase()));
        if (!hit) throw new Error(`No column starting with "${want}". Found: ${headers.join(' | ')}`);
        return hit;
    };
    const COL = {
        domain: column('Domain'),
        skillset: column('Skillset'),
        level: column('Level'),
        exp: column('Relevant Exp'),
        ctc: column('Annual CTC'),
    };
    console.log('  columns matched     : ' + Object.entries(COL).map(([k, v]) => `${k}="${v}"`).join(', '));

    const parsed = [];
    const skipped = [];
    const seen = new Map();

    for (const [i, row] of rows.entries()) {
        const line = i + 2;   // +1 for the header, +1 for 1-based rows
        const role = String(row[COL.domain] || '').trim();
        const skill = String(row[COL.skillset] || '').trim();
        const level = String(row[COL.level] || '').trim();
        const band = cleanBand(row[COL.exp]);
        const ctcRaw = row[COL.ctc];
        const ctc = typeof ctcRaw === 'number' ? ctcRaw : Number(String(ctcRaw || '').replace(/[^0-9.]/g, ''));

        if (!skill || !level || !band || !Number.isFinite(ctc) || ctc <= 0) {
            skipped.push(`row ${line}: skill="${skill}" level="${level}" band="${band}" ctc="${ctcRaw}"`);
            continue;
        }

        const code = makeCode(role, skill, level);
        if (seen.has(code)) {
            // Two rows claiming one code would silently drop one of them.
            skipped.push(`row ${line}: duplicate code ${code} (first seen at row ${seen.get(code)})`);
            continue;
        }
        seen.set(code, line);

        parsed.push({
            code,
            role: role || skill,
            skill,
            level,
            experienceBand: band,
            category: 'Technology',
            // One annual figure per row in this card; every other cost column is
            // zero by instruction. A location the card does not price therefore
            // costs zero, deliberately — it is not silently charged at the
            // India rate.
            ctc: Math.round(ctc),
            masterCtc: 0, mercerCtc: 0, copilot: 0, existingCtc: 0, maxCtc: 0,
            ctcHyd: 0, ctcPune: 0, ctcNigeriaLagos: 0, ctcLuxembourg: 0,
            isActive: true,
        });
    }

    const existing = await prisma.rateCard.findMany();
    const activeNow = existing.filter(r => r.isActive).length;
    const collisions = parsed.filter(p => existing.some(e => e.code === p.code));

    console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — rate card import from ${path.basename(FILE)} [${sheetName}]`);
    console.log(`  rows read           : ${rows.length}`);
    console.log(`  usable              : ${parsed.length}`);
    console.log(`  skipped             : ${skipped.length}`);
    skipped.slice(0, 10).forEach(s => console.log(`      ${s}`));
    console.log(`  existing rows       : ${existing.length} (${activeNow} active → all will be archived)`);
    console.log(`  code collisions     : ${collisions.length}${collisions.length ? ' ← these would overwrite: ' + collisions.slice(0, 5).map(c => c.code).join(', ') : ''}`);
    console.log('  sample of the new card:');
    parsed.slice(0, 3).forEach(p =>
        console.log(`      ${p.code}  role=${p.role} | skill=${p.skill} | ${p.level} | ${p.experienceBand} | ctc=${p.ctc.toLocaleString()}`));

    if (!parsed.length) {
        console.error('\nNothing usable in that sheet — check the column headers.');
        process.exitCode = 1;
        return;
    }

    if (!APPLY) {
        console.log('\nNothing changed. Re-run with --apply to import.');
        return;
    }

    // Backup before anything, so the previous card can be restored in full.
    const backupFile = path.join(__dirname, `rate-card-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), rows: existing }, null, 2));
    console.log(`\n  backup written      : ${backupFile} (${existing.length} rows)`);

    const archived = await prisma.rateCard.updateMany({ where: { isActive: true }, data: { isActive: false } });
    console.log(`  archived            : ${archived.count}`);

    let created = 0, updated = 0;
    for (const row of parsed) {
        const existingRow = existing.find(e => e.code === row.code);
        if (existingRow) {
            await prisma.rateCard.update({ where: { code: row.code }, data: row });
            updated++;
        } else {
            await prisma.rateCard.create({ data: row });
            created++;
        }
    }
    console.log(`  created             : ${created}`);
    console.log(`  updated in place    : ${updated}`);

    const nowActive = await prisma.rateCard.count({ where: { isActive: true } });
    const nowArchived = await prisma.rateCard.count({ where: { isActive: false } });
    console.log(`\n  verification — active: ${nowActive}, archived: ${nowArchived}`);
    if (nowActive !== parsed.length) {
        console.error(`  WARNING: expected ${parsed.length} active rows, found ${nowActive}`);
        process.exitCode = 1;
    }
}

main()
    .catch(e => { console.error('FAILED:', e.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
