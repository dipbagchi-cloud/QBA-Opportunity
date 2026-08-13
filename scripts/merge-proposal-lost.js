#!/usr/bin/env node
/**
 * Merge the "Proposal Lost" stage into "Closed Lost".
 *
 * The two were duplicates — same isClosed, isWon and probability — and every
 * report in the app already treated them identically (`stage === 'Closed Lost'
 * || stage === 'Proposal Lost'` throughout). "Proposal Lost" was also
 * unreachable through normal pipeline movement: no stage listed it in
 * allowedNextStages, so deals only landed there via a dedicated button.
 *
 * What this does, in order:
 *   1. writes a backup of every affected row BEFORE touching anything,
 *   2. records on each deal, as a note, that it was lost after a proposal —
 *      merging the stages would otherwise silently destroy that fact,
 *   3. moves those deals to Closed Lost,
 *   4. deletes the now-unreachable notification rule and the stage itself.
 *
 * Usage:
 *   node merge-proposal-lost.js            # dry run — reports, changes nothing
 *   node merge-proposal-lost.js --apply    # performs the merge
 *
 * Reversing it: the backup file lists each opportunity id with its original
 * stage, so the moves can be undone by id. Re-creating the stage row itself
 * needs `{ name: 'Proposal Lost', order: 7, probability: 0, color: '#e11d48',
 * isClosed: true, isWon: false }`.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const FROM = 'Proposal Lost';
const TO = 'Closed Lost';

async function main() {
    const from = await prisma.stage.findFirst({ where: { name: FROM } });
    if (!from) {
        console.log(`Stage "${FROM}" does not exist here — nothing to do.`);
        return;
    }
    const to = await prisma.stage.findFirst({ where: { name: TO } });
    if (!to) throw new Error(`Target stage "${TO}" not found — refusing to continue.`);

    const opps = await prisma.opportunity.findMany({
        where: { stageId: from.id },
        select: { id: true, title: true, client: { select: { name: true } }, updatedAt: true },
    });
    const rules = await prisma.notificationRule.findMany({ where: { toStage: FROM } });
    const history = await prisma.stageHistory.count({ where: { stageId: from.id } });

    console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — merge "${FROM}" into "${TO}"`);
    console.log(`  opportunities to move : ${opps.length}`);
    opps.forEach(o => console.log(`      ${o.id}  ${o.title}${o.client ? ' — ' + o.client.name : ''}`));
    console.log(`  stage history rows    : ${history}${history ? ' (will be repointed)' : ''}`);
    console.log(`  notification rules    : ${rules.length}`);
    rules.forEach(r => console.log(`      ${r.name}`));

    if (!APPLY) {
        console.log('\nNothing changed. Re-run with --apply to perform the merge.');
        return;
    }

    // 1. Backup first, so this is reversible even if a later step fails.
    const backup = {
        takenAt: new Date().toISOString(),
        database: (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@'),
        fromStage: from,
        toStageId: to.id,
        opportunities: opps,
        notificationRules: rules,
    };
    const file = path.join(__dirname, `proposal-lost-backup-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\n  backup written to ${file}`);

    // 2. Keep the fact that these were lost after a proposal went out.
    const author = await prisma.user.findFirst({
        where: { roles: { some: { name: 'Admin' } } }, select: { id: true },
    });
    if (author) {
        for (const o of opps) {
            await prisma.note.create({
                data: {
                    opportunityId: o.id,
                    authorId: author.id,
                    content: `Stage cleanup: this deal was previously in "Proposal Lost" (lost after a proposal was issued). That stage duplicated "Closed Lost" and has been merged into it; the deal is now Closed Lost.`,
                    mentions: '',
                    stage: 'Sales',
                },
            });
        }
        console.log(`  notes added           : ${opps.length}`);
    } else {
        console.log('  notes added           : 0 (no Admin user to attribute them to)');
    }

    // 3. Move the deals, then anything else still pointing at the stage.
    const moved = await prisma.opportunity.updateMany({ where: { stageId: from.id }, data: { stageId: to.id } });
    const movedHistory = await prisma.stageHistory.updateMany({ where: { stageId: from.id }, data: { stageId: to.id } });
    console.log(`  opportunities moved   : ${moved.count}`);
    console.log(`  history rows moved    : ${movedHistory.count}`);

    // 4. The rule can never fire again once the stage is gone.
    if (rules.length) {
        const del = await prisma.notificationRule.deleteMany({ where: { toStage: FROM } });
        console.log(`  rules deleted         : ${del.count}`);
    }

    await prisma.stage.delete({ where: { id: from.id } });
    console.log(`  stage deleted         : ${FROM}`);

    const leftover = await prisma.opportunity.count({ where: { stage: { name: FROM } } });
    console.log(`\n  verification — opportunities still in "${FROM}": ${leftover}`);
}

main()
    .catch(e => { console.error('FAILED:', e.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
