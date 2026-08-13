import fs from 'fs';
import path from 'path';

/**
 * Remembers how questions were interpreted, so the same shape of question does
 * not pay for a model call twice.
 *
 * What is stored is the INTERPRETATION, never the answer: "group by client,
 * outcome won, entity 'Kantech'". The numbers are always fetched fresh from the
 * database on every question, so a remembered phrasing can never serve a stale
 * figure — which is the trap with caching a chatbot, and the reason this cache
 * is safe to keep for weeks.
 *
 * It is also why an entity is remembered as the WORD the user typed rather than
 * the row it resolved to. Names change; the language people use for them does
 * not. The word is re-matched against master data on every use.
 *
 * Matching is by meaningful words, ignoring order and filler. "revenue by
 * client", "client wise revenue" and "show me the revenue per client please"
 * all reduce to {client, revenue} and share one entry.
 */

interface Remembered {
    /** The model's reading of the question — dimensions and filters, no data. */
    slots: Record<string, any>;
    /** The words that identify this phrasing, for similarity matching. */
    tokens: string[];
    /** An example of the phrasing, kept for the stats view only. */
    example: string;
    hits: number;
    createdAt: number;
    lastUsedAt: number;
}

// Words that carry no meaning for what is being asked. Stripping them is what
// lets "show me the top clients please" match "top clients".
const FILLER = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did',
    'i', 'me', 'my', 'we', 'our', 'us', 'you', 'your', 'it', 'its', 'they', 'them', 'their',
    'show', 'give', 'tell', 'get', 'list', 'display', 'please', 'can', 'could', 'would',
    'want', 'need', 'like', 'see', 'know', 'find', 'let', 'make', 'have', 'has', 'had',
    'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'with', 'from', 'as', 'that', 'this',
    'what', 'whats', 'right', 'now', 'currently', 'just', 'about', 'all', 'any', 'some',
    // Interrogatives carry grammar, not subject matter. Leaving them in split
    // "which industries are we strongest in" from "show me the industries we are
    // strongest in" — the same question, remembered twice.
    'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
    'up', 'out', 'so', 'if', 'then', 'there', 'here', 'much', 'many',
]);

const MAX_ENTRIES = 2000;
const TTL_MS = 60 * 24 * 3600 * 1000;    // 60 days
const SIMILARITY_FLOOR = 0.75;
const MIN_TOKENS = 2;

/**
 * Bumped when the meaning of a slot changes. Remembered readings were produced
 * by the old rules and may no longer mean the same thing, so they are dropped
 * rather than silently reinterpreted.
 */
const SCHEMA_VERSION = 1;

const store = new Map<string, Remembered>();
let stats = { hits: 0, nearHits: 0, misses: 0 };
let dirty = false;
let saveTimer: NodeJS.Timeout | null = null;

const CACHE_FILE = process.env.PHRASE_MEMORY_FILE
    || path.join(process.cwd(), 'data', 'chat-phrase-memory.json');

/** The meaningful words of a question, deduplicated and ordered. */
export function tokenize(message: string): string[] {
    const words = (message || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !FILLER.has(w));
    return [...new Set(words)].sort();
}

/** Exact key for a phrasing — order and filler already discarded. */
function keyOf(tokens: string[]): string {
    return tokens.join(' ');
}

/** How much two questions overlap, 0 to 1 (intersection over union). */
function similarity(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const setB = new Set(b);
    let shared = 0;
    for (const t of a) if (setB.has(t)) shared++;
    return shared / (a.length + b.length - shared);
}

/**
 * Has a question of this shape been interpreted before?
 *
 * Tries the exact phrasing first, then the closest thing above the similarity
 * floor. Returns a copy, so a caller mutating its filters cannot corrupt what
 * is remembered for everyone else.
 */
export function recall(message: string): { slots: Record<string, any>; via: 'exact' | 'similar'; example: string } | null {
    const tokens = tokenize(message);
    if (tokens.length < MIN_TOKENS) return null;

    const exact = store.get(keyOf(tokens));
    if (exact && Date.now() - exact.createdAt < TTL_MS) {
        exact.hits++;
        exact.lastUsedAt = Date.now();
        stats.hits++;
        dirty = true;
        return { slots: { ...exact.slots }, via: 'exact', example: exact.example };
    }

    let best: Remembered | null = null;
    let bestScore = 0;
    for (const entry of store.values()) {
        if (Date.now() - entry.createdAt >= TTL_MS) continue;
        const score = similarity(tokens, entry.tokens);
        if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (best && bestScore >= SIMILARITY_FLOOR) {
        best.hits++;
        best.lastUsedAt = Date.now();
        stats.nearHits++;
        dirty = true;
        return { slots: { ...best.slots }, via: 'similar', example: best.example };
    }

    stats.misses++;
    return null;
}

/** Remember how a question was read. Only worth storing if it read as something. */
export function remember(message: string, slots: Record<string, any>): void {
    const tokens = tokenize(message);
    if (tokens.length < MIN_TOKENS) return;
    if (!slots || (!slots.groupBy && !slots.__entityHint && !slots.outcome)) return;

    store.set(keyOf(tokens), {
        slots: { ...slots },
        tokens,
        example: message.slice(0, 120),
        hits: 0,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
    });

    // Evict the least recently used once full, so a busy day cannot grow this
    // without bound on a box that is already short of memory.
    if (store.size > MAX_ENTRIES) {
        const oldest = [...store.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
        for (let i = 0; i < oldest.length - MAX_ENTRIES; i++) store.delete(oldest[i][0]);
    }
    dirty = true;
    scheduleSave();
}

export function memoryStats() {
    const total = stats.hits + stats.nearHits + stats.misses;
    return {
        entries: store.size,
        ...stats,
        hitRate: total ? Number(((stats.hits + stats.nearHits) / total * 100).toFixed(1)) : 0,
        top: [...store.values()].sort((a, b) => b.hits - a.hits).slice(0, 10)
            .map(e => ({ example: e.example, hits: e.hits, groupBy: e.slots.groupBy || '-' })),
    };
}

// ─── Persistence ────────────────────────────────────────────────────────────
//
// Kept on disk because it is worth nothing if it empties on every deploy, and
// this backend restarts often. Written on a timer rather than per question, so
// a burst of chat does not become a burst of writes.

function scheduleSave(): void {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; save(); }, 5000);
    saveTimer.unref?.();
}

export function save(): void {
    if (!dirty) return;
    try {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        const payload = {
            schemaVersion: SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            entries: [...store.entries()].map(([key, value]) => ({ key, ...value })),
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
        dirty = false;
    } catch (error) {
        console.error('[PhraseMemory] could not save:', (error as Error).message);
    }
}

export function load(): void {
    try {
        if (!fs.existsSync(CACHE_FILE)) return;
        const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (parsed?.schemaVersion !== SCHEMA_VERSION) {
            console.log('[PhraseMemory] schema changed — starting fresh');
            return;
        }
        const now = Date.now();
        for (const e of parsed.entries || []) {
            if (!e?.key || !e.slots || !Array.isArray(e.tokens)) continue;
            if (now - (e.createdAt || 0) >= TTL_MS) continue;
            store.set(e.key, {
                slots: e.slots, tokens: e.tokens, example: e.example || '',
                hits: e.hits || 0, createdAt: e.createdAt || now, lastUsedAt: e.lastUsedAt || now,
            });
        }
        console.log(`[PhraseMemory] loaded ${store.size} remembered phrasings`);
    } catch (error) {
        console.error('[PhraseMemory] could not load:', (error as Error).message);
    }
}

load();
process.on('beforeExit', save);
