import { prisma } from './prisma';

/**
 * Record that an opportunity has entered a stage.
 *
 * Closes the currently-open history row — stamping `exitedAt` and the hours
 * spent in it — then opens a new one for the stage just entered.
 *
 * **Why this exists:** `stage_history` was written by the chatbot only, and
 * even there just as a bare `create` with no `exitedAt`. Every stage move made
 * through the UI (Move to Presales / Sales, Proposal Sent, Mark Lost, Send
 * for Re-estimate, Convert to Project), through lead conversion, and through
 * the start-date auto-revert job wrote nothing at all — so the table sat
 * completely empty and anything reading it (stage durations, SLA/aging
 * reporting, the detail page's stage timeline) silently saw zero rows.
 * Routing every stage write through this one function is what keeps it
 * populated and consistent.
 *
 * Calling it when the deal is already in `stageId` is a no-op, so callers do
 * not have to pre-check whether the stage really changed.
 *
 * Best-effort by design: stage history is a reporting artefact, so a failure
 * here is logged and swallowed rather than failing the transition the user
 * just performed.
 */
export async function recordStageEntry(
    opportunityId: string,
    stageId: string | null | undefined,
    at: Date = new Date(),
): Promise<void> {
    if (!opportunityId || !stageId) return;
    try {
        const latest = await prisma.stageHistory.findFirst({
            where: { opportunityId },
            orderBy: { enteredAt: 'desc' },
        });

        // Already sitting in this stage — nothing to record.
        if (latest && latest.stageId === stageId && latest.exitedAt == null) return;

        if (latest && latest.exitedAt == null) {
            const enteredAt = new Date(latest.enteredAt).getTime();
            await prisma.stageHistory.update({
                where: { id: latest.id },
                data: {
                    exitedAt: at,
                    durationHours: Math.max(0, Math.round((at.getTime() - enteredAt) / 3600000)),
                },
            });
        }

        await prisma.stageHistory.create({
            data: { opportunityId, stageId, enteredAt: at },
        });
    } catch (error) {
        console.error('[stage-history] failed to record stage entry', { opportunityId, stageId, error });
    }
}
