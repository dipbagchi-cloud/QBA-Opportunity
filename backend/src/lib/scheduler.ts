import {
  evaluateStaleOpportunityReminders,
  evaluateStartDateApproachingReminders,
  evaluateStartDateOverdueWorkflow,
} from './notification-engine';

// Process-wide guard so we never start the scheduler twice if this module is
// imported more than once (e.g. ts-node-dev hot reload).
let started = false;

/**
 * Time-driven job registry. Every entry binds a NotificationRule.triggerType
 * value to its evaluator. To add a new time-driven category:
 *   1. Implement an evaluator in notification-engine.ts that reads its own
 *      active rules (isActive=true, triggerType=<X>) and is a no-op when none.
 *   2. Append it here.
 *   3. Seed (or let admin create) the EmailTemplate + NotificationRule for
 *      that triggerType.
 * No code changes are needed to add/remove instances of an existing
 * triggerType — admins manage those in Settings -> Notifications.
 */
const TIME_DRIVEN_JOBS: { triggerType: string; evaluator: () => Promise<unknown> }[] = [
  { triggerType: 'stalled_deal', evaluator: evaluateStaleOpportunityReminders },
  { triggerType: 'start_date_approaching', evaluator: evaluateStartDateApproachingReminders },
  // start_date_overdue runs AFTER start_date_approaching so a deal that
  // crosses today on the same day the scheduler fires is handled once as
  // overdue (not twice — first as approaching, then as overdue).
  { triggerType: 'start_date_overdue', evaluator: evaluateStartDateOverdueWorkflow },
];

/**
 * Parse "HH:MM" (24-hour, server local time) into {hours, minutes}.
 * Falls back to 09:00 if invalid.
 */
function parseTimeOfDay(raw: string | undefined): { hours: number; minutes: number } {
  const m = (raw || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hours: 9, minutes: 0 };
  const hours = Math.min(23, Math.max(0, Number(m[1])));
  const minutes = Math.min(59, Math.max(0, Number(m[2])));
  return { hours, minutes };
}

/**
 * Compute the next absolute Date that lands on the given local HH:MM. If the
 * target time has already passed today, return that same time tomorrow.
 */
function nextOccurrence(hours: number, minutes: number, now: Date = new Date()): Date {
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Schedule `task` to fire every day at the given local HH:MM, surviving server
 * restarts (the next run is always anchored to wall-clock time, not to boot
 * time). Re-schedules itself after every run, so any clock drift or DST shift
 * gets corrected on the next tick.
 */
function scheduleDailyAt(label: string, hours: number, minutes: number, task: () => Promise<void> | void): void {
  const scheduleNext = () => {
    const next = nextOccurrence(hours, minutes);
    const delayMs = Math.max(1000, next.getTime() - Date.now());
    console.log(`[Scheduler] ${label}: next run at ${next.toISOString()} (in ${Math.round(delayMs / 60000)} min)`);
    setTimeout(async () => {
      const startedAt = new Date();
      console.log(`[Scheduler] ${label}: firing at ${startedAt.toISOString()}`);
      try {
        await task();
      } catch (err) {
        console.error(`[Scheduler] ${label}: task failed`, err);
      }
      // Always schedule the next occurrence — independent of how the task ended.
      scheduleNext();
    }, delayMs);
  };
  scheduleNext();
}

export function startScheduledJobs(): void {
  if (started) return;
  started = true;

  // Master switch — disables the entire time-driven scheduler.
  const enabled = (process.env.TIME_DRIVEN_JOBS_ENABLED || process.env.STALE_REMINDER_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[Scheduler] time-driven jobs disabled via env');
    return;
  }

  // Single daily fire-time for all time-driven jobs. Per-job behaviour
  // (threshold, recipients, template, channels, enable/disable) lives in
  // NotificationRule rows managed by Admin > Notifications.
  const { hours, minutes } = parseTimeOfDay(
    process.env.TIME_DRIVEN_JOBS_DAILY_AT || process.env.STALE_REMINDER_DAILY_AT
  );
  const hhmm = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  scheduleDailyAt('time-driven-jobs', hours, minutes, async () => {
    for (const job of TIME_DRIVEN_JOBS) {
      try {
        console.log(`[Scheduler] running job triggerType=${job.triggerType}`);
        await job.evaluator();
      } catch (err) {
        console.error(`[Scheduler] job triggerType=${job.triggerType} failed:`, err);
      }
    }
  });

  console.log(
    `[Scheduler] time-driven jobs armed: daily-at=${hhmm} (server local) — ${TIME_DRIVEN_JOBS.length} job(s) registered: ${TIME_DRIVEN_JOBS.map(j => j.triggerType).join(', ')}`
  );
}
