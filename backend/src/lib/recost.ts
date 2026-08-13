import { prisma } from './prisma';
import { calculateRateCard, BudgetAssumptions } from './gom-calculator';

/**
 * Re-price a deal's resources against the rate card in force today.
 *
 * Deals are quoted from a snapshot: each saved resource keeps its own
 * annualCTC, dailyCost and dailyRate, and the live card is only consulted when
 * someone edits that row. That is deliberate — a signed quote must not change
 * because the cost card did.
 *
 * Re-estimation is the one moment the business asks for the opposite: the deal
 * is being priced again, so it should be priced on today's card.
 *
 * Rows are matched by skill and experience band rather than by code, because
 * the codes changed with the new card. A row that matches nothing is LEFT
 * ALONE and reported: quietly dropping a resource, or costing it at zero,
 * would be worse than leaving a figure the estimator can see and correct.
 */

/** Bands are written differently across cards — ">15", "15+ Years", "08-12",
 *  "8 - 12 Years". Comparing the numbers in them survives the rewording. */
function bandKey(raw: string): string {
    const digits = String(raw || '').match(/\d+/g);
    if (!digits || !digits.length) return '';
    if (/\+|>|above|more/i.test(String(raw))) return `${Number(digits[0])}+`;
    if (digits.length === 1) return String(Number(digits[0]));
    return `${Number(digits[0])}-${Number(digits[1])}`;
}

function normaliseSkill(raw: string): string {
    return String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export interface RecostChange {
    resource: string;
    skill: string;
    band: string;
    from: number;
    to: number;
}

export interface RecostResult {
    changed: RecostChange[];
    unmatched: { resource: string; skill: string; band: string }[];
    total: number;
}

export async function recostOpportunityResources(opportunityId: string): Promise<RecostResult | null> {
    const opp = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, presalesData: true },
    });
    const presales = opp?.presalesData as any;
    const resources = presales?.resources;
    if (!Array.isArray(resources) || !resources.length) return null;

    const [cards, config] = await Promise.all([
        prisma.rateCard.findMany({ where: { isActive: true } }),
        prisma.systemConfig.findUnique({ where: { key: 'budget_assumptions' } }),
    ]);
    if (!cards.length) return null;

    const assumptions = (config?.value || {}) as BudgetAssumptions;
    const markupPercent = Number(presales?.markupPercent) || 0;

    const changed: RecostChange[] = [];
    const unmatched: RecostResult['unmatched'] = [];

    const updated = resources.map((row: any) => {
        const skillKey = normaliseSkill(row.skill);
        const wantBand = bandKey(row.experienceBand);
        const match = cards.find(c => normaliseSkill(c.skill) === skillKey && bandKey(c.experienceBand) === wantBand)
            // A level is as good as a band when the band wording has drifted.
            || cards.find(c => normaliseSkill(c.skill) === skillKey && (c as any).level && (c as any).level === row.level);

        if (!match) {
            unmatched.push({ resource: row.role || row.skill || row.id, skill: row.skill, band: row.experienceBand });
            return row;
        }

        const ctc = Number(match.ctc) || 0;
        if (!ctc || ctc === Number(row.annualCTC)) return row;

        const costed = calculateRateCard({ annualCtc: ctc, monthsPerYear: 12, ...assumptions });
        changed.push({
            resource: row.role || row.skill || row.id,
            skill: row.skill,
            band: row.experienceBand,
            from: Number(row.annualCTC) || 0,
            to: ctc,
        });
        return {
            ...row,
            rateCardCode: match.code,
            annualCTC: ctc,
            dailyCost: costed.dailyCost,
            dailyRate: costed.dailyCost * (1 + markupPercent / 100),
        };
    });

    if (!changed.length) return { changed, unmatched, total: resources.length };

    await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { presalesData: { ...presales, resources: updated } },
    });

    return { changed, unmatched, total: resources.length };
}
