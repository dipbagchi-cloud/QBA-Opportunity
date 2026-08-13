import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import * as chrono from 'chrono-node';
import { recordStageEntry } from './stage-history';
import * as phraseMemory from './phrase-memory';

const prisma = new PrismaClient();

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    data?: any;
    actions?: ActionResult[];
    pendingFields?: string[];
}

export interface ActionResult {
    tool: string;
    success: boolean;
    summary: string;
    data?: any;
}

export interface UserContext {
    userId: string;
    email: string;
    roleName: string;
    permissions: string[];
    userName: string;
}

export interface ConversationState {
    mode: 'idle' | 'creating' | 'updating' | 'confirming' | 'confirming_extract' | 'creating_lead' | 'creating_contact';
    entityType?: 'opportunity' | 'lead' | 'contact';
    targetOpportunityId?: string;
    targetContactId?: string;
    collectedFields: Record<string, any>;
    missingRequired: string[];
    optionalRemaining: string[];
    history: { role: 'user' | 'assistant'; content: string }[];
    /**
     * Filters from the last data question, so a follow-up can inherit them.
     * "how many are open?" straight after a chart of AI/ML deals means the
     * AI/ML ones — without this the follow-up resolves to nothing and falls
     * back to the help menu.
     */
    lastFilters?: Record<string, any>;
    lastActivity: number;
}

// ─── CONVERSATION STATE STORE ────────────────────────────────────────────────

const conversations = new Map<string, ConversationState>();
const CONV_TTL = 30 * 60 * 1000;

function getConversation(userId: string): ConversationState {
    let c = conversations.get(userId);
    if (!c || Date.now() - c.lastActivity > CONV_TTL) {
        c = { mode: 'idle', entityType: undefined, collectedFields: {}, missingRequired: [], optionalRemaining: [], history: [], lastActivity: Date.now() };
        conversations.set(userId, c);
    }
    c.lastActivity = Date.now();
    return c;
}

function resetConversation(userId: string) {
    const c = getConversation(userId);
    c.mode = 'idle';
    c.entityType = undefined;
    c.targetOpportunityId = undefined;
    c.targetContactId = undefined;
    c.collectedFields = {};
    c.missingRequired = [];
    c.optionalRemaining = [];
}

// ─── MASTER DATA CACHE ──────────────────────────────────────────────────────

interface MasterDataCache {
    clients: { id: string; name: string }[];
    practices: { id: string; name: string }[];
    stages: { id: string; name: string; order: number; probability: number; isClosed: boolean; isWon: boolean }[];
    regions: { id: string; name: string }[];
    technologies: { id: string; name: string }[];
    pricingModels: { id: string; name: string }[];
    projectTypes: { id: string; name: string }[];
    salespersons: { id: string; name: string }[];
    currencies: { id: string; code: string; name: string; symbol: string }[];
    lastLoaded: number;
}

let _masterCache: MasterDataCache | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getMasterData(): Promise<MasterDataCache> {
    if (_masterCache && Date.now() - _masterCache.lastLoaded < CACHE_TTL) return _masterCache;
    const [clients, stages, regions, technologies, pricingModels, projectTypes, salespersons, currencies, practiceRows] = await Promise.all([
        prisma.client.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.stage.findMany({ select: { id: true, name: true, order: true, probability: true, isClosed: true, isWon: true }, orderBy: { order: 'asc' } }),
        prisma.region.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.technology.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.pricingModel.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.projectType.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.currencyRate.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, symbol: true }, orderBy: { code: 'asc' } }),
        // Practice is a free-text column rather than a lookup table, so the
        // vocabulary comes from the values actually in use. Without this the
        // bot could never match a practice at all — "ADM opportunities"
        // returned all 136 rows.
        prisma.opportunity.findMany({ where: { practice: { not: null } }, select: { practice: true }, distinct: ['practice'] }),
    ]);
    const practices = Array.from(new Set((practiceRows as any[]).map(r => (r.practice || '').trim()).filter(Boolean)))
        .map((name, i) => ({ id: `practice-${i}`, name }));
    _masterCache = { clients, stages, regions, technologies, pricingModels, projectTypes, salespersons, currencies, practices, lastLoaded: Date.now() };
    console.log(`[Chatbot] Master cache loaded: ${clients.length} clients, ${stages.length} stages, ${regions.length} regions, ${technologies.length} techs, ${pricingModels.length} pricing, ${projectTypes.length} projTypes, ${salespersons.length} users, ${currencies.length} currencies, ${practices.length} practices`);
    return _masterCache;
}

// ─── FUZZY MATCHING ─────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
}

interface MatchResult { exact: boolean; match: { id: string; name: string } | null; suggestions: string[]; }

function fuzzyMatch(input: string, items: { id: string; name: string }[], threshold: number = 0.4): MatchResult {
    const lower = input.toLowerCase().trim();
    if (!lower) return { exact: false, match: null, suggestions: [] };

    const exact = items.find(it => it.name.toLowerCase() === lower);
    if (exact) return { exact: true, match: exact, suggestions: [] };

    const startsWith = items.filter(it => it.name.toLowerCase().startsWith(lower));
    if (startsWith.length === 1) return { exact: true, match: startsWith[0], suggestions: [] };

    const contains = items.filter(it => it.name.toLowerCase().includes(lower) || lower.includes(it.name.toLowerCase()));
    if (contains.length === 1) return { exact: true, match: contains[0], suggestions: [] };

    const scored = items.map(it => {
        const dist = levenshtein(lower, it.name.toLowerCase());
        const maxLen = Math.max(lower.length, it.name.length);
        const similarity = 1 - dist / maxLen;
        return { item: it, similarity };
    }).filter(s => s.similarity > threshold).sort((a, b) => b.similarity - a.similarity);

    if (scored.length > 0 && scored[0].similarity > 0.8)
        return { exact: true, match: scored[0].item, suggestions: [] };

    const allSuggestions = scored.length > 0
        ? scored.slice(0, 5).map(s => s.item.name)
        : (startsWith.length > 0 ? startsWith : contains).slice(0, 5).map(it => it.name);

    return { exact: false, match: null, suggestions: allSuggestions.length > 0 ? allSuggestions : items.slice(0, 8).map(it => it.name) };
}

// ─── FIELD DEFINITIONS ──────────────────────────────────────────────────────

interface FieldDef {
    key: string;
    label: string;
    required: boolean;
    type: 'string' | 'number' | 'date' | 'select' | 'master' | 'masterCode' | 'json';
    masterKey?: keyof MasterDataCache;
    options?: string[];
    validate?: (v: any) => string | null;
    prompt: string;
    buildPrompt?: (master: MasterDataCache) => string;
}

const OPPORTUNITY_FIELDS: FieldDef[] = [
    { key: 'title', label: 'Title', required: true, type: 'string', prompt: 'What is the opportunity/project title?', validate: v => (!v || v.length < 2) ? 'Title must be at least 2 characters.' : null },
    { key: 'client', label: 'Client', required: true, type: 'master', masterKey: 'clients',
        prompt: 'Which client is this for?',
        buildPrompt: (m) => `Which client is this for?\nAvailable: ${m.clients.slice(0, 10).map(c => c.name).join(', ')}${m.clients.length > 10 ? ` (+${m.clients.length - 10} more)` : ''}` },
    { key: 'value', label: 'Deal Value', required: true, type: 'number', prompt: 'What is the deal value? (e.g., 500000 or 500K or 2M)', validate: v => (v === undefined || v === null || isNaN(Number(v)) || Number(v) < 0) ? 'Value must be a positive number.' : null },
    { key: 'currency', label: 'Currency', required: true, type: 'masterCode', masterKey: 'currencies',
        prompt: 'Which currency? (e.g., USD, EUR, INR)',
        buildPrompt: (m) => `Which currency?\nAvailable: ${m.currencies.map(c => c.code + ' (' + c.symbol + ')').join(', ')}` },
    { key: 'technology', label: 'Technology Stack', required: true, type: 'master', masterKey: 'technologies',
        prompt: 'What technology/stack?',
        buildPrompt: (m) => `What technology/stack?\nAvailable: ${m.technologies.map(t => t.name).join(', ')}` },
    { key: 'region', label: 'Region', required: true, type: 'master', masterKey: 'regions',
        prompt: 'Which region?',
        buildPrompt: (m) => `Which region?\nAvailable: ${m.regions.map(r => r.name).join(', ')}` },
    { key: 'description', label: 'Description', required: true, type: 'string', prompt: 'Brief description of the opportunity?' },
    { key: 'salesRepName', label: 'Sales Rep', required: true, type: 'master', masterKey: 'salespersons',
        prompt: 'Who is the sales representative?',
        buildPrompt: (m) => `Who is the sales representative?\nTeam: ${m.salespersons.slice(0, 10).map(s => s.name).join(', ')}${m.salespersons.length > 10 ? ` (+${m.salespersons.length - 10} more)` : ''}` },
    { key: 'pricingModel', label: 'Pricing Model', required: true, type: 'master', masterKey: 'pricingModels',
        prompt: 'Pricing model?',
        buildPrompt: (m) => `Pricing model?\nAvailable: ${m.pricingModels.map(p => p.name).join(', ')}` },
    { key: 'tentativeStartDate', label: 'Start Date', required: true, type: 'date', prompt: 'Tentative start date? (any format: "15 Jan 2026", "01/15/2026", "next month", etc.)' },
    { key: 'projectType', label: 'Project Type', required: false, type: 'master', masterKey: 'projectTypes',
        prompt: 'What type of project?',
        buildPrompt: (m) => `What type of project? (or "skip")\nAvailable: ${m.projectTypes.map(p => p.name).join(', ')}` },
    { key: 'practice', label: 'Practice', required: false, type: 'string', prompt: 'Which practice area? (e.g., Consulting, Development, Managed Services, or "skip")' },
    { key: 'managerName', label: 'Manager', required: false, type: 'master', masterKey: 'salespersons',
        prompt: 'Who is the presales/delivery manager?',
        buildPrompt: (m) => `Who is the presales/delivery manager? (or "skip")\nTeam: ${m.salespersons.slice(0, 10).map(s => s.name).join(', ')}${m.salespersons.length > 10 ? ` (+${m.salespersons.length - 10} more)` : ''}` },
    { key: 'tentativeDuration', label: 'Duration', required: false, type: 'string', prompt: 'Tentative duration? (e.g., "6 months", "12 weeks", or "skip")' },
    { key: 'expectedDayRate', label: 'Day Rate', required: false, type: 'number', prompt: 'Expected day rate? (number, or "skip")' },
    { key: 'source', label: 'Source', required: false, type: 'select', options: ['Direct', 'Referral', 'Partner', 'Website', 'Event', 'Cold Outreach', 'Inbound', 'Other'], prompt: 'Source of this opportunity? (Direct / Referral / Partner / Website / Event / Cold Outreach / Inbound / Other, or "skip")' },
    { key: 'priority', label: 'Priority', required: false, type: 'select', options: ['Low', 'Medium', 'High'], prompt: 'Priority level? (Low / Medium / High, or "skip")' },
    { key: 'tags', label: 'Tags', required: false, type: 'string', prompt: 'Any tags? (comma-separated, e.g., "enterprise, strategic, Q1", or "skip")' },
    { key: 'expectedCloseDate', label: 'Expected Close Date', required: false, type: 'date', prompt: 'Expected close date? (any format: "March 2026", "15/06/2026", etc., or "skip")' },
];

const UPDATABLE_FIELD_KEYS = [...OPPORTUNITY_FIELDS.map(f => f.key), 'stage'];

// ─── VALUE PARSING ──────────────────────────────────────────────────────────

function parseMoneyValue(text: string): number | null {
    const clean = text.replace(/[,$\s]/g, '').toLowerCase();
    const match = clean.match(/^([\d.]+)\s*(k|m|thousand|million|lakh|cr|crore)?$/);
    if (!match) return null;
    let v = parseFloat(match[1]);
    if (isNaN(v)) return null;
    const unit = match[2];
    if (unit === 'k' || unit === 'thousand') v *= 1000;
    else if (unit === 'm' || unit === 'million') v *= 1_000_000;
    else if (unit === 'lakh') v *= 100_000;
    else if (unit === 'cr' || unit === 'crore') v *= 10_000_000;
    return v;
}

function parseDate(text: string): string | null {
    const t = text.trim();
    // 1. ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    // 2. DD/MM/YYYY or DD-MM-YYYY
    const dmy = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (dmy) {
        let [, day, month, year] = dmy;
        if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year;
        const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // 3. MM/DD/YYYY (US — swap if month > 12)
    const mdy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mdy) {
        let [, m, d2, y] = mdy;
        if (parseInt(m) > 12 && parseInt(d2) <= 12) [m, d2] = [d2, m];
        const dt = new Date(`${y}-${m.padStart(2, '0')}-${d2.padStart(2, '0')}`);
        if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    }
    // 4. chrono-node for natural language
    const chronoResult = chrono.parseDate(t);
    if (chronoResult) return chronoResult.toISOString().split('T')[0];
    // 5. Fallback
    const d = new Date(t);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString().split('T')[0];
    return null;
}

function parseDuration(text: string): { duration: string; unit: string } | null {
    const match = text.toLowerCase().match(/(\d+)\s*(day|week|month|year)s?/);
    if (!match) return null;
    return { duration: match[1], unit: match[2] + 's' };
}

// ─── LLM INTEGRATION (OpenAI SDK — supports OpenAI, Groq, Gemini, any OpenAI-compatible API) ──
//
// Configure via .env:
//   OPENAI_API_KEY=sk-...             (OpenAI)
//   LLM_API_URL=https://api.groq.com/openai/v1  LLM_API_KEY=gsk_...  LLM_MODEL=llama-3.1-70b-versatile  (Groq — free)
//   LLM_API_URL=https://generativelanguage.googleapis.com/v1beta/openai  LLM_API_KEY=...  LLM_MODEL=gemini-2.0-flash  (Gemini — free)
//   OLLAMA_API_URL=http://localhost:11434/v1  OLLAMA_MODEL=llama3.2  (Ollama — local fallback, free)
//

// Primary LLM (OpenAI/Groq/Gemini)
const LLM_API_URL = process.env.LLM_API_URL || process.env.OPENAI_API_URL || process.env.OPENAI_BASE_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Ollama fallback (local LLM)
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED !== 'false'; // enabled by default if available

/**
 * Master switch for the external model.
 *
 * With LLM_ENABLED=false the bot never dials out at all and answers purely from
 * the deterministic path — filters, counts and charts resolved against the
 * database. Set it when there is no funded key, or when the host's outbound
 * network is unreliable.
 *
 * That second case is not hypothetical: on this VM a chat request sat waiting on
 * an OpenAI connect timeout, then an Ollama timeout, before ever reaching the
 * working offline path — long enough that the UI showed "Thinking…" forever.
 */
const LLM_ENABLED = process.env.LLM_ENABLED !== 'false';

/**
 * Emit a money amount as a token the client substitutes.
 *
 * The bot must never bake in a currency: the amount shown has to follow the
 * global currency picker in the header, which is a client-side preference, and
 * the rate table lives there too. Summaries previously hardcoded "$" and raw
 * thousands, so an INR user saw dollar signs on rupee figures.
 *
 * The frontend rewrites {{money:N}} through the same format() every other
 * screen uses, so the bot's numbers match the dashboard's exactly.
 */
/** Stage names that mean a deal is finished; mirrors CLOSED_STAGE_NAMES elsewhere. */
const CLOSED_STAGE_NAMES_BOT = ['Closed Won', 'Closed-Won', 'Closed Lost', 'Delivered'];

function money(n: unknown): string {
    const v = Number(n);
    return `{{money:${Number.isFinite(v) ? Math.round(v) : 0}}}`;
}

/**
 * Hard ceiling on any model call. Even when a model IS configured, a hung
 * network must not hold the user's question open — the deterministic path
 * answers most questions anyway, so failing fast to it is strictly better than
 * waiting.
 */
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 15000);

/**
 * Whether a hosted provider may receive conversation history.
 *
 * Off unless explicitly enabled. History includes previous answers, so it can
 * contain client names and deal values; sending it to a third party is a
 * disclosure decision, not a configuration detail.
 */
const HOSTED_PROVIDER_SEES_HISTORY = process.env.LLM_ALLOW_HISTORY === 'true';

/** Reject if a model call outruns the ceiling, so a stalled socket cannot block a reply. */
function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
    return Promise.race([
        work,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS)),
    ]);
}

/**
 * Providers, tried in order until one answers.
 *
 * Configured entirely by environment, so adding or reordering a provider is a
 * .env edit and a restart — no rebuild. Each carries its own circuit breaker:
 * one provider running out of credit must not spend three failed round trips
 * on every question before the next one is tried.
 *
 *   LLM_*   primary      (currently Groq)
 *   LLM2_*  secondary    (currently Kimi / Moonshot)
 *   LLM3_*  tertiary     (currently Gemini)
 *   OLLAMA_* local, last — free and offline, but slowest
 */
const LLM_CIRCUIT_THRESHOLD = 3;   // failures before opening circuit
const LLM_CIRCUIT_COOLDOWN = 5 * 60 * 1000; // 5 min cooldown

interface Provider {
    name: string;
    model: string;
    client: OpenAI | null;
    failures: number;
    openUntil: number;
    build: () => OpenAI | null;
}

function makeHostedProvider(name: string, keyVar: string, urlVar: string, modelVar: string, defaultModel: string): Provider {
    return {
        name,
        model: process.env[modelVar] || defaultModel,
        client: null,
        failures: 0,
        openUntil: 0,
        build() {
            const key = process.env[keyVar];
            if (!key) return null;
            const url = process.env[urlVar];
            return new OpenAI({
                apiKey: key,
                ...(url ? { baseURL: url.replace(/\/chat\/completions\/?$/, '') } : {}),
            });
        },
    };
}

const PROVIDERS: Provider[] = [
    {
        name: 'primary',
        model: LLM_MODEL,
        client: null,
        failures: 0,
        openUntil: 0,
        build() {
            if (process.env.LLM_PRIMARY_ENABLED === 'false' || !LLM_API_KEY) return null;
            return new OpenAI({
                apiKey: LLM_API_KEY,
                ...(LLM_API_URL ? { baseURL: LLM_API_URL.replace(/\/chat\/completions\/?$/, '') } : {}),
            });
        },
    },
    makeHostedProvider('secondary', 'LLM2_API_KEY', 'LLM2_API_URL', 'LLM2_MODEL', 'kimi-k2-0711-preview'),
    makeHostedProvider('tertiary', 'LLM3_API_KEY', 'LLM3_API_URL', 'LLM3_MODEL', 'gemini-2.0-flash'),
    {
        name: 'ollama',
        model: OLLAMA_MODEL,
        client: null,
        failures: 0,
        openUntil: 0,
        build() {
            if (!OLLAMA_ENABLED) return null;
            return new OpenAI({ apiKey: 'ollama', baseURL: OLLAMA_API_URL });
        },
    },
];

/** Providers currently worth trying, in order. */
function availableProviders(): Provider[] {
    if (!LLM_ENABLED) return [];
    const now = Date.now();
    const usable: Provider[] = [];
    for (const p of PROVIDERS) {
        if (p.failures >= LLM_CIRCUIT_THRESHOLD && now < p.openUntil) continue;
        if (!p.client) p.client = p.build();
        if (p.client) usable.push(p);
    }
    return usable;
}

function noteSuccess(p: Provider): void {
    p.failures = 0;
    p.openUntil = 0;
}

function noteFailure(p: Provider): void {
    p.failures++;
    if (p.failures >= LLM_CIRCUIT_THRESHOLD) {
        p.openUntil = Date.now() + LLM_CIRCUIT_COOLDOWN;
        console.error(`[Chatbot] ${p.name} provider paused for 5 minutes after ${p.failures} failures`);
    }
}

// Kept so the older call sites below keep working while they exist.
let primaryLLMFailureCount = 0;
let primaryLLMCircuitOpenUntil = 0;
let ollamaFailureCount = 0;
let ollamaCircuitOpenUntil = 0;

function getPrimaryLLMClient(): OpenAI | null {
    const p = PROVIDERS[0];
    if (!LLM_ENABLED) return null;
    if (p.failures >= LLM_CIRCUIT_THRESHOLD && Date.now() < p.openUntil) return null;
    if (!p.client) p.client = p.build();
    return p.client;
}

function getOllamaClient(): OpenAI | null {
    const p = PROVIDERS[PROVIDERS.length - 1];
    if (!LLM_ENABLED) return null;
    if (p.failures >= LLM_CIRCUIT_THRESHOLD && Date.now() < p.openUntil) return null;
    if (!p.client) p.client = p.build();
    return p.client;
}

// For backward compatibility
function getOpenAIClient(): OpenAI | null {
    return getPrimaryLLMClient() || getOllamaClient();
}

function recordPrimaryLLMSuccess() {
    primaryLLMFailureCount = 0;
    primaryLLMCircuitOpenUntil = 0;
}

function recordPrimaryLLMFailure() {
    primaryLLMFailureCount++;
    if (primaryLLMFailureCount >= LLM_CIRCUIT_THRESHOLD) {
        primaryLLMCircuitOpenUntil = Date.now() + LLM_CIRCUIT_COOLDOWN;
        console.warn(`[Chatbot] Primary LLM circuit breaker OPEN — ${primaryLLMFailureCount} failures. Cooling down until ${new Date(primaryLLMCircuitOpenUntil).toISOString()}`);
    }
}

function recordOllamaSuccess() {
    ollamaFailureCount = 0;
    ollamaCircuitOpenUntil = 0;
}

function recordOllamaFailure() {
    ollamaFailureCount++;
    if (ollamaFailureCount >= LLM_CIRCUIT_THRESHOLD) {
        ollamaCircuitOpenUntil = Date.now() + LLM_CIRCUIT_COOLDOWN;
        console.warn(`[Chatbot] Ollama circuit breaker OPEN — ${ollamaFailureCount} failures. Cooling down until ${new Date(ollamaCircuitOpenUntil).toISOString()}`);
    }
}

// Backward compatibility aliases
function recordLLMSuccess() { recordPrimaryLLMSuccess(); }
function recordLLMFailure() { recordPrimaryLLMFailure(); }

export function getLLMStatus(): { 
    available: boolean; 
    provider: string; 
    model: string; 
    circuitOpen: boolean; 
    failures: number;
    ollama: { available: boolean; model: string; circuitOpen: boolean; failures: number };
} {
    return {
        available: !!LLM_API_KEY,
        provider: LLM_API_URL ? new URL(LLM_API_URL).hostname : 'api.openai.com',
        model: LLM_MODEL,
        circuitOpen: primaryLLMFailureCount >= LLM_CIRCUIT_THRESHOLD && Date.now() < primaryLLMCircuitOpenUntil,
        failures: primaryLLMFailureCount,
        ollama: {
            available: OLLAMA_ENABLED,
            model: OLLAMA_MODEL,
            circuitOpen: ollamaFailureCount >= LLM_CIRCUIT_THRESHOLD && Date.now() < ollamaCircuitOpenUntil,
            failures: ollamaFailureCount,
        },
    };
}

interface LLMParsedIntent {
    intent: string;
    params: Record<string, any>;
    fieldName?: string;
    fieldValue?: string;
    confidence: number;
}

const SYSTEM_PROMPT = `You are an AI assistant for Q-CRM, a sales pipeline management system.
Analyze the user message and determine their intent. Return a JSON object with:
- "intent": one of [create_opportunity, update_opportunity, list_opportunities, get_details, pipeline_analytics, revenue_analytics, deal_health, forecast, create_lead, list_contacts, create_contact, get_contact, update_contact, delete_contact, add_comment, list_comments, approve_gom, review_gom, gom_status, list_users, list_audit_logs, my_profile, list_resources, convert_opportunity, move_to_presales, move_to_sales, proposal_sent, mark_lost, reestimate, general_chat, confirm_yes, confirm_no, provide_field_value, cancel]
- "params": extracted parameters as key-value pairs
- "confidence": 0-1 confidence score

For create_opportunity, extract any of: title, client, value, currency, technology, region, description, projectType, practice, salesRepName, managerName, pricingModel, tentativeStartDate, tentativeDuration, expectedDayRate, priority, expectedCloseDate, source, tags
For update_opportunity, extract: nameOrId (deal name), plus any fields to change including stage
For list_opportunities: stage, client, owner ("my" = self), technology, region, minValue, maxValue, search
For get_details: nameOrId (deal name or ID)
For create_lead: title, companyName, contactFirstName, contactLastName, contactEmail, contactTitle, value, source, description
For list_contacts: search, client
For create_contact: firstName, lastName, email, phone, title, department, client
For get_contact / update_contact / delete_contact: nameOrId (contact name or email)
For add_comment: nameOrId (deal name), comment (the text)
For list_comments: nameOrId (deal name)
For approve_gom / review_gom / gom_status: nameOrId (deal name)
For list_users: search, department, role
For list_audit_logs: entity, action
For convert_opportunity: nameOrId (deal name)
For move_to_presales: nameOrId (deal name) — moves from Pipeline/Discovery to Presales/Qualification
For move_to_sales: nameOrId (deal name) — moves from Presales/Qualification to Sales/Proposal (requires GOM approval)
For proposal_sent: nameOrId (deal name) — marks proposal as sent, moves from Proposal to Negotiation
For mark_lost: nameOrId (deal name), remarks (reason for losing)
For reestimate: nameOrId (deal name), comment (why re-estimation needed), adjustedValue (optional new value)
For revenue_analytics: groupBy (technology, client, owner, month)
For provide_field_value: fieldName, fieldValue

Opportunity Lifecycle: Pipeline (Discovery) → Presales (Qualification) → Sales (Proposal → Negotiation) → Project (Closed Won)
The words "presales" and "qualification" refer to the same stage. "sales" and "proposal" refer to the same stage.

Value parsing: "500K" = 500000, "2M" = 2000000, "1.5 crore" = 15000000
Date formats: accept any format
If the user says "skip" or "none" for a field, set fieldValue to "__SKIP__"

IMPORTANT for create_opportunity: Users may mention client names and technologies in plain language without explicit labels.
Example: "create AMDS PowerBI" → intent: create_opportunity, params: { client: "AMDS", technology: "PowerBI" }
Example: "new deal for TechCorp using React" → intent: create_opportunity, params: { client: "TechCorp", technology: "React" }
Example: "add opportunity AMDS Power BI 500K" → intent: create_opportunity, params: { client: "AMDS", technology: "Power BI", value: 500000 }
Extract as many fields as possible from the natural language. The first unrecognized proper noun is likely the client name.

IMPORTANT: Return ONLY the JSON object, no markdown or extra text.`;

async function callLLMWithClient(client: OpenAI, model: string, userMessage: string, conversationContext: string): Promise<LLMParsedIntent | null> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(conversationContext ? [{ role: 'system' as const, content: `Current conversation state: ${conversationContext}` }] : []),
        { role: 'user', content: userMessage },
    ];
    const completion = await client.chat.completions.create({
        model, messages, temperature: 0.1, max_tokens: 500,
    });
    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonStr);
}

async function callLLM(userMessage: string, conversationContext: string): Promise<LLMParsedIntent | null> {
    // Deterministic-only mode: go straight to the rule-based parser without
    // touching the network, so replies are instant.
    if (!LLM_ENABLED) return null;

    // Try primary LLM first
    const primaryClient = getPrimaryLLMClient();
    if (primaryClient) {
        try {
            const result = await withTimeout(callLLMWithClient(primaryClient, LLM_MODEL, userMessage, conversationContext), 'primary LLM');
            recordPrimaryLLMSuccess();
            return result;
        } catch (e) {
            recordPrimaryLLMFailure();
            console.error('[Chatbot] Primary LLM failed:', (e as Error).message);
        }
    }

    // Fallback to Ollama
    const ollamaClientInstance = getOllamaClient();
    if (ollamaClientInstance) {
        try {
            console.log('[Chatbot] Falling back to Ollama...');
            const result = await withTimeout(callLLMWithClient(ollamaClientInstance, OLLAMA_MODEL, userMessage, conversationContext), 'Ollama');
            recordOllamaSuccess();
            return result;
        } catch (e) {
            recordOllamaFailure();
            console.error('[Chatbot] Ollama fallback failed:', (e as Error).message);
        }
    }

    console.error('[Chatbot] All LLM providers failed, falling back to NLP');
    return null;
}

async function generalChatWithClient(client: OpenAI, model: string, userMessage: string, ctx: UserContext, conversationHistory: { role: string; content: string }[]): Promise<string | null> {
    const historyMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = conversationHistory.slice(-6).map(h => ({
        role: h.role as 'user' | 'assistant', content: h.content,
    }));
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `You are Q-CRM AI Assistant, a helpful and concise CRM chatbot for a sales pipeline management tool.
User: ${ctx.userName} (${ctx.roleName}). Respond naturally, helpfully, and briefly.
If the user's message seems to be a CRM action you can't parse, suggest the correct command format.
Do NOT make up data — only use what you know about the system's capabilities.
Keep responses under 3 sentences unless detail is needed. Use markdown for formatting.`
        },
        ...historyMsgs,
        { role: 'user', content: userMessage },
    ];
    const completion = await client.chat.completions.create({
        model, messages, temperature: 0.7, max_tokens: 300,
    });
    return completion.choices?.[0]?.message?.content?.trim() || null;
}

/** Use LLM for free-form conversational response (general_chat) */
async function llmGeneralChat(userMessage: string, ctx: UserContext, conversationHistory: { role: string; content: string }[]): Promise<string | null> {
    // This is the one path that sends conversation HISTORY, and history contains
    // earlier replies — which carry client names and real figures. That is fine
    // for a model running on this VM and not fine for a third party, so a hosted
    // provider is deliberately skipped here even when one is configured.
    //
    // The rescue path is what a hosted key is for: it sends only the sentence
    // the user typed and gets back a dimension. Keeping that split in code means
    // configuring a key cannot start leaking pipeline data by accident, which is
    // not something anyone should have to remember.
    const primaryClient = HOSTED_PROVIDER_SEES_HISTORY ? getPrimaryLLMClient() : null;
    if (primaryClient) {
        try {
            const result = await generalChatWithClient(primaryClient, LLM_MODEL, userMessage, ctx, conversationHistory);
            recordPrimaryLLMSuccess();
            return result;
        } catch (e) {
            recordPrimaryLLMFailure();
            console.error('[Chatbot] Primary LLM general chat failed:', (e as Error).message);
        }
    }

    // Fallback to Ollama
    const ollamaClientInstance = getOllamaClient();
    if (ollamaClientInstance) {
        try {
            console.log('[Chatbot] General chat falling back to Ollama...');
            const result = await generalChatWithClient(ollamaClientInstance, OLLAMA_MODEL, userMessage, ctx, conversationHistory);
            recordOllamaSuccess();
            return result;
        } catch (e) {
            recordOllamaFailure();
            console.error('[Chatbot] Ollama general chat failed:', (e as Error).message);
        }
    }

    return null;
}

// ─── NLP FALLBACK ───────────────────────────────────────────────────────────

const STAGE_NAMES = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed won', 'closed lost', 'proposal lost'];

// Lifecycle phase aliases → actual DB stage names
const LIFECYCLE_ALIASES: Record<string, string> = {
    'presales': 'Qualification',
    'pre-sales': 'Qualification',
    'pre sales': 'Qualification',
    'sales': 'Proposal',
    'pipeline': 'Discovery',
    'project': 'Closed Won',
};

/** Extract entity name from message — tries quotes first, then "for/on/of <name>" */
function extractEntityName(msg: string): string {
    const quoted = msg.match(/["']([^"']+)["']/);
    if (quoted) return quoted[1].trim();
    const prep = msg.match(/(?:\bfor\b|\bon\b|\bof\b)\s+(.+?)(?:\s*(?:comment|note|approved?|reject|status|check|convert|gom|margin).*)?$/i);
    if (prep) return prep[1].replace(/[?.!,;:]+$/, '').trim();
    return '';
}

function nlpParseIntent(message: string, conv: ConversationState): LLMParsedIntent {
    const lower = message.toLowerCase().trim();

    if (conv.mode === 'confirming' || conv.mode === 'confirming_extract') {
        if (/\b(yes|yeah|yep|confirm|sure|go ahead|do it|ok|okay|proceed|correct)\b/i.test(lower))
            return { intent: 'confirm_yes', params: {}, confidence: 0.95 };
        if (/\b(no|nope|cancel|abort|stop|wrong|nah|don't)\b/i.test(lower))
            return { intent: 'confirm_no', params: {}, confidence: 0.95 };
    }

    if (conv.mode === 'creating' || conv.mode === 'updating' || conv.mode === 'creating_lead' || conv.mode === 'creating_contact') {
        if (/\b(cancel|abort|stop|nevermind|never mind)\b/i.test(lower))
            return { intent: 'cancel', params: {}, confidence: 0.95 };
        if (/\b(skip|none|na|n\/a|not applicable|pass)\b/i.test(lower))
            return { intent: 'provide_field_value', params: {}, fieldName: conv.missingRequired[0] || conv.optionalRemaining[0], fieldValue: '__SKIP__', confidence: 0.9 };
        const currentField = conv.missingRequired[0] || conv.optionalRemaining[0];
        if (currentField)
            return { intent: 'provide_field_value', params: {}, fieldName: currentField, fieldValue: message.trim(), confidence: 0.8 };
    }

    // CREATE
    if (/\b(create|add|new|register)\b.*\b(opportunit(?:y|ies)|deals?|opps?|project)\b/i.test(lower) ||
        /\b(opportunit(?:y|ies)|deals?)\b.*\b(create|add|new)\b/i.test(lower)) {
        return { intent: 'create_opportunity', params: extractOpportunityParams(lower), confidence: 0.9 };
    }

    // ─── LIFECYCLE ACTIONS (before generic UPDATE to take priority) ───

    // Move to Presales
    if (/\b(move|send|advance|promote|push|transition)\b/i.test(lower) && /\b(presales?|pre[\s-]?sales?)\b/i.test(lower)) {
        return { intent: 'move_to_presales', params: { nameOrId: extractEntityName(lower) }, confidence: 0.9 };
    }

    // Move to Sales
    if (/\b(move|send|advance|promote|push|submit|transition)\b/i.test(lower) && /\b(sales)\b/i.test(lower) &&
        !/\b(proposal\s*(sent|lost|rejected))\b/i.test(lower) && !/\b(sales\s*rep)\b/i.test(lower)) {
        return { intent: 'move_to_sales', params: { nameOrId: extractEntityName(lower) }, confidence: 0.9 };
    }

    // Proposal Sent
    if (/\b(proposal\s*(sent|submitted|delivered)|send\s*proposal|submit\s*proposal|mark\s*proposal\s*(as\s*)?(sent|submitted))\b/i.test(lower)) {
        return { intent: 'proposal_sent', params: { nameOrId: extractEntityName(lower) }, confidence: 0.9 };
    }

    // Mark as Lost (before generic UPDATE)
    if (/\b(mark|set|move|close)\b/i.test(lower) && /\b(lost|close.?lost|proposal.?lost|dead|rejected|declined)\b/i.test(lower)) {
        const lostType = 'Closed Lost';   // the only lost stage there is
        const remarksMatch = lower.match(/(?:reason|because|remark|due to|:\s*)[:\s,]*["']?(.{5,})["']?\s*$/i);
        return { intent: 'mark_lost', params: { nameOrId: extractEntityName(lower), lostType, remarks: remarksMatch?.[1]?.trim() || '' }, confidence: 0.9 };
    }

    // Send back for Re-estimate (before generic UPDATE)
    if ((/\bre[\s-]?estimat\w*/i.test(lower) || /\bsend\b.{0,60}\bback\b/i.test(lower) || /\b(return\s+(for|to)|revert|revision)\b/i.test(lower)) &&
        !(/\b(create|add)\b/i.test(lower))) {
        const commentMatch = lower.match(/(?:reason|because|comment|:\s*)["']?(.{5,})["']?\s*$/i);
        return { intent: 'reestimate', params: { nameOrId: extractEntityName(lower), comment: commentMatch?.[1]?.trim() || '' }, confidence: 0.9 };
    }

    // UPDATE / MOVE STAGE (generic — fallback for other stage moves)
    if (/\b(move|update|change|set|advance|promote|edit|modify)\b/i.test(lower) &&
        /\b(opportunit(?:y|ies)|deals?|opps?|stage|value|status|priority)\b/i.test(lower)) {
        const params = extractUpdateParams(lower);
        if (Object.keys(params).length > 0)
            return { intent: 'update_opportunity', params, confidence: 0.85 };
    }

    // DETAIL
    if (/\b(details?|info|about|tell me about|describe)\b/i.test(lower) && /\b(opportunit(?:y|ies)|deals?|opps?)\b/i.test(lower)) {
        const nameMatch = lower.match(/(?:opportunity|deal|opp)\s+["']([^"']+)["']/i) || lower.match(/about\s+["']([^"']+)["']/i) || lower.match(/["']([^"']+)["']/);
        return { intent: 'get_details', params: { nameOrId: nameMatch?.[1]?.trim() || '' }, confidence: nameMatch ? 0.9 : 0.6 };
    }

    // WIN RATE — won vs lost. Checked before the generic chart rule because
    // "win" is an outcome, not one of the group-by dimensions, so that rule
    // would find nothing to group by and fall through.
    if (/\b(win\s*rate|winning\s*rate|rate\s*of\s*win|win\/loss|win\s*loss|won\s*vs\.?\s*lost|success\s*rate|conversion\s*rate|hit\s*rate)\b/i.test(lower)) {
        const p: Record<string, any> = extractListParams(lower);
        p.chartType = /\b(bar|column)\b/i.test(lower) && !/\b(pie|donut)\b/i.test(lower) ? 'bar' : 'pie';
        return { intent: 'win_rate', params: p, confidence: 0.95 };
    }

    // "Which ones aged throughout the month of August" asks for a LIST filtered
    // by a period. It used to draw a chart of everything grouped by month,
    // because the word "month" belongs to the period and was read as the
    // dimension. A question naming a period and asking "which ones" is only a
    // chart if it also says how to group — "by month", "month wise", "monthly".
    if (/\b(which|what)\s+(?:ones|deals?|opportunit\w+|projects?)\b/i.test(lower)
        && extractPeriod(lower)
        && !/\b(?:by|per)\s+month\b|month\s*[- ]?wise|\bmonthly\b/i.test(lower)) {
        return { intent: 'list_opportunities', params: extractListParams(lower), confidence: 0.85 };
    }

    // CUSTOM CHART — any "chart/graph/pie/breakdown by X" request. Checked
    // before the generic list rule so "show a pie chart of deals by client"
    // draws a chart rather than listing rows.
    if (/\b(chart|graph|pie|donut|bar\s*(?:chart|graph|diagram)?|plot|visuali[sz]e|breakdown|break\s*up|distribution|split|statistics|stats|summary|analysis|analytics|report)\b/i.test(lower) ||
        /\b[a-z]+\s*[- ]?wise\b/i.test(lower)) {
        return { intent: 'custom_chart', params: extractChartParams(lower), confidence: 0.9 };
    }

    // ANALYTICS: Pipeline (before list)
    if (/\b(pipeline|funnel|stage\s*breakdown|conversion\s*rate|how\s*(?:is|are)\s*(?:our|the)\s*pipeline|stage\s*distribution)\b/i.test(lower) &&
        /\b(analytics?|stats?|summary|overview|report|breakdown|show|get|how)\b/i.test(lower))
        return { intent: 'pipeline_analytics', params: {}, confidence: 0.9 };

    // ANALYTICS: Revenue (before list)
    if (/\b(revenue|top\s*clients?|revenue\s*by|monthly\s*revenue|earning|income|sales\s*by)\b/i.test(lower)) {
        // This used to run its own four-way dimension check with a much narrower
        // vocabulary than the chart parser, and fell back to technology whenever
        // it recognised nothing — so "revenue by people" quietly returned revenue
        // by technology. It now uses the same matcher as everything else.
        const dim = matchDimension(lower);
        const asRevenueDimension: Record<string, string> = {
            technology: 'technology', client: 'client', salesRep: 'owner', month: 'month',
        };
        if (dim && asRevenueDimension[dim]) {
            return { intent: 'revenue_analytics', params: { groupBy: asRevenueDimension[dim] }, confidence: 0.85 };
        }
        // Revenue analytics only knows those four. The sentence named one of the
        // other six (region, practice, pricing model…), so answer it as a chart,
        // which can group by any of them, rather than charting the wrong thing.
        if (dim) {
            return { intent: 'custom_chart', params: { ...extractChartParams(lower), groupBy: dim }, confidence: 0.85 };
        }
        return { intent: 'revenue_analytics', params: { groupBy: 'technology' }, confidence: 0.85 };
    }

    // ANALYTICS: Hot / Cold (before health, which would otherwise swallow "cold")
    //
    // These are first-class ideas on the dashboard, so the bot has to know them
    // too. Without this rule "which is the hottest opportunity right now?" fell
    // through to the model, which had no executor to aim at and guessed a
    // dimension — every such question came back as the same by-practice chart.
    if (/\b(hot|hottest|cold|coldest|warm|warmest)\b/i.test(lower) && /\b(deal|deals|opportunit\w*|pipeline|lead|leads)\b/i.test(lower)) {
        const wantsCold = /\b(cold|coldest)\b/i.test(lower);
        // "which is the hottest opportunity" asks for one, not a list of five.
        const singular = /\b(?:the\s+)?(?:hottest|coldest|warmest)\s+(?:deal|opportunity|lead)\b/i.test(lower);
        const limit = extractTopN(lower) || (singular ? 1 : 0);
        return { intent: 'hot_cold', params: { temperature: wantsCold ? 'cold' : 'hot', limit }, confidence: 0.9 };
    }

    // ANALYTICS: Deal Health (before list)
    if (/\b(health|stalled|at.risk|risk|aging|stuck|inactive|dormant)\b/i.test(lower))
        return { intent: 'deal_health', params: {}, confidence: 0.85 };

    // ANALYTICS: Forecast (before list)
    if (/\b(forecast|predict|expected\s*revenue|weighted\s*pipeline|projection)\b/i.test(lower))
        return { intent: 'forecast', params: {}, confidence: 0.9 };

    // COUNT — "how many SAP opportunities are there?". Shares the list query
    // and its filters; only the phrasing of the answer differs, so a count and
    // a list of the same thing can never disagree.
    // The noun is optional: "how many are open?" is a follow-up and names no
    // subject, but it is unambiguously a count of the thing just discussed.
    if (/\b(how many|number of|count of|count the|total number)\b/i.test(lower)) {
        return { intent: 'count_opportunities', params: extractListParams(lower), confidence: 0.9 };
    }

    // LIST / SEARCH (after analytics)
    if (/\b(list|show|find|search|get|display|what are|give me|view)\b/i.test(lower) &&
        /\b(opportunit(?:y|ies)|deals?|pipeline|opps?)\b/i.test(lower)) {
        return { intent: 'list_opportunities', params: extractListParams(lower), confidence: 0.85 };
    }

    // ─── LEADS ───
    if (/\b(create|add|new|ingest|register|submit)\b/i.test(lower) && /\b(leads?)\b/i.test(lower)) {
        const params: any = {};
        const titleMatch = lower.match(/["']([^"']+)["']/);
        if (titleMatch) params.title = titleMatch[1].trim();
        const companyMatch = lower.match(/(?:company|from|for)\s+["']([^"']+)["']/i);
        if (companyMatch) params.companyName = companyMatch[1].trim();
        return { intent: 'create_lead', params, confidence: 0.9 };
    }

    // ─── CONTACTS ───
    if (/\b(create|add|new)\b/i.test(lower) && /\b(contacts?)\b/i.test(lower)) {
        return { intent: 'create_contact', params: {}, confidence: 0.9 };
    }
    if (/\b(delete|remove|deactivate)\b/i.test(lower) && /\b(contacts?)\b/i.test(lower)) {
        return { intent: 'delete_contact', params: { nameOrId: extractEntityName(lower) }, confidence: 0.85 };
    }
    if (/\b(update|edit|change|modify)\b/i.test(lower) && /\b(contacts?)\b/i.test(lower)) {
        return { intent: 'update_contact', params: { nameOrId: extractEntityName(lower) }, confidence: 0.85 };
    }
    if (/\b(details?|info|about)\b/i.test(lower) && /\b(contacts?)\b/i.test(lower)) {
        return { intent: 'get_contact', params: { nameOrId: extractEntityName(lower) }, confidence: 0.85 };
    }
    if (/\b(list|show|find|search|get|display|view|all)\b/i.test(lower) && /\b(contacts?)\b/i.test(lower)) {
        const searchMatch = lower.match(/(?:search|find|for)\s+["']?([^"']+)/i);
        const clientMatch = lower.match(/(?:client|from|for|at)\s+["']([^"']+)["']/i);
        return { intent: 'list_contacts', params: { search: searchMatch?.[1]?.trim(), client: clientMatch?.[1]?.trim() }, confidence: 0.85 };
    }

    // ─── COMMENTS ───
    if (/\b(add|post|write|leave)\b/i.test(lower) && /\b(comments?|notes?)\b/i.test(lower)) {
        const nameMatch = lower.match(/(?:on|to|for)\s+["']([^"']+)["']/i);
        const commentMatch = lower.match(/(?:comment|note)\s*[:\"]+\s*(.+)/i);
        return { intent: 'add_comment', params: { nameOrId: nameMatch?.[1] || '', comment: commentMatch?.[1]?.trim() || '' }, confidence: 0.85 };
    }
    if (/\b(list|show|view|get|read)\b/i.test(lower) && /\b(comments?|notes?)\b/i.test(lower)) {
        return { intent: 'list_comments', params: { nameOrId: extractEntityName(lower) }, confidence: 0.85 };
    }

    // ─── GOM / APPROVALS ───
    if (/\b(approve|accept)\b/i.test(lower) && /\b(gom|margin)\b/i.test(lower)) {
        return { intent: 'approve_gom', params: { nameOrId: extractEntityName(lower) }, confidence: 0.9 };
    }
    if (/\b(review|reject|decline)\b/i.test(lower) && /\b(gom|approval)\b/i.test(lower)) {
        const approved = !/\b(reject|decline)\b/i.test(lower);
        return { intent: 'review_gom', params: { nameOrId: extractEntityName(lower), approved }, confidence: 0.9 };
    }
    if (/\b(gom|approval)\b/i.test(lower) && /\b(status|pending|check)\b/i.test(lower)) {
        return { intent: 'gom_status', params: { nameOrId: extractEntityName(lower) }, confidence: 0.85 };
    }

    // ─── CONVERT OPPORTUNITY ───
    if (/\b(convert|close.?won|mark.?won)\b/i.test(lower) && /\b(opportunit(?:y|ies)|deals?|opps?|project)\b/i.test(lower)) {
        return { intent: 'convert_opportunity', params: { nameOrId: extractEntityName(lower) }, confidence: 0.9 };
    }

    // ─── ADMIN: Users ───
    if (/\b(list|show|find|search|who|all)\b/i.test(lower) && /\b(users?|team members?|people|staff|employees?)\b/i.test(lower)) {
        const deptMatch = lower.match(/(?:department|dept|in)\s+["']?([^"',]+)/i);
        const roleMatch = lower.match(/(?:role|as)\s+["']?([^"',]+)/i);
        return { intent: 'list_users', params: { search: '', department: deptMatch?.[1]?.trim(), role: roleMatch?.[1]?.trim() }, confidence: 0.85 };
    }

    // ─── ADMIN: Audit Logs ───
    if (/\b(audit|logs?|trail|history)\b/i.test(lower) && /\b(show|list|view|get|recent|all)\b/i.test(lower)) {
        return { intent: 'list_audit_logs', params: {}, confidence: 0.85 };
    }

    // ─── MY PROFILE ───
    // Deliberately narrow. The old rule fired on any sentence containing "me"
    // AND "what", so "what is the rate of win, show me in a pie chart" returned
    // the user's profile. A profile request has to actually name the profile.
    if (/\b(who am i|my profile|my role|my permission|my access|what can i do|about me)\b/i.test(lower) ||
        (/\bprofile\b/i.test(lower) && /\b(my|show|get|view)\b/i.test(lower))) {
        return { intent: 'my_profile', params: {}, confidence: 0.9 };
    }

    // ─── RESOURCES ───
    if (/\b(list|show|view|get|available)\b/i.test(lower) && /\b(resources?|bench|availability|skills?)\b/i.test(lower)) {
        return { intent: 'list_resources', params: {}, confidence: 0.85 };
    }

    // ─── GREETINGS & SMALL TALK ───
    if (/^(hi|hello|hey|hola|greetings|good\s*(morning|afternoon|evening|day)|howdy|yo|sup|what'?s up)[!?.\s]*$/i.test(lower)) {
        return { intent: 'greeting', params: {}, confidence: 0.95 };
    }
    if (/\b(thank|thanks|thx|ty|cheers|appreciate)\b/i.test(lower)) {
        return { intent: 'thanks', params: {}, confidence: 0.9 };
    }
    if (/\b(bye|goodbye|see you|later|gtg|cya)\b/i.test(lower)) {
        return { intent: 'farewell', params: {}, confidence: 0.9 };
    }
    if (/\b(how are you|how do you do|how's it going|what can you do|capabilities|features)\b/i.test(lower)) {
        return { intent: 'about_bot', params: {}, confidence: 0.85 };
    }

    // Fallback: "create/add/new" without explicit entity keyword — treat as create opportunity
    // Smart extraction in processChat will match against master data
    if (/^\s*(create|add|new)\b/i.test(lower) && !/\b(lead|contact|user|comment|tag)\b/i.test(lower)) {
        return { intent: 'create_opportunity', params: extractOpportunityParams(lower), confidence: 0.6 };
    }

    return { intent: 'general_chat', params: {}, confidence: 0.3 };
}

function extractOpportunityParams(lower: string): Record<string, any> {
    const params: Record<string, any> = {};
    const titleMatch = lower.match(/(?:called|named|titled|name)\s+["']?([^"',]+)["']?/i) || lower.match(/["']([^"']+)["']/);
    if (titleMatch) params.title = titleMatch[1].trim();
    const valMatch = lower.match(/(?:value|worth|for)\s+\$?([\d,.]+)\s*(k|m|thousand|million|lakh|cr|crore)?/i);
    if (valMatch) params.value = parseMoneyValue(valMatch[0].replace(/^(value|worth|for)\s+/i, ''));
    const clientMatch = lower.match(/(?:client|for company|for|with)\s+["']([^"']+)["']/i);
    if (clientMatch) params.client = clientMatch[1].trim();
    const techMatch = lower.match(/(?:tech(?:nology)?|stack|using)\s+["']?([^"',]+)/i);
    if (techMatch) params.technology = techMatch[1].trim();
    return params;
}

function extractUpdateParams(lower: string): Record<string, any> {
    const params: Record<string, any> = {};
    const nameMatch = lower.match(/(?:opportunity|deal|opp)\s+["']([^"']+)["']/i) || lower.match(/["']([^"']+)["']/);
    if (nameMatch) params.nameOrId = nameMatch[1].trim();
    // Check lifecycle aliases first
    for (const [alias, dbStage] of Object.entries(LIFECYCLE_ALIASES)) {
        if (lower.includes(alias)) {
            params.stage = dbStage;
            break;
        }
    }
    // Then check standard DB stage names
    if (!params.stage) {
        for (const stage of STAGE_NAMES) {
            if (lower.includes(stage)) {
                params.stage = stage.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                break;
            }
        }
    }
    const valMatch = lower.match(/value\s+(?:to\s+)?\$?([\d,.]+)\s*(k|m|thousand|million)?/i);
    if (valMatch) params.value = parseMoneyValue(valMatch[0].replace(/^value\s+(to\s+)?/i, ''));
    const prioMatch = lower.match(/priority\s+(?:to\s+)?(low|medium|high|critical)/i);
    if (prioMatch) params.priority = prioMatch[1].charAt(0).toUpperCase() + prioMatch[1].slice(1);
    return params;
}

/**
 * A month or quarter named in a question, and WHICH date it refers to.
 *
 * "In August" is three different questions depending on the verb, and answering
 * the wrong one is invisible to the reader:
 *
 *   "how many came in August"          → created in August
 *   "how many closed in August"        → finished in August
 *   "which ones aged through August"   → alive at some point during August
 *
 * The last is not a date range on a single column: a deal created in March and
 * still open in September was open throughout August without either of its
 * dates falling inside it. So it is expressed as an overlap — started before the
 * month ended, and had not finished before it began.
 *
 * A bare month name means the most recent one that has actually happened, so in
 * August 2026 "December" means December 2025 rather than a month in the future.
 */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface Period { start: Date; end: Date; label: string; sense: 'created' | 'closed' | 'active'; }

function periodSense(lower: string): Period['sense'] {
    if (/\b(closed|won|lost|signed|completed|finished|settled)\b/i.test(lower)) return 'closed';
    if (/\b(came|come|created|added|new|logged|received|raised|opened|generated|booked)\b/i.test(lower)) return 'created';
    // "which ones aged through August" — and the safest default, since a deal
    // that merely existed during the month is the widest honest reading.
    return 'active';
}

function extractPeriod(lower: string): Period | null {
    const now = new Date();
    const sense = periodSense(lower);
    const make = (start: Date, end: Date, label: string): Period => ({ start, end, label, sense });

    // "this month" / "last month" / "this quarter" / "last quarter" / "this year"
    if (/\bthis month\b/i.test(lower)) {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        return make(s, new Date(now.getFullYear(), now.getMonth() + 1, 1), 'this month');
    }
    if (/\blast month\b/i.test(lower)) {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return make(s, new Date(now.getFullYear(), now.getMonth(), 1), 'last month');
    }
    if (/\bthis quarter\b/i.test(lower)) {
        const q = Math.floor(now.getMonth() / 3);
        return make(new Date(now.getFullYear(), q * 3, 1), new Date(now.getFullYear(), q * 3 + 3, 1), 'this quarter');
    }
    if (/\blast quarter\b/i.test(lower)) {
        const q = Math.floor(now.getMonth() / 3) - 1;
        return make(new Date(now.getFullYear(), q * 3, 1), new Date(now.getFullYear(), q * 3 + 3, 1), 'last quarter');
    }
    if (/\bthis year\b|\byear to date\b|\bytd\b/i.test(lower)) {
        return make(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1), `${now.getFullYear()}`);
    }
    if (/\blast year\b/i.test(lower)) {
        return make(new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1), `${now.getFullYear() - 1}`);
    }

    // A named month, with an optional year.
    for (let i = 0; i < 12; i++) {
        const re = new RegExp(`\\b(?:${MONTHS[i]}|${MONTH_ABBR[i]})\\b\\.?\\s*(\\d{4})?`, 'i');
        const m = lower.match(re);
        if (!m) continue;
        // "may" is also an ordinary word — require a date-ish context for it.
        if (i === 4 && !/\b(?:in|of|during|month)\s+may\b|\bmay\s+\d{4}\b/i.test(lower)) continue;
        const year = m[1] ? Number(m[1]) : (i <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1);
        const label = `${MONTHS[i][0].toUpperCase()}${MONTHS[i].slice(1)} ${year}`;
        return make(new Date(year, i, 1), new Date(year, i + 1, 1), label);
    }
    return null;
}

function extractListParams(lower: string): Record<string, any> {
    const params: Record<string, any> = {};
    for (const stage of STAGE_NAMES) {
        if (lower.includes(stage)) {
            params.stage = stage.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            break;
        }
    }
    if (/\bmy\b/.test(lower)) params.owner = '__SELF__';
    // Quoted client is still honoured, but it is no longer the only way — see
    // enrichFiltersFromMasterData, which matches unquoted names too.
    const clientMatch = lower.match(/(?:for|from|client)\s+["']([^"']+)["']/i);
    if (clientMatch) params.client = clientMatch[1].trim();
    const valMatch = lower.match(/(?:above|over|more than|greater than|>)\s+\$?([\d,.]+)\s*(k|m)?/i);
    if (valMatch) params.minValue = parseMoneyValue(valMatch[0].replace(/^(above|over|more than|greater than|>)\s+/i, ''));
    const maxMatch = lower.match(/(?:below|under|less than|<)\s+\$?([\d,.]+)\s*(k|m)?/i);
    if (maxMatch) params.maxValue = parseMoneyValue(maxMatch[0].replace(/^(below|under|less than|<)\s+/i, ''));
    const outcome = extractOutcomeFilter(lower);
    if (outcome) params.outcome = outcome;
    const period = extractPeriod(lower);
    if (period) params.period = period;
    return params;
}

/**
 * Fill in filters the regex rules cannot see, by matching the question against
 * the master-data vocabulary the bot already caches (clients, technologies,
 * regions, practices, pricing models, project types, people).
 *
 * This is what lets "list all SAP opportunities" actually filter by SAP. The
 * CRM's vocabulary is closed — every client, technology and stage is a known
 * row — so a question can be resolved by matching against it, with no language
 * model involved and no possibility of an invented value.
 *
 * Explicit params always win: anything the caller already determined is left
 * untouched.
 */
/** Initials of a multi-word name, ignoring connectors and the org suffix. */
function acronymOf(name: string): string {
    const IGNORE = new Set(['and', 'of', 'the', 'for', '&', '-', 'qbapl', 'qbalux', 'ltd', 'pvt', 'inc', 'llc']);
    const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !IGNORE.has(w));
    return words.map(w => w[0]).join('').toUpperCase();
}

/**
 * Damerau-Levenshtein distance — like Levenshtein but counts a transposition as
 * ONE edit, which matters because transposition is the commonest typo: plain
 * Levenshtein scores "Salesfroce" against "Salesforce" as 2 edits and the match
 * falls below the threshold, even though a person reads it as obviously the
 * same word.
 */
function editDistance(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // transposition
            }
        }
    }
    return d[m][n];
}

/**
 * Resolve the entities named in a question against the CRM's own vocabulary.
 *
 * Three passes, most trustworthy first, because both extremes have already
 * caused real wrong answers:
 *
 *   1. EXACT phrase   — the name appears verbatim.
 *   2. ACRONYM        — "ADM" for "App Dev & Maintenance - QBAPL". People
 *                       overwhelmingly type the acronym, and without this the
 *                       filter was silently dropped and all 136 rows returned.
 *   3. NEAR-MISS      — one or two typos ("Indorma", "Salesfroce"), gated at
 *                       ~85% similarity and 5+ characters.
 *
 * The old 0.6 fuzzy match was far too loose — it read "as" in "... as a pie" as
 * the client "Asian Paints" and cut 136 rows to 3. A filter that quietly
 * answers a different question is worse than one that does not fire, so the
 * tolerance here is deliberately narrow and always reports what it matched.
 */
/** Filter keys that identify WHAT is being asked about, for carrying forward. */
const CARRYABLE_FILTERS = ['client', 'technology', 'practice', 'region', 'projectType', 'pricingModel', 'salesRep', 'stage'];

/**
 * Let a follow-up inherit the previous question's subject.
 *
 * "how many are open?" straight after charting AI/ML deals means the AI/ML
 * ones. Only applied when the follow-up names no subject of its own, so a new
 * question always wins over stale context — and the inherited filter is echoed
 * in the reply, so an inherited assumption is never invisible.
 */
function inheritFilters(params: Record<string, any>, conv: ConversationState): Record<string, any> {
    const namesItsOwn = CARRYABLE_FILTERS.some(k => params[k] != null);
    if (namesItsOwn || !conv.lastFilters) return params;
    for (const k of CARRYABLE_FILTERS) {
        if (params[k] == null && conv.lastFilters[k] != null) params[k] = conv.lastFilters[k];
    }
    return params;
}

async function enrichFiltersFromMasterData(text: string, params: Record<string, any>): Promise<Record<string, any>> {
    try {
        const master = await getMasterData();

        const COMMAND_WORDS = new RegExp(
            '\\b(' + [
                'give','me','show','list','find','search','get','display','view','all','the','a','an','of','in','for',
                'and','or','with','to','by','per','across','grouped','group','split','as','is','are','what','which',
                'chart','charts','graph','graphs','pie','donut','bar','bars','plot','diagram','visualise','visualize',
                'breakdown','distribution','trend','over','time','count','number','total','revenue','value','worth',
                'opportunity','opportunities','opp','opps','deal','deals','pipeline','project','projects','please',
                'my','our','their','this','that','top','highest','lowest','best','worst','many','much','how','there',
                'win','rate','won','lost','stage','status','client','customer','practice','region','technology',
                'sales','person','statistics','stats','summary','analysis','report','wise','breakup',
            ].join('|') + ')\\b', 'gi');

        const cleaned = ' ' + text.toLowerCase().replace(COMMAND_WORDS, ' ')
            .replace(/[^a-z0-9&/\-. ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
        const tokens = cleaned.trim().split(' ').filter(t => t.length >= 2);
        const upperTokens = (text.match(/\b[A-Z0-9]{2,8}\b/g) || []).map(t => t.toUpperCase());

        const resolve = (items: { name: string }[], opts?: { allowAcronym?: boolean }): string | null => {
            const names = (items || []).map(i => (i.name || '').trim()).filter(Boolean);

            // 1. exact phrase, longest first ("SAP HANA" beats "SAP")
            const exact = names
                .filter(n => n.length >= 3 && cleaned.includes(' ' + n.toLowerCase() + ' '))
                .sort((a, b) => b.length - a.length);
            if (exact[0]) return exact[0];

            // 2. acronym, e.g. ADM -> App Dev & Maintenance - QBAPL.
            //    NOT applied to people: someone's initials collide constantly —
            //    "ADM" is also Abhasita Das Munshi, and matching both filtered
            //    practice AND sales rep, returning nothing.
            if (opts?.allowAcronym !== false) {
                for (const n of names) {
                    const ac = acronymOf(n);
                    if (ac.length >= 2 && upperTokens.includes(ac)) return n;
                }
            }

            // 3. a close typo. Compared against each WORD of the name as well as
            //    the whole thing — "Indorma" is one edit from "Indorama" but far
            //    from the full "Indorama IIPL", so whole-name-only never matched.
            let best: { name: string; score: number } | null = null;
            for (const n of names) {
                const full = n.toLowerCase();
                const words = full.split(/[^a-z0-9]+/).filter(w => w.length >= 5);
                for (const t of tokens) {
                    if (t.length < 5) continue;

                    // Against the whole name — a typo OR an exact hit is fine.
                    const dFull = editDistance(t, full);
                    const sFull = 1 - dFull / Math.max(t.length, full.length);
                    if (sFull >= 0.85 && (!best || sFull > best.score)) best = { name: n, score: sFull };

                    // Against one word of a multi-word name, ONLY as a typo
                    // (distance >= 1). Allowing distance 0 here means any common
                    // word that happens to appear inside a name claims it.
                    for (const w of words) {
                        const d = editDistance(t, w);
                        if (d === 0 && words.length > 1) continue;
                        const score = 1 - d / Math.max(t.length, w.length);
                        if (score >= 0.85 && (!best || score > best.score)) best = { name: n, score };
                    }
                }
            }
            return best ? best.name : null;
        };

        const candidates: [string, { name: string }[]][] = [
            ['client', master.clients],
            ['technology', master.technologies],
            ['practice', master.practices],
            ['region', master.regions],
            ['pricingModel', master.pricingModels],
            ['projectType', master.projectTypes],
        ];
        for (const [key, items] of candidates) {
            if (params[key] == null) {
                const hit = resolve(items || []);
                if (hit) params[key] = hit;
            }
        }

        if (params.owner == null && params.salesRep == null) {
            const person = resolve(master.salespersons || [], { allowAcronym: false });
            if (person) params.salesRep = person;
        }
    } catch (error) {
        console.error('[Chatbot] master-data filter enrichment failed', error);
    }
    return params;
}

// ─── LLM SLOT RESCUE ────────────────────────────────────────────────────────

/**
 * Ask the model for SLOTS, not an intent — used only when the rules failed.
 *
 * The main intent prompt enumerates thirty-odd intents and their parameters.
 * On a CPU-only host that costs ~23s with a 1.5B model, because generation
 * scales with how much the model must read and write. This prompt asks for five
 * short fields and caps the output, which is the difference between ~23s and
 * ~10s on the same hardware.
 *
 * Crucially the model is NOT trusted with values. It only says which words look
 * like an entity; that string is then resolved against master data by the same
 * exact/acronym/typo matcher the rules use. So the model contributes
 * understanding of PHRASING, while the database remains the only source of
 * facts — it cannot invent a client that does not exist, or a number.
 */
/**
 * Work out what a question is asking, remembering the answer.
 *
 * A provider is asked only about phrasings never seen before. Everything else
 * is served from memory in about a millisecond, including questions that merely
 * resemble an earlier one — "revenue by client" and "show me the revenue per
 * client please" are the same question wearing different clothes.
 *
 * Only the READING is remembered, never the figures: the database is queried
 * fresh every time, so a remembered phrasing cannot serve a stale number.
 */
async function resolveSlots(message: string): Promise<Record<string, any> | null> {
    const remembered = phraseMemory.recall(message);
    if (remembered) {
        console.log(`[Chatbot] phrasing recalled (${remembered.via}) — no model call`);
        return remembered.slots;
    }
    const slots = await llmSlotRescue(message);
    if (slots) phraseMemory.remember(message, slots);
    return slots;
}

async function llmSlotRescue(message: string): Promise<Record<string, any> | null> {
    if (!LLM_ENABLED) return null;

    // The model always returns something, so it must only be asked about
    // sentences that are actually asking for a breakdown. Given "is there
    // anything worth worrying about right now?" it answered groupBy: practice,
    // and the bot drew a Total Value by Practice chart — a confident answer to a
    // question nobody asked. This gate is the difference between interpreting a
    // question and inventing one. It also saves the ~4s call on sentences the
    // rescue could never have helped with.
    const ASKS_FOR_A_BREAKDOWN = /\b(by|per|across|split|breakdown|break\s*down|compare|each|wise|chart|graph|plot|picture|visuali[sz]e|top|best|worst|biggest|highest|lowest|most|strongest|weakest|leading|performing|which|who|where|distribution|share|how\s+much|how\s+many)\b/i;
    if (!ASKS_FOR_A_BREAKDOWN.test(message)) return null;
    const providers = availableProviders();
    if (!providers.length) return null;

    const system = [
        'Extract query slots from a CRM question. Reply with JSON only.',
        'groupBy: one of client, technology, stage, practice, region, salesRep, month, projectType, pricingModel, status — or "" if none.',
        'chart: bar, pie, or none.',
        'outcome: open, closed, won, lost, or "".',
        'entity: any company, technology, practice or person named in the question, else "".',
        'A question asking "who" means salesRep unless it names a company.',
    ].join(' ');

    // Four worked examples, because a 1.5B model follows a demonstration far
    // better than a description. Each one teaches a distinction that was
    // observed going wrong: informal words for a company mean client, "who
    // sells it" means salesRep, and a named company belongs in entity rather
    // than in groupBy.
    const shots: [string, Record<string, string>][] = [
        ['which outfits are we winning the most money from',
            { groupBy: 'client', chart: 'none', outcome: 'won', entity: '' }],
        ['i want a picture of the money split up by whoever sells it',
            { groupBy: 'salesRep', chart: 'bar', outcome: '', entity: '' }],
        ['how are things going month to month',
            { groupBy: 'month', chart: 'none', outcome: '', entity: '' }],
        ['how much have we lost on Acme',
            { groupBy: '', chart: 'none', outcome: 'lost', entity: 'Acme' }],
    ];
    const shotMessages = shots.flatMap(([q, a]) => ([
        { role: 'user' as const, content: q },
        { role: 'assistant' as const, content: JSON.stringify(a) },
    ]));

    // Try each provider in turn. A key that has run out of credit answers with an
    // error, not a shrug, so the next one must get a chance rather than the
    // question falling through to the help text — which from the outside looks
    // like the bot suddenly stopped understanding things.
    let lastError = '';
    for (const provider of providers) {
        try {
            const res: any = await withTimeout(provider.client!.chat.completions.create({
                model: provider.model,
                messages: [{ role: 'system', content: system }, ...shotMessages, { role: 'user', content: message }],
                response_format: { type: 'json_object' },
                temperature: 0,
                // Generous because some providers spend tokens thinking before
                // they write. Gemini returned a bare "```json" at 80 — the reply
                // was truncated mid-fence, which reads as a broken provider
                // rather than a budget that is too small. This is a ceiling, not
                // a target: a provider that answers in 30 tokens still stops at
                // 30, so raising it costs nothing on the ones that do.
                max_tokens: 400,
            }) as any, `${provider.name} slot rescue`);

            const raw = res?.choices?.[0]?.message?.content;
            if (!raw) throw new Error('empty response');
            const slots = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim());
            noteSuccess(provider);

            const params: Record<string, any> = {};
            const DIMS = ['client', 'technology', 'stage', 'practice', 'region', 'salesRep', 'month', 'projectType', 'pricingModel', 'status'];
            if (typeof slots.groupBy === 'string' && DIMS.includes(slots.groupBy)) params.groupBy = slots.groupBy;
            if (slots.chart === 'pie' || slots.chart === 'bar') params.chartType = slots.chart;
            if (['open', 'closed', 'won', 'lost'].includes(slots.outcome)) params.outcome = slots.outcome;
            // Passed through the master-data matcher below, never used verbatim.
            if (typeof slots.entity === 'string' && slots.entity.trim()) params.__entityHint = slots.entity.trim();
            if (provider.name !== 'primary') console.log(`[Chatbot] answered by ${provider.name} provider`);
            return params;
        } catch (error) {
            lastError = (error as Error).message;
            noteFailure(provider);
            console.error(`[Chatbot] ${provider.name} slot rescue failed: ${lastError}`);
        }
    }
    console.error(`[Chatbot] every provider failed (last: ${lastError})`);
    return null;
}

/**
 * Prime the rescue prompt's prefix once, shortly after boot.
 *
 * Keeping the model resident removed the load cost but not the first-call cost:
 * the opening rescue still took ~11.5s against ~3.4s for the next one. The
 * difference is prompt evaluation. llama.cpp caches the evaluated prefix, and
 * every rescue shares the same system message and examples, so that work is
 * paid once — by whoever happens to ask first.
 *
 * This makes that first caller the server rather than a user. The question is
 * discarded; only the cached prefix matters. It never touches the database, and
 * any failure is ignored, since a cold prefix costs latency and nothing else.
 */
let slotRescueWarmed = false;
function warmSlotRescuePrefix(): void {
    if (slotRescueWarmed || !LLM_ENABLED) return;
    slotRescueWarmed = true;
    setTimeout(() => {
        llmSlotRescue('which regions are doing best')
            .then(() => console.log('[Chatbot] slot rescue prefix warmed'))
            .catch(() => { /* cold prefix is a latency cost, not an error */ });
    }, 20_000).unref();
}
warmSlotRescuePrefix();

// ─── CUSTOM CHARTS (no LLM) ─────────────────────────────────────────────────

/** Dimensions a chart can be grouped by, and the words people use for each. */
const CHART_DIMENSIONS: { key: string; label: string; match: RegExp }[] = [
    { key: 'month',        label: 'Month',         match: /\b(months?|monthly|dates?|over time|timelines?|trend(?:s|ing)?|periods?|quarters?|years?|when)\b/i },
    { key: 'client',       label: 'Client',        match: /\b(clients?|customers?|accounts?|companies|company|logos?|outfits?|firms?|organi[sz]ations?|orgs?|brands?|businesses)\b/i },
    { key: 'technology',   label: 'Technology',    match: /\b(tech|technology|technologies|stacks?|platforms?|skills?|tools?)\b/i },
    { key: 'status',       label: 'Status',        match: /\b(status|statuses|detailed\s*status|deal\s*status)\b/i },
    { key: 'stage',        label: 'Stage',         match: /\b(stages?|phases?|funnels?|pipeline\s*stages?|workflows?)\b/i },
    { key: 'practice',     label: 'Practice',      match: /\b(practices?|departments?|depts?|divisions?|verticals?|business\s*units?)\b/i },
    { key: 'region',       label: 'Region',        match: /\b(regions?|geo|geography|locations?|countr(?:y|ies)|territor(?:y|ies)|markets?)\b/i },
    { key: 'salesRep',     label: 'Sales Rep',     match: /\b(sales\s*reps?|salespersons?|sales\s*persons?|reps?|owners?|managers?|persons?|people|team\s*members?|employees?|sells|sellers?)\b/i },
    { key: 'pricingModel', label: 'Pricing Model', match: /\b(pricing(\s*model)?s?|billing(\s*model)?s?|commercial\s*models?|contract\s*types?|charges?|charging|charged|bills?|billed|rate\s*cards?)\b/i },
    { key: 'projectType',  label: 'Project Type',  match: /\b(project\s*types?|engagement\s*types?|work\s*types?|types?)\b/i },
];



/**
 * Pick the dimension a phrase is about.
 *
 * This used to be `CHART_DIMENSIONS.find(...)`, which returns the first entry in
 * *list order* that appears anywhere in the text — so the answer depended on how
 * the table happened to be sorted rather than on the sentence. "the way we
 * charge people" resolved to Sales Rep, because salesRep is listed above
 * pricingModel and matched on "people", even though "charge" came first and is
 * what the question was about.
 *
 * The head of a grouping phrase is what names the dimension, so the earliest
 * match in the text wins and list order only breaks an exact tie.
 */
function matchDimension(phrase: string): string | null {
    let bestKey: string | null = null;
    let bestAt = Infinity;
    for (const d of CHART_DIMENSIONS) {
        const m = phrase.match(d.match);
        if (!m || m.index === undefined) continue;
        if (m.index < bestAt) {
            bestAt = m.index;
            bestKey = d.key;
        }
    }
    return bestKey;
}

/**
 * Work out what chart the user asked for: what to group by, what to measure,
 * and which shape to draw. Everything here is keyword matching over a closed
 * vocabulary — no model call.
 */
/**
 * "top 3", "top five", "5 biggest" — how many rows the question asked for.
 *
 * Returns 0 when the question named no number, so callers can apply their own
 * default rather than being handed a fabricated one.
 */
const NUMBER_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
function extractTopN(lower: string): number {
    const digits = lower.match(/\b(?:top|first|bottom|last|worst|best)\s+(\d{1,2})\b/i)
        || lower.match(/\b(\d{1,2})\s+(?:biggest|largest|highest|lowest|smallest|hottest|coldest|oldest|newest)\b/i);
    if (digits) {
        const n = Number(digits[1]);
        if (n >= 1 && n <= 50) return n;
    }
    const words = lower.match(/\b(?:top|first|bottom|last)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
    if (words) return NUMBER_WORDS[words[1].toLowerCase()] || 0;
    return 0;
}

function extractChartParams(lower: string): Record<string, any> {
    const params: Record<string, any> = extractListParams(lower);

    // "sales person wise" / "client wise" — the "<dimension> wise" construction
    // is extremely common in Indian English and means exactly "by <dimension>".
    // Checked first because "wise" trails its noun, so the generic "by X" rule
    // below cannot see it.
    const wiseMatch = lower.match(/([a-z][a-z\s]{2,24}?)\s*[- ]?wise\b/i);
    if (wiseMatch) params.groupBy = matchDimension(wiseMatch[1]) || undefined;

    // A grouping phrase is the strongest signal, so it is read on its own before
    // the sentence at large. "the way we ..." and "how we ..." belong here with
    // "by" and "per": they introduce the thing being grouped on just as plainly,
    // and without them "break the numbers down the way we charge" had to fall
    // back to scanning the whole sentence for any dimension word at all.
    if (!params.groupBy) {
        const byMatch = lower.match(/\b(?:by|per|across|grouped?\s+by|split\s+by|the\s+way\s+we|how\s+we|based\s+on|according\s+to|in\s+terms\s+of)\s+([a-z\s]{3,25})/i);
        if (byMatch) params.groupBy = matchDimension(byMatch[1]) || undefined;
    }

    // Nothing said "by X", so take whichever dimension the sentence names first.
    if (!params.groupBy) params.groupBy = matchDimension(lower) || undefined;

    // "who" asks about people, but it is an interrogative rather than the name of
    // a dimension, so it is the weakest evidence there is and only counts once
    // nothing else has matched. Ranked with the real nouns it would win on
    // position alone and turn "who is our biggest client" — plainly a question
    // about clients — into a chart of sales reps.
    if (!params.groupBy && /\bwho(m|se)?\b/i.test(lower)) params.groupBy = 'salesRep';
    // "the month of August" names a period, not a grouping. Without this, any
    // question mentioning a month charted everything by month.
    if (params.groupBy === 'month' && params.period
        && !/(?:by|per)\s+month|month\s*[- ]?wise|monthly|trend/i.test(lower)) {
        delete params.groupBy;
    }

    // A chart was asked for but no dimension named ("draw me a chart",
    // "visualise the pipeline"). Answer with the most useful default rather
    // than refusing — stage is the shape people mean by "the pipeline".
    //
    // The flag matters: a defaulted groupBy is not evidence that the sentence
    // was understood. Without it every unparsed question looks like a valid
    // chart request and gets answered with the same by-stage chart, which is
    // both wrong and hides the fact that nothing was understood.
    if (!params.groupBy) {
        params.groupBy = 'stage';
        params.__groupByDefaulted = true;
    }

    // Measure: money unless they clearly asked for a count.
    const wantsCount = /\b(count|number|how many|deals?\s*count|volume)\b/i.test(lower);
    const wantsValue = /\b(value|revenue|worth|amount|money|₹|\$)\b/i.test(lower);
    params.measure = wantsCount && !wantsValue ? 'count' : 'value';
    // Same reasoning as the dimension: record whether the sentence actually said
    // which measure it wanted, so the model is consulted only where it is silent.
    // Asked for "the most money" the rules are already right, and the model's
    // guess of "count" must not be allowed to overrule them.
    if (!wantsCount && !wantsValue) params.__measureDefaulted = true;

    params.chartType = /\b(pie|donut|share|proportion|percentage|%)\b/i.test(lower) ? 'pie' : 'bar';
    return params;
}

/**
 * Build a chart by aggregating opportunities in the database.
 *
 * Deterministic end to end: the filters come from matching the question against
 * master data, the grouping is a real query, and the numbers are sums of real
 * rows — so a chart can never show a figure the database does not contain.
 */
/**
 * "open", "closed", "won", "lost" describe a deal's OUTCOME rather than naming a
 * stage, and people use them constantly ("how many are open?"). They map onto
 * the stage's own isClosed/isWon flags, so they stay correct if stages are
 * renamed or added.
 */
function extractOutcomeFilter(lower: string): 'open' | 'closed' | 'won' | 'lost' | null {
    if (/\b(still\s+)?open|active|in\s*play|ongoing|live\b/i.test(lower) && !/\bopen\s*rate\b/i.test(lower)) return 'open';
    if (/\bwon\b|\bwins?\b|closed[\s-]?won/i.test(lower)) return 'won';
    if (/\blost\b|\blosses\b|closed[\s-]?lost/i.test(lower)) return 'lost';
    if (/\bclosed\b|\bfinished\b|\bcompleted\b/i.test(lower)) return 'closed';
    return null;
}

/**
 * Constraints the user named that the data cannot satisfy.
 *
 * "Open opportunities for August in Luxembourg region" came back as twenty
 * unfiltered deals: there is no Luxembourg region, so the filter was never
 * built, and nothing noticed. Silently widening a question is the most
 * dangerous failure a reporting tool has — the answer looks fine and is about
 * something else entirely.
 *
 * So a named region, practice or technology that matches nothing known is
 * reported back rather than ignored.
 */
async function unsatisfiableFilters(message: string): Promise<string[]> {
    const master = await getMasterData();
    const complaints: string[] = [];
    // Master lists are a mix of {id,name} rows and plain strings, so both are
    // flattened to names before comparing.
    const namesOf = (list: any[]): string[] =>
        (list || []).map(x => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
    // Take at most the two words immediately before the noun, then strip leading
    // filler. Anchoring on "in|for" and reading forward swallowed the whole
    // clause: "for the month of August in Luxembourg region" produced a region
    // named "month of August in Luxembourg".
    const LEADING_FILLER = /^(?:the|a|an|in|of|for|from|to|and|our|their|this|that|month|quarter|year)\s+/i;
    const checks: { pattern: RegExp; known: any[]; label: string }[] = [
        { pattern: /([a-z][a-z.&'-]{1,20}(?:\s+[a-z][a-z.&'-]{1,20})?)\s+(?:region|geography|market)\b/i, known: master.regions || [], label: 'region' },
        { pattern: /([a-z][a-z.&'-]{1,20}(?:\s+[a-z][a-z.&'-]{1,20})?)\s+practice\b/i, known: master.practices || [], label: 'practice' },
    ];
    for (const { pattern, known, label } of checks) {
        const m = message.match(pattern);
        if (!m) continue;
        let named = m[1].trim();
        while (LEADING_FILLER.test(named)) named = named.replace(LEADING_FILLER, '').trim();
        if (!named || named.length < 3) continue;
        const knownNames = namesOf(known);
        const hit = knownNames.some(k => k.toLowerCase().includes(named.toLowerCase()) || named.toLowerCase().includes(k.toLowerCase()));
        if (!hit) {
            const examples = knownNames.slice(0, 5).join(', ');
            complaints.push(`I don't know a ${label} called **${named}**${examples ? ` — the ones on record are: ${examples}` : ''}.`);
        }
    }
    return complaints;
}

/** Shared filter builder, so list, count and chart can never disagree. */
function buildOpportunityWhere(params: any, ctx: UserContext): any {
    const where: any = { isArchived: false };
    if (params.client) where.client = { name: { contains: params.client, mode: 'insensitive' } };
    if (params.owner === '__SELF__') where.ownerId = ctx.userId;
    if (params.salesRep) where.salesRepName = { contains: params.salesRep, mode: 'insensitive' };
    if (params.technology) where.technology = { contains: params.technology, mode: 'insensitive' };
    if (params.region) where.region = { contains: params.region, mode: 'insensitive' };
    if (params.practice) where.practice = { contains: params.practice, mode: 'insensitive' };
    if (params.projectType) where.projectType = { contains: params.projectType, mode: 'insensitive' };
    if (params.pricingModel) where.pricingModel = { contains: params.pricingModel, mode: 'insensitive' };
    if (params.minValue) where.value = { gte: params.minValue };
    if (params.maxValue) where.value = { ...(where.value || {}), lte: params.maxValue };
    // A period applies to whichever date the question was about.
    if (params.period) {
        const { start, end, sense } = params.period as Period;
        if (sense === 'created') {
            where.createdAt = { gte: start, lt: end };
        } else if (sense === 'closed') {
            where.actualCloseDate = { gte: start, lt: end };
        } else {
            // Alive during the window: began before it ended, and had not
            // finished before it started. A deal opened in March and still open
            // today was open all through August without either date landing in it.
            where.createdAt = { lt: end };
            where.OR = [
                { actualCloseDate: null },
                { actualCloseDate: { gte: start } },
            ];
        }
    }

    // Outcome is expressed through the stage's own flags rather than a name
    // list, so renaming or adding a stage cannot silently break it.
    if (params.outcome === 'open') where.stage = { isClosed: false };
    else if (params.outcome === 'closed') where.stage = { isClosed: true };
    else if (params.outcome === 'won') where.stage = { isWon: true };
    else if (params.outcome === 'lost') where.stage = { isClosed: true, isWon: false };
    return where;
}

/** Answer "how many …" with a real count plus the total value behind it. */
async function execCountOpportunities(params: any, ctx: UserContext): Promise<ActionResult> {
    const where = buildOpportunityWhere(params, ctx);
    if (params.stage) {
        const stage = await prisma.stage.findFirst({ where: { name: { contains: params.stage, mode: 'insensitive' } } });
        if (stage) where.stageId = stage.id;
    }
    const [count, agg] = await Promise.all([
        prisma.opportunity.count({ where }),
        prisma.opportunity.aggregate({ where, _sum: { value: true } }),
    ]);
    const total = Number(agg._sum.value || 0);
    const bits = ['outcome', 'client', 'technology', 'region', 'practice', 'stage', 'salesRep', 'projectType', 'pricingModel']
        .filter(k => params[k]).map(k => `${k}: ${params[k]}`);
    if (params.period) {
        const pr = params.period as Period;
        const verb = pr.sense === 'created' ? 'created in' : pr.sense === 'closed' ? 'closed in' : 'active during';
        bits.push(`${verb} ${pr.label}`);
    }
    const scope = bits.length ? ` matching ${bits.join(', ')}` : '';
    return {
        tool: 'count_opportunities', success: true,
        summary: count === 0
            ? `No opportunities found${scope}.`
            : `**${count}** opportunit${count === 1 ? 'y' : 'ies'}${scope}, worth **${money(total)}** in total.`,
    };
}

/**
 * Win rate — won against lost, over closed deals only.
 *
 * Open deals are excluded deliberately: a deal still in flight has not been won
 * or lost, and counting it as "not won" would understate the rate. This is one
 * of the few genuine part-to-whole questions in the CRM, which is why a pie is
 * actually the right shape here.
 */
async function execWinRate(params: any, ctx: UserContext): Promise<ActionResult> {
    const where = buildOpportunityWhere(params, ctx);
    const opps = await prisma.opportunity.findMany({
        where, include: { stage: true },
    });

    let won = 0, lost = 0, wonValue = 0, lostValue = 0;
    for (const o of opps) {
        const closed = o.stage?.isClosed === true || CLOSED_STAGE_NAMES_BOT.includes(o.stage?.name || o.currentStage || '');
        if (!closed) continue;
        const isWon = o.stage?.isWon === true || /closed[\s-]?won|delivered/i.test(o.stage?.name || o.currentStage || '');
        if (isWon) { won++; wonValue += Number(o.value) || 0; }
        else { lost++; lostValue += Number(o.value) || 0; }
    }

    const closedTotal = won + lost;
    if (closedTotal === 0) {
        return {
            tool: 'win_rate', success: true,
            summary: 'No closed deals yet, so there is no win rate to report.',
        };
    }

    const rate = (won / closedTotal) * 100;
    const bits = ['client', 'technology', 'region', 'practice', 'salesRep', 'projectType', 'pricingModel']
        .filter(k => params[k]).map(k => `${k}: ${params[k]}`);
    const scope = bits.length ? ` (${bits.join(', ')})` : '';

    return {
        tool: 'win_rate', success: true,
        summary: `**Win rate: ${rate.toFixed(1)}%**${scope} — **${won}** won vs **${lost}** lost across ${closedTotal} closed deal${closedTotal === 1 ? '' : 's'}. Won ${money(wonValue)}, lost ${money(lostValue)}.`,
        data: {
            type: 'chart',
            chartType: params.chartType === 'bar' ? 'bar' : 'pie',
            title: `Win rate — ${rate.toFixed(1)}%${scope}`,
            measure: 'count',
            labels: ['Won', 'Lost'],
            datasets: [{ label: 'Deals', data: [won, lost] }],
        },
    };
}

async function execCustomChart(params: any, ctx: UserContext): Promise<ActionResult> {
    const where: any = { isArchived: false };
    if (params.stage) {
        const stage = await prisma.stage.findFirst({ where: { name: { contains: params.stage, mode: 'insensitive' } } });
        if (stage) where.stageId = stage.id;
    }
    if (params.client) where.client = { name: { contains: params.client, mode: 'insensitive' } };
    if (params.owner === '__SELF__') where.ownerId = ctx.userId;
    if (params.salesRep) where.salesRepName = { contains: params.salesRep, mode: 'insensitive' };
    if (params.technology) where.technology = { contains: params.technology, mode: 'insensitive' };
    if (params.region) where.region = { contains: params.region, mode: 'insensitive' };
    if (params.practice) where.practice = { contains: params.practice, mode: 'insensitive' };
    if (params.projectType) where.projectType = { contains: params.projectType, mode: 'insensitive' };
    if (params.pricingModel) where.pricingModel = { contains: params.pricingModel, mode: 'insensitive' };
    if (params.minValue) where.value = { gte: params.minValue };
    if (params.maxValue) where.value = { ...(where.value || {}), lte: params.maxValue };
    if (params.outcome === 'open') where.stage = { isClosed: false };
    else if (params.outcome === 'closed') where.stage = { isClosed: true };
    else if (params.outcome === 'won') where.stage = { isWon: true };
    else if (params.outcome === 'lost') where.stage = { isClosed: true, isWon: false };

    const opps = await prisma.opportunity.findMany({
        where,
        include: { client: true, stage: true, owner: { select: { name: true } } },
    });

    if (opps.length === 0) {
        return {
            tool: 'custom_chart', success: true,
            summary: 'No opportunities match that, so there is nothing to chart.',
        };
    }

    const groupBy: string = params.groupBy || 'stage';
    const measure: string = params.measure === 'count' ? 'count' : 'value';

    const keyOf = (o: any): string => {
        switch (groupBy) {
            case 'client': return o.client?.name || 'Unknown';
            case 'stage': return o.stage?.name || o.currentStage || 'Unknown';
            case 'technology': return (o.technology || 'Unspecified').split(',')[0].trim() || 'Unspecified';
            case 'practice': return o.practice || 'Unspecified';
            case 'region': return o.region || 'Unspecified';
            case 'salesRep': return o.salesRepName || o.owner?.name || 'Unassigned';
            case 'projectType': return o.projectType || 'Unspecified';
            case 'pricingModel': return o.pricingModel || 'Unspecified';
            case 'status': return o.detailedStatus || '(none)';
            case 'month': {
                const d = o.expectedCloseDate || o.actualCloseDate || o.createdAt;
                if (!d) return 'Undated';
                const dt = new Date(d);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            }
            default: return 'Unknown';
        }
    };

    const totals = new Map<string, number>();
    for (const o of opps) {
        const k = keyOf(o);
        const add = measure === 'count' ? 1 : Number(o.value) || 0;
        totals.set(k, (totals.get(k) || 0) + add);
    }

    // Months read chronologically; everything else biggest-first.
    let entries = Array.from(totals.entries());
    entries = groupBy === 'month'
        ? entries.sort((a, b) => a[0].localeCompare(b[0]))
        : entries.sort((a, b) => b[1] - a[1]);

    // A chart with fifty slices communicates nothing — keep the leaders and
    // roll the tail into one "Other" so the total still reconciles.
    const MAX_SLICES = params.chartType === 'pie' ? 8 : 15;
    let labels = entries.map(e => e[0]);
    let values = entries.map(e => e[1]);
    if (entries.length > MAX_SLICES && groupBy !== 'month') {
        const head = entries.slice(0, MAX_SLICES);
        const tail = entries.slice(MAX_SLICES);
        labels = [...head.map(e => e[0]), `Other (${tail.length})`];
        values = [...head.map(e => e[1]), tail.reduce((s, e) => s + e[1], 0)];
    }

    const dimLabel = CHART_DIMENSIONS.find(d => d.key === groupBy)?.label || groupBy;
    const measureLabel = measure === 'count' ? 'Deal Count' : 'Total Value';
    const grand = values.reduce((s, v) => s + v, 0);
    const fmt = (n: number) => measure === 'count' ? String(n) : money(n);

    const filterBits = ['outcome', 'client', 'technology', 'region', 'practice', 'stage', 'salesRep', 'projectType', 'pricingModel']
        .filter(k => params[k]).map(k => `${k}: ${params[k]}`);
    const scope = filterBits.length ? ` (${filterBits.join(', ')})` : '';

    return {
        tool: 'custom_chart', success: true,
        summary: `**${measureLabel} by ${dimLabel}**${scope} — ${opps.length} opportunit${opps.length === 1 ? 'y' : 'ies'}, total ${fmt(grand)}.`,
        data: {
            type: 'chart',
            chartType: params.chartType === 'pie' ? 'pie' : 'bar',
            title: `${measureLabel} by ${dimLabel}${scope}`,
            measure,
            labels,
            datasets: [{ label: measureLabel, data: values }],
        },
    };
}

// ─── SMART ENTITY EXTRACTION FROM PLAIN LANGUAGE ────────────────────────────

/**
 * Extracts opportunity fields by fuzzy-matching tokens/phrases against master data.
 * E.g., "AMDS PowerBI" → { client: 'AMDS', technology: 'Power BI' }
 * Tries multi-word phrases first (longest match), then single tokens.
 */
function smartExtractFromMasterData(text: string, master: MasterDataCache): Record<string, any> {
    const extracted: Record<string, any> = {};
    // Strip common command words so they don't interfere with matching
    const cleaned = text.replace(/\b(create|add|new|register|opportunity|deal|opp|project|for|with|using|please|the|an?)\b/gi, ' ').trim();
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    if (words.length === 0) return extracted;

    // Build phrases: try 3-word, 2-word, then 1-word combos
    const phrases: string[] = [];
    for (let len = Math.min(3, words.length); len >= 1; len--) {
        for (let i = 0; i <= words.length - len; i++) {
            phrases.push(words.slice(i, i + len).join(' '));
        }
    }

    const matchedPhrases = new Set<string>();

    // Master categories to match against, in priority order
    const categories: { key: string; items: { id: string; name: string }[]; idKey?: string }[] = [
        { key: 'client', items: master.clients, idKey: '_clientId' },
        { key: 'technology', items: master.technologies },
        { key: 'region', items: master.regions },
        { key: 'pricingModel', items: master.pricingModels },
        { key: 'projectType', items: master.projectTypes },
    ];

    for (const phrase of phrases) {
        // Skip if any word in this phrase was already matched
        const phraseWords = phrase.toLowerCase().split(/\s+/);
        if (phraseWords.some(w => matchedPhrases.has(w))) continue;

        for (const cat of categories) {
            if (extracted[cat.key]) continue; // already found for this category
            const result = fuzzyMatch(phrase, cat.items, 0.6); // higher threshold for plain language
            if (result.exact && result.match) {
                extracted[cat.key] = result.match.name;
                if (cat.idKey) extracted[cat.idKey] = result.match.id;
                // Only mark the matched entity's name words as consumed (not entire phrase)
                result.match.name.toLowerCase().split(/\s+/).forEach(w => matchedPhrases.add(w));
                break;
            }
        }
    }

    return extracted;
}

// ─── PERMISSION CHECKS ─────────────────────────────────────────────────────

function canExecute(intent: string, permissions: string[]): boolean {
    if (permissions.includes('*')) return true;
    switch (intent) {
        case 'list_opportunities': case 'get_details': case 'deal_health':
        case 'list_comments': case 'gom_status': case 'custom_chart':
        case 'count_opportunities': case 'win_rate':
            return permissions.includes('pipeline:view');
        case 'update_opportunity': case 'create_opportunity':
        case 'add_comment': case 'convert_opportunity':
        case 'move_to_presales': case 'move_to_sales': case 'proposal_sent':
        case 'mark_lost': case 'reestimate':
            return permissions.includes('pipeline:write');
        case 'approve_gom':
            return permissions.includes('presales:write');
        case 'review_gom':
            return permissions.includes('presales:write') || permissions.includes('approvals:manage');
        case 'pipeline_analytics': case 'revenue_analytics': case 'forecast':
            return permissions.includes('analytics:view');
        case 'create_lead':
            return permissions.includes('leads:manage');
        case 'list_contacts': case 'get_contact':
            return true; // all authenticated users
        case 'create_contact': case 'update_contact': case 'delete_contact':
            return true; // all authenticated users
        case 'list_users':
            return permissions.includes('pipeline:view'); // viewable by most roles
        case 'list_audit_logs':
            return permissions.includes('auditlogs:view');
        case 'list_resources':
            return permissions.includes('resources:manage') || permissions.includes('pipeline:view');
        case 'my_profile':
            return true;
        default: return true;
    }
}

// ─── TOOL EXECUTORS ─────────────────────────────────────────────────────────

async function execListOpportunities(params: any, ctx: UserContext): Promise<ActionResult> {
    // Built by the shared builder, which is the whole point of it existing.
    // This function used to assemble its own where clause and, in doing so,
    // quietly dropped every filter the builder knows about that it did not —
    // outcome above all. Asked for "the open opportunities" it returned closed
    // won and closed lost deals among them, because nothing here had ever
    // looked at params.outcome.
    const where: any = buildOpportunityWhere(params, ctx);
    if (params.stage) {
        const stage = await prisma.stage.findFirst({ where: { name: { contains: params.stage, mode: 'insensitive' } } });
        if (stage) where.stageId = stage.id;
    }
    if (params.search) where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { client: { name: { contains: params.search, mode: 'insensitive' } } },
    ];
    const opps = await prisma.opportunity.findMany({
        where, take: Math.min(params.limit || 20, 50), orderBy: { updatedAt: 'desc' },
        include: { client: true, stage: true, owner: { select: { name: true } } },
    });
    const data = opps.map(o => ({
        id: o.id, title: o.title, client: o.client?.name || '-', stage: o.stage?.name || '-',
        value: Number(o.value), owner: o.owner?.name || '-', technology: o.technology || '-',
        region: o.region || '-', priority: o.priority || '-', probability: o.probability, updatedAt: o.updatedAt,
    }));
    // Name the filters back. "Found 20 opportunities" gives the reader no way to
    // tell whether their region, period or outcome was understood — and a filter
    // that was quietly dropped looks exactly like one that matched everything.
    const scopeBits = ['outcome', 'client', 'technology', 'region', 'practice', 'stage', 'salesRep', 'projectType', 'pricingModel']
        .filter(k => params[k]).map(k => `${k}: ${params[k]}`);
    if (params.period) {
        const pr = params.period as Period;
        const verb = pr.sense === 'created' ? 'created in' : pr.sense === 'closed' ? 'closed in' : 'active during';
        scopeBits.push(`${verb} ${pr.label}`);
    }
    const scope = scopeBits.length ? ` matching ${scopeBits.join(', ')}` : '';
    const capped = data.length >= Math.min(params.limit || 20, 50) ? ' (showing the first page)' : '';

    return {
        tool: 'list_opportunities', success: true,
        summary: data.length > 0
            ? `Found **${data.length}** opportunities${scope}${capped}.`
            : `No opportunities found${scope || ' matching your criteria'}.`,
        data: { type: 'table', columns: ['Title', 'Client', 'Stage', 'Value', 'Owner', 'Technology', 'Region', 'Priority'], rows: data },
    };
}

async function execGetDetails(params: any): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36)
        opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId }, include: { client: true, stage: true, owner: { select: { name: true, email: true } }, notes: { take: 5, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } } } });
    if (!opp)
        opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false }, include: { client: true, stage: true, owner: { select: { name: true, email: true } }, notes: { take: 5, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } } } });
    if (!opp) return { tool: 'get_details', success: false, summary: `Could not find opportunity matching "${params.nameOrId}".` };
    return {
        tool: 'get_details', success: true, summary: `Details for **"${opp.title}"**`,
        data: {
            type: 'detail',
            opportunity: {
                id: opp.id, title: opp.title, client: opp.client?.name, stage: opp.stage?.name,
                value: Number(opp.value), currency: opp.currency, owner: opp.owner?.name,
                description: opp.description, technology: opp.technology, region: opp.region,
                practice: opp.practice, projectType: opp.projectType, priority: opp.priority,
                probability: opp.probability, gomApproved: opp.gomApproved,
                pricingModel: opp.pricingModel, salesRepName: opp.salesRepName,
                managerName: opp.managerName, expectedDayRate: opp.expectedDayRate ? Number(opp.expectedDayRate) : null,
                tentativeStartDate: opp.tentativeStartDate, tentativeEndDate: opp.tentativeEndDate,
                tentativeDuration: opp.tentativeDuration, tentativeDurationUnit: opp.tentativeDurationUnit,
                expectedCloseDate: opp.expectedCloseDate, reEstimateCount: opp.reEstimateCount,
                detailedStatus: opp.detailedStatus, source: opp.source, tags: opp.tags,
                createdAt: opp.createdAt, updatedAt: opp.updatedAt,
                recentComments: opp.notes?.map((n: any) => ({ author: n.author?.name, content: n.content, date: n.createdAt })),
            },
        },
    };
}

async function execUpdateOpportunity(params: any, ctx: UserContext): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36)
        opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId }, include: { stage: true } });
    if (!opp)
        opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false }, include: { stage: true } });
    if (!opp) return { tool: 'update_opportunity', success: false, summary: `Could not find opportunity matching "${params.nameOrId}".` };

    const update: any = {};
    const changes: string[] = [];

    if (params.stage) {
        const master = await getMasterData();
        const stageMatch = fuzzyMatch(params.stage, master.stages);
        let newStage: any = null;
        if (stageMatch.exact && stageMatch.match) newStage = master.stages.find(s => s.id === stageMatch.match!.id);
        else newStage = await prisma.stage.findFirst({ where: { name: { contains: params.stage, mode: 'insensitive' } } });
        if (!newStage) {
            const available = master.stages.map(s => s.name).join(', ');
            return { tool: 'update_opportunity', success: false, summary: `Stage "${params.stage}" not found.\n\nAvailable stages: **${available}**` };
        }
        if (newStage.name === 'Proposal' && !opp.gomApproved)
            return { tool: 'update_opportunity', success: false, summary: `Cannot move **"${opp.title}"** to Proposal - **GOM approval is required first**.` };
        const isReestimate = (opp.stage?.name === 'Proposal' || opp.stage?.name === 'Negotiation') && newStage.name === 'Qualification';
        if (isReestimate) {
            update.reEstimateCount = { increment: 1 };
            update.detailedStatus = 'Sent for Re-estimate';
            update.gomApproved = false;
            changes.push('sent back for re-estimation (GOM reset)');
        }
        update.stageId = newStage.id;
        update.currentStage = newStage.name;
        update.probability = newStage.probability;
        changes.push(`stage: ${opp.stage?.name} -> ${newStage.name}`);
        if (newStage.isClosed) {
            update.actualCloseDate = new Date();
            update.detailedStatus = newStage.isWon ? 'SOW Approved' : 'Lost';
        }
        await recordStageEntry(opp.id, newStage.id);
    }

    const fieldMap: Record<string, string> = {
        value: 'value', description: 'description', technology: 'technology',
        region: 'region', practice: 'practice', projectType: 'projectType',
        salesRepName: 'salesRepName', managerName: 'managerName', priority: 'priority',
        pricingModel: 'pricingModel', expectedDayRate: 'expectedDayRate',
        currency: 'currency', source: 'source', tags: 'tags',
    };
    for (const [paramKey, dbKey] of Object.entries(fieldMap)) {
        if (params[paramKey] !== undefined) {
            update[dbKey] = params[paramKey];
            changes.push(`${paramKey}: -> ${params[paramKey]}`);
        }
    }
    if (params.tentativeStartDate) { update.tentativeStartDate = new Date(params.tentativeStartDate); changes.push(`start date: -> ${params.tentativeStartDate}`); }
    if (params.tentativeEndDate) { update.tentativeEndDate = new Date(params.tentativeEndDate); changes.push(`end date: -> ${params.tentativeEndDate}`); }
    if (params.expectedCloseDate) { update.expectedCloseDate = new Date(params.expectedCloseDate); changes.push(`close date: -> ${params.expectedCloseDate}`); }
    if (params.tentativeDuration) {
        const dur = parseDuration(params.tentativeDuration);
        if (dur) { update.tentativeDuration = dur.duration; update.tentativeDurationUnit = dur.unit; changes.push(`duration: -> ${dur.duration} ${dur.unit}`); }
    }

    if (Object.keys(update).length === 0)
        return { tool: 'update_opportunity', success: false, summary: 'No valid fields to update.' };

    await prisma.opportunity.update({ where: { id: opp.id }, data: update });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: params.stage ? 'STAGE_CHANGE' : 'UPDATE', changes: changes.join('; '), userId: ctx.userId } });
    return { tool: 'update_opportunity', success: true, summary: `Updated **"${opp.title}"**: ${changes.join(', ')}`, data: { opportunityId: opp.id } };
}

async function execCreateOpportunity(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.title) return { tool: 'create_opportunity', success: false, summary: 'Title is required.' };

    let clientId: string;
    if (params._clientId) {
        clientId = params._clientId;
    } else if (params.client) {
        let client = await prisma.client.findFirst({ where: { name: { contains: params.client, mode: 'insensitive' } } });
        if (!client) client = await prisma.client.create({ data: { name: params.client, industry: 'Unknown' } });
        clientId = client.id;
    } else {
        const first = await prisma.client.findFirst();
        if (!first) return { tool: 'create_opportunity', success: false, summary: 'No clients exist in system.' };
        clientId = first.id;
    }

    const discoveryStage = await prisma.stage.findFirst({ where: { name: { contains: 'Discovery', mode: 'insensitive' } } });
    const defaultType = await prisma.opportunityType.findFirst();
    if (!discoveryStage || !defaultType) return { tool: 'create_opportunity', success: false, summary: 'System config error: missing stage or type.' };

    const cur = params.currency || 'USD';
    const data: any = {
        title: params.title, value: params.value || 0, tags: params.tags || '',
        currency: cur, description: params.description || '',
        technology: params.technology || null, region: params.region || null,
        practice: params.practice || null, projectType: params.projectType || null,
        salesRepName: params.salesRepName || null, managerName: params.managerName || null,
        pricingModel: params.pricingModel || null, source: params.source || null,
        priority: params.priority || 'Medium',
        stageId: discoveryStage.id, currentStage: discoveryStage.name,
        probability: discoveryStage.probability || 10,
        ownerId: ctx.userId, typeId: defaultType.id, clientId,
    };
    if (params.expectedDayRate) data.expectedDayRate = params.expectedDayRate;
    if (params.tentativeStartDate) data.tentativeStartDate = new Date(params.tentativeStartDate);
    if (params.expectedCloseDate) data.expectedCloseDate = new Date(params.expectedCloseDate);
    if (params.tentativeDuration) {
        const dur = parseDuration(params.tentativeDuration);
        if (dur) {
            data.tentativeDuration = dur.duration;
            data.tentativeDurationUnit = dur.unit;
            if (data.tentativeStartDate) {
                const endDate = new Date(data.tentativeStartDate);
                const qty = parseInt(dur.duration);
                if (dur.unit === 'days') endDate.setDate(endDate.getDate() + qty);
                else if (dur.unit === 'weeks') endDate.setDate(endDate.getDate() + qty * 7);
                else if (dur.unit === 'months') endDate.setMonth(endDate.getMonth() + qty);
                else if (dur.unit === 'years') endDate.setFullYear(endDate.getFullYear() + qty);
                data.tentativeEndDate = endDate;
            }
        }
    }

    const opp = await prisma.opportunity.create({ data });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'CREATE', changes: `Created via AI Chat: ${params.title} (value: ${params.value || 0})`, userId: ctx.userId } });
    await recordStageEntry(opp.id, discoveryStage.id, opp.createdAt);
    return {
        tool: 'create_opportunity', success: true,
        summary: `Created opportunity **"${params.title}"** in Discovery stage.\n- Client: ${params.client || 'Default'}\n- Value: ${cur} ${Number(params.value || 0).toLocaleString()}\n- Technology: ${params.technology || '-'}\n- Region: ${params.region || '-'}\n- Pricing: ${params.pricingModel || '-'}\n- Sales Rep: ${params.salesRepName || '-'}`,
        data: { opportunityId: opp.id },
    };
}

async function execPipelineAnalytics(): Promise<ActionResult> {
    const stages = await prisma.stage.findMany({ orderBy: { order: 'asc' } });
    const opps = await prisma.opportunity.findMany({ where: { isArchived: false }, include: { stage: true } });
    const countByStage: Record<string, number> = {};
    const valueByStage: Record<string, number> = {};
    let activeCount = 0, wonCount = 0, lostCount = 0, totalClosedCount = 0, pipelineValue = 0, weightedValue = 0;
    for (const stage of stages) { countByStage[stage.name] = 0; valueByStage[stage.name] = 0; }
    for (const opp of opps) {
        const sName = opp.stage?.name || 'Unknown';
        countByStage[sName] = (countByStage[sName] || 0) + 1;
        valueByStage[sName] = (valueByStage[sName] || 0) + Number(opp.value);
        if (opp.stage?.isClosed) { totalClosedCount++; if (opp.stage.isWon) wonCount++; else lostCount++; }
        else { activeCount++; pipelineValue += Number(opp.value); weightedValue += Number(opp.value) * (opp.probability / 100); }
    }
    const convRate = totalClosedCount > 0 ? ((wonCount / totalClosedCount) * 100).toFixed(1) : '0';
    return {
        tool: 'pipeline_analytics', success: true,
        summary: `Pipeline: **${activeCount}** active deals worth **${money(pipelineValue)}**. Conversion rate: **${convRate}%**.`,
        data: {
            type: 'chart', chartType: 'bar', title: 'Pipeline by Stage',
            labels: Object.keys(countByStage),
            datasets: [
                { label: 'Count', data: Object.values(countByStage) },
                { label: 'Value ($K)', data: Object.values(valueByStage).map(v => Math.round(v / 1000)) },
            ],
            metrics: { activeCount, wonCount, lostCount, conversionRate: `${convRate}%`, pipelineValue, weightedPipeline: Math.round(weightedValue), avgDealValue: activeCount > 0 ? Math.round(pipelineValue / activeCount) : 0 },
        },
    };
}

async function execRevenueAnalytics(params: any): Promise<ActionResult> {
    const opps = await prisma.opportunity.findMany({ where: { isArchived: false }, include: { client: true, owner: { select: { name: true } }, stage: true } });
    const groupBy = params.groupBy || 'technology';
    const grouped: Record<string, { count: number; value: number }> = {};
    for (const opp of opps) {
        let keys: string[] = [];
        if (groupBy === 'technology') keys = (opp.technology || 'Unknown').split(',').map(t => t.trim()).filter(Boolean);
        else if (groupBy === 'client') keys = [opp.client?.name || 'Unknown'];
        else if (groupBy === 'owner') keys = [opp.owner?.name || 'Unknown'];
        else if (groupBy === 'month') { const d = opp.createdAt; keys = [`${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`]; }
        else keys = ['Unknown'];
        for (const k of keys) { if (!grouped[k]) grouped[k] = { count: 0, value: 0 }; grouped[k].count++; grouped[k].value += Number(opp.value); }
    }
    const sorted = Object.entries(grouped).sort((a, b) => b[1].value - a[1].value).slice(0, 15);
    return {
        tool: 'revenue_analytics', success: true,
        summary: `Revenue by ${groupBy}: **${sorted.length}** groups. Top: **${sorted[0]?.[0]}** (${money(sorted[0]?.[1]?.value || 0)}).`,
        data: {
            type: 'chart', chartType: groupBy === 'month' ? 'line' : 'bar',
            title: `Revenue by ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`,
            labels: sorted.map(e => e[0]),
            datasets: [
                { label: 'Value ($K)', data: sorted.map(e => Math.round(e[1].value / 1000)) },
                { label: 'Count', data: sorted.map(e => e[1].count) },
            ],
        },
    };
}

/**
 * Hot and cold deals, using the DASHBOARD's definition rather than a new one.
 *
 * There, cold means an open deal that is stalled, and a deal is stalled when it
 * has had no activity — no edit and no comment — for the configured window
 * (Admin > Budget Assumptions, default 30 days), or when someone has put it On
 * Hold by hand. Hot is the rest of the open pipeline. Closed deals are neither,
 * since a finished deal carries no risk.
 *
 * Matching that definition matters more than picking a good one: a bot that
 * answers "cold" differently from the tile the user just clicked is worse than
 * one that cannot answer at all.
 */
async function execHotCold(params: any, ctx: UserContext): Promise<ActionResult> {
    const wantsCold = params.temperature === 'cold';
    const limit = params.limit && params.limit > 0 ? params.limit : 5;

    const config = await prisma.systemConfig.findUnique({ where: { key: 'budget_assumptions' } });
    const rawThreshold = Number((config?.value as any)?.stalledDaysThreshold);
    const thresholdDays = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 30;

    const opps = await prisma.opportunity.findMany({
        where: { isArchived: false, stage: { isClosed: false }, ...buildOpportunityWhere(params, ctx) },
        include: {
            client: { select: { name: true } },
            stage: { select: { name: true } },
            owner: { select: { name: true } },
            notes: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });

    const now = Date.now();
    const scored = opps.map(o => {
        // Last activity is the later of an edit and a comment — the same pair the
        // opportunities list uses, so the two agree on what "quiet" means.
        const lastNote = o.notes[0]?.createdAt ? new Date(o.notes[0].createdAt).getTime() : 0;
        const lastActivity = Math.max(new Date(o.updatedAt).getTime(), lastNote);
        const idleDays = Math.max(0, Math.floor((now - lastActivity) / 86_400_000));
        return {
            id: o.id,
            title: o.title,
            client: o.client?.name || '-',
            stage: o.stage?.name || '-',
            owner: o.owner?.name || '-',
            value: Number(o.value) || 0,
            idleDays,
            stalled: !!o.isStalled || idleDays > thresholdDays,
        };
    });

    const picked = scored.filter(o => o.stalled === wantsCold);
    // Cold: the most neglected first. Hot: the most recently touched first, with
    // value breaking ties, since that is what "hottest" is asking about.
    picked.sort((a, b) => wantsCold
        ? (b.idleDays - a.idleDays) || (b.value - a.value)
        : (a.idleDays - b.idleDays) || (b.value - a.value));

    const shown = picked.slice(0, limit);
    const label = wantsCold ? 'Cold' : 'Hot';
    const total = picked.reduce((sum, o) => sum + o.value, 0);

    if (!picked.length) {
        return { tool: 'hot_cold', success: true, summary: `No ${label.toLowerCase()} opportunities right now.`, data: null };
    }

    const lines = shown.map((o, i) =>
        `${i + 1}. **${o.title}** — ${o.client} · ${o.stage} · ${money(o.value)} · ${o.idleDays}d since last activity`);

    const heading = picked.length > shown.length
        ? `**${label} opportunities** — showing top ${shown.length} of ${picked.length}, ${money(total)} in total`
        : `**${label} opportunities** — ${picked.length}, ${money(total)} in total`;
    const rule = wantsCold
        ? `_Cold = open deals with no edit or comment for over ${thresholdDays} days, or marked On Hold._`
        : `_Hot = open deals with recent activity (within ${thresholdDays} days)._`;

    return {
        tool: 'hot_cold',
        success: true,
        summary: [heading, '', ...lines, '', rule].join('\n'),
        data: { type: 'table', title: `${label} Opportunities`, rows: shown },
    };
}

async function execDealHealth(): Promise<ActionResult> {
    const now = new Date();
    const opps = await prisma.opportunity.findMany({ where: { isArchived: false, stage: { isClosed: false } }, include: { client: true, stage: true, owner: { select: { name: true } } } });
    const stalled: any[] = [], atRisk: any[] = [];
    for (const opp of opps) {
        const days = Math.floor((now.getTime() - opp.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        const item = { id: opp.id, title: opp.title, client: opp.client?.name || '-', stage: opp.stage?.name || '-', value: Number(opp.value), owner: opp.owner?.name || '-', daysSinceUpdate: days };
        if (days > 30) stalled.push(item); else if (days > 14) atRisk.push(item);
    }
    stalled.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
    atRisk.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
    return {
        tool: 'deal_health', success: true,
        summary: `**${stalled.length}** stalled deals (30+ days), **${atRisk.length}** at-risk (14-30 days).`,
        data: { type: 'health', stalled: stalled.slice(0, 10), atRisk: atRisk.slice(0, 10), totalActive: opps.length },
    };
}

async function execForecast(): Promise<ActionResult> {
    const opps = await prisma.opportunity.findMany({ where: { isArchived: false, stage: { isClosed: false } }, include: { stage: true } });
    let pipelineValue = 0, weightedValue = 0;
    const byStage: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const opp of opps) {
        const val = Number(opp.value), prob = opp.probability || 0;
        pipelineValue += val; weightedValue += val * (prob / 100);
        const sn = opp.stage?.name || 'Unknown';
        if (!byStage[sn]) byStage[sn] = { count: 0, value: 0, weighted: 0 };
        byStage[sn].count++; byStage[sn].value += val; byStage[sn].weighted += val * (prob / 100);
    }
    return {
        tool: 'forecast', success: true,
        summary: `Pipeline: **${money(pipelineValue)}** total, **${money(weightedValue)}** weighted forecast (${((weightedValue / (pipelineValue || 1)) * 100).toFixed(1)}% confidence).`,
        data: {
            type: 'chart', chartType: 'bar', title: 'Weighted Pipeline Forecast',
            labels: Object.keys(byStage),
            datasets: [
                { label: 'Pipeline Value ($K)', data: Object.values(byStage).map(s => Math.round(s.value / 1000)) },
                { label: 'Weighted Forecast ($K)', data: Object.values(byStage).map(s => Math.round(s.weighted / 1000)) },
            ],
            metrics: { totalPipeline: pipelineValue, weightedForecast: Math.round(weightedValue), confidence: `${((weightedValue / (pipelineValue || 1)) * 100).toFixed(1)}%`, dealCount: opps.length },
        },
    };
}

// ─── LEAD EXECUTOR ──────────────────────────────────────────────────────────

const LEAD_FIELDS: FieldDef[] = [
    { key: 'title', label: 'Lead Title', required: true, type: 'string', prompt: 'What is the lead title? (e.g., "New CRM Deal - Acme Corp")' },
    { key: 'companyName', label: 'Company', required: true, type: 'string', prompt: 'What is the company name?' },
    { key: 'contactFirstName', label: 'Contact First Name', required: true, type: 'string', prompt: 'Contact person first name?' },
    { key: 'contactLastName', label: 'Contact Last Name', required: true, type: 'string', prompt: 'Contact person last name?' },
    { key: 'contactEmail', label: 'Contact Email', required: true, type: 'string', prompt: 'Contact email address?', validate: v => (!v || !v.includes('@')) ? 'Please enter a valid email address.' : null },
    { key: 'contactTitle', label: 'Contact Job Title', required: false, type: 'string', prompt: 'Contact job title? (e.g., VP of Sales, CTO, or "skip")' },
    { key: 'value', label: 'Estimated Value', required: false, type: 'number', prompt: 'Estimated deal value? (e.g., 500K, or "skip")' },
    { key: 'source', label: 'Lead Source', required: false, type: 'select', options: ['Inbound Demo Request', 'Contact Form', 'Referral', 'Event', 'Cold Outreach', 'Partner', 'Website', 'Other'], prompt: 'Lead source? (Inbound Demo Request / Contact Form / Referral / Event / Cold Outreach / Partner / Website / Other, or "skip")' },
    { key: 'description', label: 'Description', required: false, type: 'string', prompt: 'Brief description? (or "skip")' },
];

async function execCreateLead(params: any, ctx: UserContext): Promise<ActionResult> {
    let clientId: string | undefined;
    let contact: any = null;

    // Check for existing contact by email
    if (params.contactEmail) {
        contact = await prisma.contact.findFirst({ where: { email: params.contactEmail }, include: { client: true } });
        if (contact) clientId = contact.clientId;
    }

    // Create client if needed
    if (!clientId && params.companyName) {
        let client = await prisma.client.findFirst({ where: { name: { contains: params.companyName, mode: 'insensitive' } } });
        if (!client) client = await prisma.client.create({ data: { name: params.companyName } });
        clientId = client.id;
    }
    if (!clientId) {
        const first = await prisma.client.findFirst();
        if (!first) return { tool: 'create_lead', success: false, summary: 'No clients exist in system.' };
        clientId = first.id;
    }

    // Create contact if needed
    if (!contact && params.contactEmail) {
        contact = await prisma.contact.create({
            data: { firstName: params.contactFirstName || 'Unknown', lastName: params.contactLastName || '', email: params.contactEmail, title: params.contactTitle || null, clientId },
        });
    }

    // Check for duplicate
    if (contact) {
        const dup = await prisma.opportunity.findFirst({
            where: { clientId: contact.clientId, title: params.title, createdAt: { gt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
        });
        if (dup) return { tool: 'create_lead', success: false, summary: `Duplicate lead detected! An existing opportunity **"${dup.title}"** was found for this client created within the last 60 days.` };
    }

    // Lead scoring
    let score = 0;
    const factors: string[] = [];
    const titleLower = (params.contactTitle || '').toLowerCase();
    if (/c-level|vp|director|head/.test(titleLower)) { score += 25; factors.push('Decision Maker Title'); }
    else if (/manager/.test(titleLower)) { score += 10; factors.push('Manager Title'); }
    if (params.value && params.value > 50000) { score += 30; factors.push('High Budget (>50K)'); }
    else if (params.value && params.value > 10000) { score += 15; factors.push('Medium Budget'); }
    if (params.source === 'Inbound Demo Request') { score += 25; factors.push('High Intent Source'); }
    else if (params.source === 'Contact Form') { score += 15; factors.push('Contact Form Source'); }
    score = Math.min(score, 99);

    const stage = await prisma.stage.findFirst({ where: { name: { contains: 'Discovery', mode: 'insensitive' } } });
    const defaultType = await prisma.opportunityType.findFirst();
    if (!stage || !defaultType) return { tool: 'create_lead', success: false, summary: 'System config error.' };

    const lead = await prisma.opportunity.create({
        data: {
            title: params.title, value: params.value || 0, description: params.description || '', source: params.source || 'Chatbot', tags: '',
            probability: score > 70 ? 30 : 10, clientId, stageId: stage.id, typeId: defaultType.id, ownerId: ctx.userId,
            currentStage: stage.name,
        },
    });

    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: lead.id, action: 'LEAD_INGESTED', userId: ctx.userId, changes: `Lead created via Chat: ${params.title}, Score: ${score}` } });

    await recordStageEntry(lead.id, stage.id, lead.createdAt);

    let scoreLabel = 'Cold';
    if (score > 70) scoreLabel = 'Hot';
    else if (score > 40) scoreLabel = 'Warm';

    return {
        tool: 'create_lead', success: true,
        summary: `Lead **"${params.title}"** created successfully!\n- Company: ${params.companyName || '-'}\n- Contact: ${params.contactFirstName} ${params.contactLastName} (${params.contactEmail})\n- Value: ${money(params.value || 0)}\n- Lead Score: **${score}** (${scoreLabel})\n- Factors: ${factors.join(', ') || 'None'}`,
        data: { opportunityId: lead.id, leadScore: score },
    };
}

// ─── CONTACT EXECUTORS ──────────────────────────────────────────────────────

const CONTACT_FIELDS: FieldDef[] = [
    { key: 'firstName', label: 'First Name', required: true, type: 'string', prompt: 'Contact first name?' },
    { key: 'lastName', label: 'Last Name', required: true, type: 'string', prompt: 'Contact last name?' },
    { key: 'client', label: 'Client/Company', required: true, type: 'master', masterKey: 'clients',
        prompt: 'Which client/company?',
        buildPrompt: (m) => `Which client/company?\nAvailable: ${m.clients.slice(0, 10).map(c => c.name).join(', ')}${m.clients.length > 10 ? ` (+${m.clients.length - 10} more)` : ''}` },
    { key: 'email', label: 'Email', required: false, type: 'string', prompt: 'Email address? (or "skip")', validate: v => (v && !v.includes('@')) ? 'Please enter a valid email.' : null },
    { key: 'phone', label: 'Phone', required: false, type: 'string', prompt: 'Phone number? (or "skip")' },
    { key: 'title', label: 'Job Title', required: false, type: 'string', prompt: 'Job title? (e.g., "VP Sales", or "skip")' },
    { key: 'department', label: 'Department', required: false, type: 'string', prompt: 'Department? (or "skip")' },
];

async function execListContacts(params: any): Promise<ActionResult> {
    const where: any = { isActive: true };
    if (params.search) {
        const s = params.search;
        where.OR = [
            { firstName: { contains: s, mode: 'insensitive' } }, { lastName: { contains: s, mode: 'insensitive' } },
            { email: { contains: s, mode: 'insensitive' } }, { title: { contains: s, mode: 'insensitive' } },
        ];
    }
    if (params.clientId) where.clientId = params.clientId;
    else if (params.client) where.client = { name: { contains: params.client, mode: 'insensitive' } };

    const contacts = await prisma.contact.findMany({
        where, take: 20, orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
        include: { client: { select: { name: true } } },
    });
    const total = await prisma.contact.count({ where });
    const data = contacts.map(c => ({
        id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email || '-', phone: c.phone || '-',
        title: c.title || '-', department: c.department || '-', client: (c as any).client?.name || '-', isPrimary: c.isPrimary,
    }));
    return {
        tool: 'list_contacts', success: true,
        summary: data.length > 0 ? `Found **${total}** contacts${data.length < total ? ` (showing first ${data.length})` : ''}.` : 'No contacts found.',
        data: { type: 'table', columns: ['Name', 'Email', 'Title', 'Client', 'Phone'], rows: data },
    };
}

async function execGetContact(params: any): Promise<ActionResult> {
    let contact: any = null;
    if (params.nameOrId?.length === 36)
        contact = await prisma.contact.findUnique({ where: { id: params.nameOrId }, include: { client: true, activities: { take: 5, orderBy: { createdAt: 'desc' } } } });
    if (!contact && params.nameOrId?.includes('@'))
        contact = await prisma.contact.findFirst({ where: { email: { contains: params.nameOrId, mode: 'insensitive' }, isActive: true }, include: { client: true } });
    if (!contact)
        contact = await prisma.contact.findFirst({ where: { OR: [{ firstName: { contains: params.nameOrId, mode: 'insensitive' } }, { lastName: { contains: params.nameOrId, mode: 'insensitive' } }], isActive: true }, include: { client: true } });
    if (!contact) return { tool: 'get_contact', success: false, summary: `Contact "${params.nameOrId}" not found.` };
    return {
        tool: 'get_contact', success: true,
        summary: `**${contact.firstName} ${contact.lastName}**\n- Email: ${contact.email || '-'}\n- Phone: ${contact.phone || '-'}\n- Title: ${contact.title || '-'}\n- Department: ${contact.department || '-'}\n- Client: ${contact.client?.name || '-'}\n- Primary: ${contact.isPrimary ? 'Yes' : 'No'}`,
        data: { contactId: contact.id },
    };
}

async function execCreateContact(params: any, _ctx: UserContext): Promise<ActionResult> {
    let clientId = params._clientId;
    if (!clientId && params.client) {
        const c = await prisma.client.findFirst({ where: { name: { contains: params.client, mode: 'insensitive' } } });
        if (c) clientId = c.id;
        else return { tool: 'create_contact', success: false, summary: `Client "${params.client}" not found. Create the client first.` };
    }
    if (!clientId) return { tool: 'create_contact', success: false, summary: 'Client is required.' };

    const contact = await prisma.contact.create({
        data: { firstName: params.firstName, lastName: params.lastName, email: params.email || null, phone: params.phone || null, title: params.title || null, department: params.department || null, clientId },
        include: { client: { select: { name: true } } },
    });
    return {
        tool: 'create_contact', success: true,
        summary: `Contact **${params.firstName} ${params.lastName}** created!\n- Client: ${(contact as any).client?.name}\n- Email: ${params.email || '-'}\n- Title: ${params.title || '-'}`,
        data: { contactId: contact.id },
    };
}

async function execDeleteContact(params: any): Promise<ActionResult> {
    let contact: any = null;
    if (params.nameOrId?.includes('@'))
        contact = await prisma.contact.findFirst({ where: { email: { contains: params.nameOrId, mode: 'insensitive' }, isActive: true } });
    else
        contact = await prisma.contact.findFirst({ where: { OR: [{ firstName: { contains: params.nameOrId, mode: 'insensitive' } }, { lastName: { contains: params.nameOrId, mode: 'insensitive' } }], isActive: true } });
    if (!contact) return { tool: 'delete_contact', success: false, summary: `Contact "${params.nameOrId}" not found.` };
    await prisma.contact.update({ where: { id: contact.id }, data: { isActive: false } });
    return { tool: 'delete_contact', success: true, summary: `Contact **${contact.firstName} ${contact.lastName}** has been deactivated.` };
}

// ─── COMMENT EXECUTORS ──────────────────────────────────────────────────────

async function execAddComment(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.comment?.trim()) return { tool: 'add_comment', success: false, summary: 'Comment text is required.' };
    let opp: any = null;
    if (params.nameOrId?.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId } });
    if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false } });
    if (!opp) return { tool: 'add_comment', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    await prisma.note.create({ data: { content: params.comment.trim(), mentions: '', opportunityId: opp.id, authorId: ctx.userId } as any });
    return { tool: 'add_comment', success: true, summary: `Comment added to **"${opp.title}"**.` };
}

async function execListComments(params: any): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId } });
    if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false } });
    if (!opp) return { tool: 'list_comments', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const comments = await prisma.note.findMany({
        where: { opportunityId: opp.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10,
    });
    if (comments.length === 0) return { tool: 'list_comments', success: true, summary: `No comments on **"${opp.title}"**.` };
    const lines = comments.map((c: any) => `- **${c.author?.name || 'Unknown'}** (${new Date(c.createdAt).toLocaleDateString()}): ${c.content}`);
    return { tool: 'list_comments', success: true, summary: `**Comments on "${opp.title}"** (${comments.length}):\n${lines.join('\n')}` };
}

// ─── GOM / APPROVAL EXECUTORS ───────────────────────────────────────────────

async function execApproveGom(params: any, ctx: UserContext): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId }, include: { stage: true } });
    if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false }, include: { stage: true } });
    if (!opp) return { tool: 'approve_gom', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };
    if (opp.gomApproved) return { tool: 'approve_gom', success: true, summary: `**"${opp.title}"** already has GOM approval.` };

    await prisma.opportunity.update({ where: { id: opp.id }, data: { gomApproved: true } });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'GOM_APPROVED', userId: ctx.userId, changes: 'GOM approved via Chat' } });
    return { tool: 'approve_gom', success: true, summary: `GOM approved for **"${opp.title}"**. The deal can now move to Proposal stage.` };
}

async function execGomStatus(params: any): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId }, include: { stage: true } });
    if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false }, include: { stage: true } });
    if (!opp) return { tool: 'gom_status', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const pending = await prisma.approvalRequest.findFirst({
        where: { opportunityId: opp.id, type: 'GOM_APPROVAL', status: 'Pending' },
        include: { requester: { select: { name: true } }, reviewer: { select: { name: true } } },
        orderBy: { requestedAt: 'desc' },
    });

    let status = `**GOM Status for "${opp.title}":**\n- GOM Approved: **${opp.gomApproved ? 'Yes' : 'No'}**\n- Current Stage: ${opp.stage?.name}`;
    if (pending) {
        status += `\n- Pending Approval: Yes\n- Requested by: ${pending.requester?.name || '-'}\n- Reviewer: ${(pending as any).reviewer?.name || 'Unassigned'}\n- Reason: ${pending.reason}`;
    }
    return { tool: 'gom_status', success: true, summary: status };
}

async function execReviewGom(params: any, ctx: UserContext): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId } });
    if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false } });
    if (!opp) return { tool: 'review_gom', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const pending = await prisma.approvalRequest.findFirst({ where: { opportunityId: opp.id, type: 'GOM_APPROVAL', status: 'Pending' } });
    if (!pending) return { tool: 'review_gom', success: false, summary: `No pending GOM approval for **"${opp.title}"**.` };

    const approved = params.approved !== false;
    await prisma.approvalRequest.update({ where: { id: pending.id }, data: { status: approved ? 'Approved' : 'Rejected', reviewedAt: new Date(), reviewerId: ctx.userId, comments: params.comments || null } });
    if (approved) await prisma.opportunity.update({ where: { id: opp.id }, data: { gomApproved: true } });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: approved ? 'GOM_APPROVED' : 'GOM_REJECTED', userId: ctx.userId, changes: `GOM ${approved ? 'Approved' : 'Rejected'} via Chat` } });
    return { tool: 'review_gom', success: true, summary: `GOM ${approved ? '**Approved**' : '**Rejected**'} for **"${opp.title}"**.` };
}

// ─── CONVERT OPPORTUNITY EXECUTOR ───────────────────────────────────────────

async function execConvertOpportunity(params: any, ctx: UserContext): Promise<ActionResult> {
    let opp: any = null;
    if (params.nameOrId?.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: params.nameOrId }, include: { stage: true, client: true } });
    if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: params.nameOrId, mode: 'insensitive' }, isArchived: false }, include: { stage: true, client: true } });
    if (!opp) return { tool: 'convert_opportunity', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const closedWon = await prisma.stage.findFirst({ where: { name: { contains: 'Closed Won', mode: 'insensitive' } } });
    if (!closedWon) return { tool: 'convert_opportunity', success: false, summary: 'System config error: Closed Won stage not found.' };

    await prisma.opportunity.update({ where: { id: opp.id }, data: { stageId: closedWon.id, currentStage: 'Closed Won', detailedStatus: 'SOW Approved', actualCloseDate: new Date(), probability: 100 } });
    await recordStageEntry(opp.id, closedWon.id);
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'CONVERT_TO_PROJECT', userId: ctx.userId, changes: `Converted to Closed Won via Chat` } });
    return {
        tool: 'convert_opportunity', success: true,
        summary: `**"${opp.title}"** has been converted to **Closed Won**!\n- Client: ${opp.client?.name}\n- Value: ${money(opp.value)}\n- Status: SOW Approved`,
    };
}

// ─── LIFECYCLE EXECUTORS ────────────────────────────────────────────────────

/** Helper to find an opportunity by name or ID */
async function findOpportunity(nameOrId: string): Promise<any> {
    let opp: any = null;
    if (nameOrId?.length === 36)
        opp = await prisma.opportunity.findUnique({ where: { id: nameOrId }, include: { stage: true, client: true } });
    if (!opp)
        opp = await prisma.opportunity.findFirst({ where: { title: { contains: nameOrId, mode: 'insensitive' }, isArchived: false }, include: { stage: true, client: true } });
    return opp;
}

/** Move to Presales (Discovery → Qualification) */
async function execMoveToPresales(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.nameOrId) return { tool: 'move_to_presales', success: false, summary: 'Which opportunity? Provide the name in quotes (e.g., move "Project Alpha" to presales).' };
    const opp = await findOpportunity(params.nameOrId);
    if (!opp) return { tool: 'move_to_presales', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const currentStage = opp.stage?.name || '';
    if (currentStage !== 'Discovery') {
        return { tool: 'move_to_presales', success: false, summary: `**"${opp.title}"** is currently in **${currentStage}** stage. Move to Presales is only available from Discovery (Pipeline) stage.` };
    }

    const qualStage = await prisma.stage.findFirst({ where: { name: { contains: 'Qualification', mode: 'insensitive' } } });
    if (!qualStage) return { tool: 'move_to_presales', success: false, summary: 'System error: Qualification stage not found.' };

    await prisma.opportunity.update({ where: { id: opp.id }, data: { stageId: qualStage.id, currentStage: qualStage.name, probability: qualStage.probability || 30 } });
    await recordStageEntry(opp.id, qualStage.id);
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'STAGE_CHANGE', userId: ctx.userId, changes: `Moved to Presales (Qualification) via Chat — from Discovery` } });
    return {
        tool: 'move_to_presales', success: true,
        summary: `**"${opp.title}"** moved to **Presales** (Qualification)!\n- Client: ${opp.client?.name || '-'}\n- Previous: Discovery → **Qualification**\n- Probability: ${qualStage.probability || 30}%\n\nNext step: Fill in estimation details and get GOM approval, then move to Sales.`,
    };
}

/** Move to Sales (Qualification → Proposal, requires GOM approval) */
async function execMoveToSales(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.nameOrId) return { tool: 'move_to_sales', success: false, summary: 'Which opportunity? Provide the name in quotes (e.g., move "Project Alpha" to sales).' };
    const opp = await findOpportunity(params.nameOrId);
    if (!opp) return { tool: 'move_to_sales', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const currentStage = opp.stage?.name || '';
    if (currentStage !== 'Qualification') {
        return { tool: 'move_to_sales', success: false, summary: `**"${opp.title}"** is currently in **${currentStage}** stage. Move to Sales is only available from Presales (Qualification) stage.` };
    }

    if (!opp.gomApproved) {
        return { tool: 'move_to_sales', success: false, summary: `Cannot move **"${opp.title}"** to Sales — **GOM approval is required first**.\n\nUse: "approve GOM for '${opp.title}'" or get it approved via the GOM Calculator in the UI.` };
    }

    const proposalStage = await prisma.stage.findFirst({ where: { name: { contains: 'Proposal', mode: 'insensitive' } }, orderBy: { order: 'asc' } });
    if (!proposalStage) return { tool: 'move_to_sales', success: false, summary: 'System error: Proposal stage not found.' };

    await prisma.opportunity.update({ where: { id: opp.id }, data: { stageId: proposalStage.id, currentStage: proposalStage.name, probability: proposalStage.probability || 50 } });
    await recordStageEntry(opp.id, proposalStage.id);
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'STAGE_CHANGE', userId: ctx.userId, changes: `Moved to Sales (Proposal) via Chat — from Qualification` } });
    return {
        tool: 'move_to_sales', success: true,
        summary: `**"${opp.title}"** moved to **Sales** (Proposal)!\n- Client: ${opp.client?.name || '-'}\n- Previous: Qualification → **Proposal**\n- Probability: ${proposalStage.probability || 50}%\n\nNext: Submit the proposal to the client, then use "proposal sent for '${opp.title}'" to advance to Negotiation.`,
    };
}

/** Proposal Sent (Proposal → Negotiation) */
async function execProposalSent(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.nameOrId) return { tool: 'proposal_sent', success: false, summary: 'Which opportunity? Provide the name in quotes (e.g., proposal sent for "Project Alpha").' };
    const opp = await findOpportunity(params.nameOrId);
    if (!opp) return { tool: 'proposal_sent', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const currentStage = opp.stage?.name || '';
    if (currentStage !== 'Proposal') {
        return { tool: 'proposal_sent', success: false, summary: `**"${opp.title}"** is currently in **${currentStage}** stage. "Proposal Sent" is only available from the Proposal stage.` };
    }

    const negStage = await prisma.stage.findFirst({ where: { name: { contains: 'Negotiation', mode: 'insensitive' } } });
    if (!negStage) return { tool: 'proposal_sent', success: false, summary: 'System error: Negotiation stage not found.' };

    await prisma.opportunity.update({ where: { id: opp.id }, data: { stageId: negStage.id, currentStage: negStage.name, probability: negStage.probability || 80 } });
    await recordStageEntry(opp.id, negStage.id);
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'STAGE_CHANGE', userId: ctx.userId, changes: `Proposal sent — moved to Negotiation via Chat` } });
    return {
        tool: 'proposal_sent', success: true,
        summary: `Proposal marked as sent for **"${opp.title}"** — moved to **Negotiation**!\n- Client: ${opp.client?.name || '-'}\n- Previous: Proposal → **Negotiation**\n- Probability: ${negStage.probability || 80}%\n\nNext: Convert to project when won, or mark as lost if declined.`,
    };
}

/** Mark as Lost (→ Closed Lost) */
async function execMarkLost(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.nameOrId) return { tool: 'mark_lost', success: false, summary: 'Which opportunity? Provide the name in quotes (e.g., mark "Project Alpha" as lost).' };
    const opp = await findOpportunity(params.nameOrId);
    if (!opp) return { tool: 'mark_lost', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const currentStage = opp.stage?.name || '';
    if (currentStage === 'Closed Won' || currentStage === 'Closed Lost') {
        return { tool: 'mark_lost', success: false, summary: `**"${opp.title}"** is already in **${currentStage}** — cannot change.` };
    }

    // One lost stage, whatever the deal was doing when it died. "Proposal Lost"
    // used to be chosen here for deals dying at Qualification or Proposal, but it
    // duplicated Closed Lost — same isClosed, isWon and probability — and every
    // report already treated the two identically.
    const lostType = 'Closed Lost';

    const lostStage = await prisma.stage.findFirst({ where: { name: { equals: lostType, mode: 'insensitive' } } });
    if (!lostStage) return { tool: 'mark_lost', success: false, summary: `System error: ${lostType} stage not found.` };

    const remarks = params.remarks || 'Marked as lost via chatbot';
    await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
            stageId: lostStage.id, currentStage: lostStage.name, probability: 0,
            detailedStatus: 'Lost', actualCloseDate: new Date(),
            salesData: { lostRemarks: remarks },
        },
    });
    await recordStageEntry(opp.id, lostStage.id);
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'STAGE_CHANGE', userId: ctx.userId, changes: `Marked as ${lostType} via Chat: ${remarks}` } });
    return {
        tool: 'mark_lost', success: true,
        summary: `**"${opp.title}"** marked as **${lostType}**.\n- Client: ${opp.client?.name || '-'}\n- Previous: ${currentStage} → **${lostType}**\n- Remarks: ${remarks}`,
    };
}

/** Send Back for Re-estimate (Proposal/Negotiation → Qualification) */
async function execReestimate(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.nameOrId) return { tool: 'reestimate', success: false, summary: 'Which opportunity? Provide the name in quotes (e.g., send back "Project Alpha" for re-estimate).' };
    const opp = await findOpportunity(params.nameOrId);
    if (!opp) return { tool: 'reestimate', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const currentStage = opp.stage?.name || '';
    if (currentStage !== 'Proposal' && currentStage !== 'Negotiation') {
        return { tool: 'reestimate', success: false, summary: `**"${opp.title}"** is in **${currentStage}** stage. Re-estimate is only available from Proposal or Negotiation stages.` };
    }

    const qualStage = await prisma.stage.findFirst({ where: { name: { contains: 'Qualification', mode: 'insensitive' } } });
    if (!qualStage) return { tool: 'reestimate', success: false, summary: 'System error: Qualification stage not found.' };

    const comment = params.comment || 'Sent back for re-estimation via chatbot';
    const update: any = {
        stageId: qualStage.id, currentStage: qualStage.name, probability: qualStage.probability || 30,
        reEstimateCount: { increment: 1 }, detailedStatus: 'Sent for Re-estimate', gomApproved: false,
    };
    if (params.adjustedValue && Number(params.adjustedValue) > 0) {
        update.presalesData = {
            ...(((opp as any).presalesData as any) || {}),
            reEstimateSuggestedRevenue: Number(params.adjustedValue),
            reEstimateComment: comment,
        };
    }

    await prisma.opportunity.update({ where: { id: opp.id }, data: update });
    await recordStageEntry(opp.id, qualStage.id);
    // Add a comment/note for the re-estimate reason
    await prisma.note.create({ data: { content: `[Re-estimate] ${comment}`, mentions: '', opportunityId: opp.id, authorId: ctx.userId } as any });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'STAGE_CHANGE', userId: ctx.userId, changes: `Sent back for re-estimation via Chat — from ${currentStage}: ${comment}` } });
    return {
        tool: 'reestimate', success: true,
        summary: `**"${opp.title}"** sent back for **re-estimation**!\n- Previous: ${currentStage} → **Qualification (Presales)**\n- GOM approval has been reset\n- Re-estimate count incremented\n- Comment: ${comment}\n\nThe presales team needs to update the estimation and get GOM re-approved.`,
    };
}

// ─── ADMIN EXECUTORS ────────────────────────────────────────────────────────

async function execListUsers(params: any): Promise<ActionResult> {
    const where: any = { isActive: true };
    if (params.search) {
        where.OR = [
            { name: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
        ];
    }
    if (params.department) where.department = { contains: params.department, mode: 'insensitive' };
    if (params.role) where.roles = { some: { name: { contains: params.role, mode: 'insensitive' } } };

    const users = await prisma.user.findMany({
        where, take: 20, orderBy: { name: 'asc' },
        include: { roles: { select: { name: true } } },
    });
    const total = await prisma.user.count({ where });
    const data = users.map(u => ({
        name: u.name || '-', email: u.email, department: u.department || '-', designation: u.designation || '-',
        roles: u.roles.map((r: any) => r.name).join(', ') || '-',
    }));
    return {
        tool: 'list_users', success: true,
        summary: `Found **${total}** users${data.length < total ? ` (showing first ${data.length})` : ''}.`,
        data: { type: 'table', columns: ['Name', 'Email', 'Department', 'Designation', 'Roles'], rows: data },
    };
}

async function execListAuditLogs(params: any): Promise<ActionResult> {
    const where: any = {};
    if (params.entity) where.entity = { contains: params.entity, mode: 'insensitive' };
    if (params.action) where.action = { contains: params.action, mode: 'insensitive' };

    const logs = await prisma.auditLog.findMany({
        where, take: 15, orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true } } },
    });
    if (logs.length === 0) return { tool: 'list_audit_logs', success: true, summary: 'No audit logs found.' };
    const lines = logs.map(l => `- **${l.action}** on ${l.entity} by ${l.user?.name || '-'} (${new Date(l.timestamp).toLocaleString()})${typeof l.changes === 'string' ? `: ${l.changes.substring(0, 80)}` : ''}`);
    return { tool: 'list_audit_logs', success: true, summary: `**Recent Audit Logs** (${logs.length}):\n${lines.join('\n')}` };
}

async function execMyProfile(ctx: UserContext): Promise<ActionResult> {
    const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        include: { roles: true, team: true },
    });
    if (!user) return { tool: 'my_profile', success: false, summary: 'Could not find your profile.' };
    const roles = user.roles.map((r: any) => r.name).join(', ') || 'None';
    const activeRole = user.roles.find((r: any) => r.id === user.activeRoleId);
    return {
        tool: 'my_profile', success: true,
        summary: `**Your Profile:**\n- Name: **${user.name || '-'}**\n- Email: ${user.email}\n- Department: ${user.department || '-'}\n- Designation: ${user.designation || '-'}\n- Team: ${user.team?.name || '-'}\n- Roles: ${roles}\n- Active Role: **${(activeRole as any)?.name || ctx.roleName}**\n- Permissions: ${ctx.permissions.includes('*') ? 'All (Admin)' : ctx.permissions.join(', ')}`,
    };
}

async function execListResources(): Promise<ActionResult> {
    const resources = await prisma.resource.findMany({ take: 20, orderBy: { name: 'asc' } });
    if (resources.length === 0) return { tool: 'list_resources', success: true, summary: 'No resources found.' };
    const data = resources.map(r => ({
        name: r.name, grade: r.grade || '-', skills: r.skills || '-',
        availability: r.availability || '-', rate: r.standardRate ? money(r.standardRate) : '-',
    }));
    return {
        tool: 'list_resources', success: true,
        summary: `Found **${resources.length}** resources.`,
        data: { type: 'table', columns: ['Name', 'Grade', 'Skills', 'Availability', 'Rate'], rows: data },
    };
}

// ─── FIELD COLLECTION & VALIDATION ──────────────────────────────────────────

function processFieldValue(fieldName: string, rawValue: string, conv: ConversationState, master: MasterDataCache): string | null {
    const allFields = conv.entityType === 'lead' ? LEAD_FIELDS : conv.entityType === 'contact' ? CONTACT_FIELDS : OPPORTUNITY_FIELDS;
    const fieldDef = allFields.find(f => f.key === fieldName);
    if (!fieldDef) return null;

    if (rawValue === '__SKIP__') {
        if (fieldDef.required) return `**${fieldDef.label}** is required and cannot be skipped.`;
        conv.optionalRemaining = conv.optionalRemaining.filter(f => f !== fieldName);
        return null;
    }

    let parsed: any = rawValue;

    if (fieldDef.type === 'number') {
        parsed = parseMoneyValue(rawValue) ?? parseFloat(rawValue);
        if (isNaN(parsed)) return `Invalid number: "${rawValue}". Please enter a valid amount (e.g., 500000 or 500K).`;
    }
    if (fieldDef.type === 'date') {
        parsed = parseDate(rawValue);
        if (!parsed) return `Invalid date: "${rawValue}". Try any format like: "15 Jan 2026", "01/15/2026", "2026-06-15", "next month", "March 2026".`;
    }
    if (fieldDef.type === 'select' && fieldDef.options) {
        const match = fieldDef.options.find(o => o.toLowerCase() === rawValue.toLowerCase());
        if (!match) return `Invalid option. Please choose one of: **${fieldDef.options.join(', ')}**`;
        parsed = match;
    }

    // Master data validation (name-based)
    if (fieldDef.type === 'master' && fieldDef.masterKey) {
        const masterList = master[fieldDef.masterKey] as { id: string; name: string }[];
        if (masterList && masterList.length > 0) {
            const result = fuzzyMatch(rawValue, masterList);
            if (result.exact && result.match) {
                parsed = result.match.name;
                if (fieldName === 'client') conv.collectedFields['_clientId'] = result.match.id;
                else if (fieldName === 'salesRepName') conv.collectedFields['_salesRepId'] = result.match.id;
                else if (fieldName === 'managerName') conv.collectedFields['_managerId'] = result.match.id;
            } else {
                let errMsg = `"${rawValue}" doesn't match any ${fieldDef.label.toLowerCase()} in the system.`;
                if (result.suggestions.length > 0) {
                    errMsg += `\n\nDid you mean one of these?\n${result.suggestions.map(s => `  - **${s}**`).join('\n')}`;
                } else {
                    errMsg += `\n\nAvailable options:\n${masterList.slice(0, 10).map(it => `  - **${it.name}**`).join('\n')}`;
                    if (masterList.length > 10) errMsg += `\n  _(+${masterList.length - 10} more)_`;
                }
                errMsg += '\n\nPlease enter an exact name from the list above.';
                return errMsg;
            }
        }
    }

    // Currency code validation
    if (fieldDef.type === 'masterCode' && fieldDef.masterKey === 'currencies') {
        const currencies = master.currencies;
        if (currencies && currencies.length > 0) {
            const upper = rawValue.toUpperCase().trim();
            const exact = currencies.find(c => c.code.toUpperCase() === upper);
            if (exact) {
                parsed = exact.code;
            } else {
                const byName = currencies.find(c => c.name.toLowerCase().includes(rawValue.toLowerCase()));
                if (byName) {
                    parsed = byName.code;
                } else {
                    return `"${rawValue}" is not a valid currency.\n\nAvailable currencies:\n${currencies.map(c => `  - **${c.code}** (${c.symbol} ${c.name})`).join('\n')}\n\nPlease enter a valid currency code.`;
                }
            }
        }
    }

    if (fieldDef.validate) {
        const err = fieldDef.validate(parsed);
        if (err) return err;
    }

    conv.collectedFields[fieldName] = parsed;
    conv.missingRequired = conv.missingRequired.filter(f => f !== fieldName);
    conv.optionalRemaining = conv.optionalRemaining.filter(f => f !== fieldName);
    return null;
}

async function getNextFieldPrompt(conv: ConversationState): Promise<string | null> {
    const master = await getMasterData();
    const fields = conv.entityType === 'lead' ? LEAD_FIELDS : conv.entityType === 'contact' ? CONTACT_FIELDS : OPPORTUNITY_FIELDS;
    const nextRequired = conv.missingRequired[0];
    if (nextRequired) {
        const def = fields.find(f => f.key === nextRequired);
        if (!def) return null;
        const prompt = (def.buildPrompt && master) ? def.buildPrompt(master) : def.prompt;
        return `**${def.label}** (required): ${prompt}`;
    }
    const nextOptional = conv.optionalRemaining[0];
    if (nextOptional) {
        const def = fields.find(f => f.key === nextOptional);
        if (!def) return null;
        const prompt = (def.buildPrompt && master) ? def.buildPrompt(master) : def.prompt;
        return `**${def.label}** (optional): ${prompt}`;
    }
    return null;
}

function buildConfirmationSummary(conv: ConversationState): string {
    const fields = conv.entityType === 'lead' ? LEAD_FIELDS : conv.entityType === 'contact' ? CONTACT_FIELDS : OPPORTUNITY_FIELDS;
    const entityLabel = conv.entityType === 'lead' ? 'Lead' : conv.entityType === 'contact' ? 'Contact' : 'Opportunity';
    const lines = [`**Please confirm the following ${entityLabel} details:**\n`];
    const currency = conv.collectedFields['currency'] || 'USD';
    for (const [key, value] of Object.entries(conv.collectedFields)) {
        if (key.startsWith('_')) continue;
        const def = fields.find(f => f.key === key) || { label: key };
        let display = String(value);
        if (key === 'value') display = `${currency} ${Number(value).toLocaleString()}`;
        else if (key === 'expectedDayRate') display = `${currency} ${Number(value).toLocaleString()}`;
        lines.push(`- **${def.label}:** ${display}`);
    }
    lines.push('\nType **"yes"** to confirm or **"no"** to cancel.');
    return lines.join('\n');
}

// ─── MAIN CHAT HANDLER ─────────────────────────────────────────────────────

export async function processChat(message: string, ctx: UserContext): Promise<ChatMessage> {
    const conv = getConversation(ctx.userId);
    const master = await getMasterData();

    const convContext = conv.mode !== 'idle'
        ? `Mode: ${conv.mode}, Collected: ${JSON.stringify(conv.collectedFields)}, Waiting for: ${conv.missingRequired[0] || conv.optionalRemaining[0] || 'confirmation'}`
        : '';

    // Rules first, model second — deliberately the reverse of the obvious order.
    //
    // The deterministic parser answers in 18-308ms and is exactly right for the
    // shapes it knows (filters, counts, charts, win rate, follow-ups). The local
    // model takes 4.5-7s on this CPU-only box. Asking the model first would put
    // a 5-second wait in front of every question, including the ones already
    // answered perfectly without it.
    //
    // So the model is the rescue path: it runs only when the rules did not
    // understand the sentence, which is precisely where it earns its latency.
    let intent = nlpParseIntent(message, conv);

    // The thirty-intent classification is no longer asked about questions. It
    // cost ~23s here, and it guessed: "which of our accounts are we doing best
    // with?" came back as list_contacts, answering "No contacts found" to a
    // question about clients. Reading questions is now the slot rescue's job —
    // smaller, faster, and constrained to fields that map onto real queries.
    //
    // Writing is the one place the big prompt still earns its keep. "Spin up a
    // deal for Acme on Azure worth 2 crore" has no dimension and no measure, so
    // the slot rescue cannot represent it, and without this it would fall to the
    // help text. Three conditions keep the cost where it belongs: the rules must
    // have failed, the sentence must contain a write verb, and it must not look
    // analytical — otherwise "add up revenue by client" would pay 20s for the
    // word "add". Whatever it proposes still goes through the existing
    // confirmation step, so a bad guess is shown to the user, not saved.
    const WRITE_VERB = /\b(create|add|new|open|start|update|change|edit|set|move|mark|convert|log|record|delete|remove|assign|rename)\b/i;
    const LOOKS_ANALYTICAL = /\b(chart|graph|plot|pie|bar|revenue|value|worth|count|how many|list|show|top|trend|wise|by|per|split)\b/i;
    if (intent.intent === 'general_chat' && WRITE_VERB.test(message) && !LOOKS_ANALYTICAL.test(message)) {
        const llmIntent = await callLLM(message, convContext);
        if (llmIntent && llmIntent.intent !== 'general_chat') intent = llmIntent;
    }

    conv.history.push({ role: 'user', content: message });

    // Cancel
    if (intent.intent === 'cancel') {
        resetConversation(ctx.userId);
        return reply('Cancelled. How else can I help?');
    }

    // Field collection mode
    if (conv.mode === 'creating' || conv.mode === 'updating' || conv.mode === 'creating_lead' || conv.mode === 'creating_contact') {
        if (intent.intent === 'provide_field_value' || (intent.confidence < 0.7 && conv.missingRequired.length + conv.optionalRemaining.length > 0)) {
            const fieldName = intent.fieldName || conv.missingRequired[0] || conv.optionalRemaining[0];
            const fieldValue = intent.fieldValue || message.trim();
            if (fieldName && fieldValue !== '__SKIP__' && fieldValue) {
                const error = processFieldValue(fieldName, fieldValue, conv, master);
                if (error) return reply(error);
            } else if (fieldValue === '__SKIP__' && fieldName) {
                const error = processFieldValue(fieldName, '__SKIP__', conv, master);
                if (error) return reply(error);
            }
            const nextPrompt = await getNextFieldPrompt(conv);
            if (nextPrompt) return reply(nextPrompt, undefined, conv.missingRequired.concat(conv.optionalRemaining));
            conv.mode = 'confirming';
            return reply(buildConfirmationSummary(conv));
        }
    }

    // Human-in-the-loop: confirm extracted entities before field collection
    if (conv.mode === 'confirming_extract') {
        if (intent.intent === 'confirm_yes') {
            // User confirmed the extracted entities — proceed to field collection
            conv.mode = 'creating';
            let response = `Great! Let's continue with the remaining details.\n`;
            const nextPrompt = await getNextFieldPrompt(conv);
            if (nextPrompt) response += `\n${nextPrompt}`;
            else {
                conv.mode = 'confirming';
                response += `\n${buildConfirmationSummary(conv)}`;
            }
            return reply(response, undefined, conv.missingRequired.concat(conv.optionalRemaining));
        }
        if (intent.intent === 'confirm_no') {
            // User rejected — reset and start fresh
            resetConversation(ctx.userId);
            const freshConv = getConversation(ctx.userId);
            freshConv.mode = 'creating';
            freshConv.collectedFields = { _isCreate: true };
            freshConv.missingRequired = OPPORTUNITY_FIELDS.filter(f => f.required).map(f => f.key);
            freshConv.optionalRemaining = OPPORTUNITY_FIELDS.filter(f => !f.required).map(f => f.key);
            let response = `No problem! Let's start fresh.\n`;
            const nextPrompt = await getNextFieldPrompt(freshConv);
            if (nextPrompt) response += `\n${nextPrompt}`;
            return reply(response, undefined, freshConv.missingRequired.concat(freshConv.optionalRemaining));
        }
        return reply('Please type **"yes"** to proceed with the details I understood, or **"no"** to start fresh.');
    }

    // Confirmation
    if (conv.mode === 'confirming') {
        if (intent.intent === 'confirm_yes') {
            const fields = conv.collectedFields;
            const entity = conv.entityType;
            const wasCreating = !!fields._isCreate;
            const oppId = conv.targetOpportunityId;
            delete fields._isCreate;
            resetConversation(ctx.userId);
            if (entity === 'lead') {
                if (!canExecute('create_lead', ctx.permissions))
                    return reply(`You don't have permission to create leads (Role: ${ctx.roleName}).`);
                const result = await execCreateLead(fields, ctx);
                return reply(result.summary, result.data, undefined, [result]);
            } else if (entity === 'contact') {
                if (!canExecute('create_contact', ctx.permissions))
                    return reply(`You don't have permission to create contacts (Role: ${ctx.roleName}).`);
                const result = await execCreateContact(fields, ctx);
                return reply(result.summary, result.data, undefined, [result]);
            } else if (wasCreating) {
                if (!canExecute('create_opportunity', ctx.permissions))
                    return reply(`You don't have permission to create opportunities (Role: ${ctx.roleName}).`);
                const result = await execCreateOpportunity(fields, ctx);
                return reply(result.summary, result.data, undefined, [result]);
            } else if (oppId) {
                if (!canExecute('update_opportunity', ctx.permissions))
                    return reply(`You don't have permission to update opportunities (Role: ${ctx.roleName}).`);
                fields.nameOrId = oppId;
                const result = await execUpdateOpportunity(fields, ctx);
                return reply(result.summary, result.data, undefined, [result]);
            }
        }
        if (intent.intent === 'confirm_no') {
            resetConversation(ctx.userId);
            return reply('Cancelled. No changes were made.');
        }
        return reply('Please type **"yes"** to confirm or **"no"** to cancel.');
    }

    // CREATE flow
    if (intent.intent === 'create_opportunity') {
        if (!canExecute('create_opportunity', ctx.permissions))
            return reply(`You don't have permission to create opportunities. Your role: **${ctx.roleName}**.`);

        // Smart extract: merge LLM params + plain-language master data matching
        const smartParams = smartExtractFromMasterData(message, master);
        const mergedParams: Record<string, any> = { ...smartParams };
        // LLM/NLP params take priority over smart extraction
        for (const [k, v] of Object.entries(intent.params)) {
            if (v !== null && v !== undefined && v !== '') mergedParams[k] = v;
        }

        // Copy internal IDs from smartParams if not overridden
        if (smartParams._clientId && !intent.params.client) mergedParams._clientId = smartParams._clientId;

        // Pre-validate extracted fields against master data
        conv.mode = 'creating';
        conv.collectedFields = { _isCreate: true };
        for (const [k, v] of Object.entries(mergedParams)) {
            if (k.startsWith('_')) { conv.collectedFields[k] = v; continue; }
            const fieldDef = OPPORTUNITY_FIELDS.find(f => f.key === k);
            if (fieldDef) processFieldValue(k, String(v), conv, master);
        }

        const prefilled = Object.entries(conv.collectedFields).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
            const def = OPPORTUNITY_FIELDS.find(f => f.key === k);
            return `- **${def?.label || k}:** ${k === 'value' ? money(v) : v}`;
        });

        // Human-in-the-loop: if we extracted entities from plain language, confirm first
        if (prefilled.length > 0) {
            conv.missingRequired = OPPORTUNITY_FIELDS.filter(f => f.required && !(f.key in conv.collectedFields)).map(f => f.key);
            conv.optionalRemaining = OPPORTUNITY_FIELDS.filter(f => !f.required && !(f.key in conv.collectedFields)).map(f => f.key);
            let response = `I understood the following from your message:\n${prefilled.join('\n')}\n\nIs this correct? Type **"yes"** to proceed with these details, or **"no"** to start fresh.`;
            conv.mode = 'confirming_extract';
            return reply(response);
        }

        // No entities extracted — go straight to field collection
        conv.missingRequired = OPPORTUNITY_FIELDS.filter(f => f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        conv.optionalRemaining = OPPORTUNITY_FIELDS.filter(f => !f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        let response = `Let's create a new opportunity! I'll walk you through the required information.\n`;
        const nextPrompt = await getNextFieldPrompt(conv);
        if (nextPrompt) response += `\n${nextPrompt}`;
        else {
            conv.mode = 'confirming';
            response += `\n${buildConfirmationSummary(conv)}`;
        }
        return reply(response, undefined, conv.missingRequired.concat(conv.optionalRemaining));
    }

    // UPDATE flow
    if (intent.intent === 'update_opportunity') {
        if (!canExecute('update_opportunity', ctx.permissions))
            return reply(`You don't have permission to update opportunities. Your role: **${ctx.roleName}**.`);
        const nameOrId = intent.params.nameOrId;
        if (!nameOrId) return reply('Which opportunity would you like to update? Please provide the deal name in quotes (e.g., "Acme CRM Migration").');
        let opp: any = null;
        if (nameOrId.length === 36) opp = await prisma.opportunity.findUnique({ where: { id: nameOrId }, include: { stage: true, client: true } });
        if (!opp) opp = await prisma.opportunity.findFirst({ where: { title: { contains: nameOrId, mode: 'insensitive' }, isArchived: false }, include: { stage: true, client: true } });
        if (!opp) return reply(`Could not find opportunity matching **"${nameOrId}"**. Try listing opportunities first.`);
        const updateFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(intent.params)) {
            if (k !== 'nameOrId' && v !== null && v !== undefined && v !== '') updateFields[k] = v;
        }
        if (Object.keys(updateFields).length > 0) {
            conv.mode = 'confirming';
            conv.targetOpportunityId = opp.id;
            conv.collectedFields = updateFields;
            let summary = `Update **"${opp.title}"** (${opp.stage?.name}, ${opp.client?.name}):\n`;
            for (const [k, v] of Object.entries(updateFields)) summary += `- **${k}:** -> ${v}\n`;
            summary += '\nType **"yes"** to confirm or **"no"** to cancel.';
            return reply(summary);
        }
        conv.mode = 'updating';
        conv.targetOpportunityId = opp.id;
        conv.collectedFields = {};
        return reply(`What would you like to update on **"${opp.title}"**?\n\nCurrent details:\n- Stage: ${opp.stage?.name}\n- Client: ${opp.client?.name}\n- Value: ${money(opp.value)}\n- Technology: ${opp.technology || '-'}\n- Region: ${opp.region || '-'}\n\nYou can say things like:\n- "Move to Negotiation"\n- "Change value to 500K"\n- "Set technology to AI/ML"\n\nOr say **"cancel"** to abort.`);
    }

    // LIST
    if (intent.intent === 'list_opportunities') {
        if (!canExecute('list_opportunities', ctx.permissions)) return reply('You don\'t have permission to view opportunities.');
        // Pick up filters the regex rules cannot see (technology, practice, an
        // unquoted client or rep name) by matching the question against master
        // data — this is what makes "all SAP opportunities" filter by SAP.
        const listParams = inheritFilters(await enrichFiltersFromMasterData(message, { ...intent.params }), conv);

        // If the question named something that does not exist, say so instead of
        // answering a wider question than was asked. Returning every deal to
        // someone who asked about one region is not a partial answer, it is a
        // wrong one wearing a confident face.
        const impossible = await unsatisfiableFilters(message);
        if (impossible.length) return reply(impossible.join('\n\n'));

        conv.lastFilters = { ...listParams };
        const result = await execListOpportunities(listParams, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // COUNT
    if (intent.intent === 'count_opportunities') {
        if (!canExecute('count_opportunities', ctx.permissions)) return reply('You don\'t have permission to view opportunities.');
        const countParams = inheritFilters(await enrichFiltersFromMasterData(message, { ...intent.params }), conv);
        conv.lastFilters = { ...countParams };
        const result = await execCountOpportunities(countParams, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // WIN RATE
    if (intent.intent === 'win_rate') {
        if (!canExecute('win_rate', ctx.permissions)) return reply('You don\'t have permission to view opportunities.');
        const winParams = inheritFilters(await enrichFiltersFromMasterData(message, { ...intent.params }), conv);
        conv.lastFilters = { ...winParams };
        const result = await execWinRate(winParams, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // CUSTOM CHART
    if (intent.intent === 'custom_chart') {
        if (!canExecute('list_opportunities', ctx.permissions)) return reply('You don\'t have permission to view opportunities.');
        const chartParams = inheritFilters(await enrichFiltersFromMasterData(message, { ...intent.params }), conv);

        // "a picture of the money split up by whoever sells it" reaches here as a
        // chart request whose dimension is only the by-stage default — the rules
        // saw "picture" and "by" but could not name what to group on. Rather than
        // draw the same default chart for every such sentence, ask the model which
        // dimension was meant. It picks from a fixed list, so the worst case is the
        // wrong dimension, never an invented one.
        if (chartParams.__groupByDefaulted) {
            const hinted = await resolveSlots(message);
            if (hinted?.groupBy) {
                chartParams.groupBy = hinted.groupBy;
                // The model's measure is deliberately ignored. Where the sentence
                // says which it wants, the rules already read it correctly; where it
                // is silent, value is the more useful default for a CRM. Every time
                // the model disagreed with the rules here it was wrong, answering
                // "the most money" with a deal count.
                if (hinted.chartType) chartParams.chartType = hinted.chartType;
                if (hinted.outcome && !chartParams.outcome) chartParams.outcome = hinted.outcome;
                delete chartParams.__groupByDefaulted;
                delete chartParams.__measureDefaulted;
            }
        }
        conv.lastFilters = { ...chartParams };
        const result = await execCustomChart(chartParams, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // DETAILS
    if (intent.intent === 'get_details') {
        if (!canExecute('get_details', ctx.permissions)) return reply('You don\'t have permission to view opportunity details.');
        if (!intent.params.nameOrId) return reply('Which opportunity? Provide the name in quotes (e.g., tell me about deal "Project Phoenix").');
        const result = await execGetDetails(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ANALYTICS
    if (intent.intent === 'pipeline_analytics') {
        if (!canExecute('pipeline_analytics', ctx.permissions)) return reply('No permission for analytics.');
        const r = await execPipelineAnalytics();
        const m = r.data?.metrics;
        let extra = '';
        if (m) extra = `\n\n**Pipeline Summary:**\n- Active: ${m.activeCount} | Won: ${m.wonCount} | Lost: ${m.lostCount}\n- Conversion: ${m.conversionRate}\n- Pipeline value: ${money(m.pipelineValue)}\n- Weighted: ${money(m.weightedPipeline)}\n- Avg deal: ${money(m.avgDealValue)}`;
        return reply(r.summary + extra, r.data, undefined, [r]);
    }
    if (intent.intent === 'hot_cold') {
        if (!canExecute('list_opportunities', ctx.permissions)) return reply('You don\'t have permission to view opportunities.');
        const hcParams = inheritFilters(await enrichFiltersFromMasterData(message, { ...intent.params }), conv);
        conv.lastFilters = { ...hcParams };
        const result = await execHotCold(hcParams, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'revenue_analytics') {
        if (!canExecute('revenue_analytics', ctx.permissions)) return reply('No permission for analytics.');
        const r = await execRevenueAnalytics(intent.params);
        return reply(r.summary, r.data, undefined, [r]);
    }
    if (intent.intent === 'deal_health') {
        if (!canExecute('deal_health', ctx.permissions)) return reply('No permission.');
        const r = await execDealHealth();
        let extra = '';
        if (r.data?.stalled?.length > 0) { extra += '\n\n**Stalled (30+ days):**'; r.data.stalled.slice(0, 5).forEach((s: any) => extra += `\n  - ${s.title} (${s.client}) - ${s.daysSinceUpdate}d, ${money(s.value)}`); }
        if (r.data?.atRisk?.length > 0) { extra += '\n\n**At Risk (14-30 days):**'; r.data.atRisk.slice(0, 5).forEach((s: any) => extra += `\n  - ${s.title} (${s.client}) - ${s.daysSinceUpdate}d, ${money(s.value)}`); }
        return reply(r.summary + extra, r.data, undefined, [r]);
    }
    if (intent.intent === 'forecast') {
        if (!canExecute('forecast', ctx.permissions)) return reply('No permission for analytics.');
        const r = await execForecast();
        const m = r.data?.metrics;
        let extra = '';
        if (m) extra = `\n\n**Forecast:**\n- Total pipeline: ${money(m.totalPipeline)}\n- Weighted: ${money(m.weightedForecast)}\n- Confidence: ${m.confidence}\n- Active deals: ${m.dealCount}`;
        return reply(r.summary + extra, r.data, undefined, [r]);
    }

    // ─── LEAD MANAGEMENT ─────────────────────────────────────────────────────

    if (intent.intent === 'create_lead') {
        if (!canExecute('create_lead', ctx.permissions))
            return reply(`You don't have permission to create leads. Your role: **${ctx.roleName}**.`);
        conv.mode = 'creating_lead';
        conv.entityType = 'lead';
        conv.collectedFields = { _isCreate: true };
        for (const [k, v] of Object.entries(intent.params)) {
            if (v !== null && v !== undefined && v !== '') {
                const fieldDef = LEAD_FIELDS.find(f => f.key === k);
                if (fieldDef) processFieldValue(k, String(v), conv, master);
            }
        }
        conv.missingRequired = LEAD_FIELDS.filter(f => f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        conv.optionalRemaining = LEAD_FIELDS.filter(f => !f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        const prefilled = Object.entries(conv.collectedFields).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
            const def = LEAD_FIELDS.find(f => f.key === k);
            return `- **${def?.label || k}:** ${v}`;
        });
        let response = `Let's create a new lead! I'll walk you through the details.\n`;
        if (prefilled.length > 0) response += `\nCaptured from your message:\n${prefilled.join('\n')}\n`;
        const nextPrompt = await getNextFieldPrompt(conv);
        if (nextPrompt) response += `\n${nextPrompt}`;
        else { conv.mode = 'confirming'; response += `\n${buildConfirmationSummary(conv)}`; }
        return reply(response, undefined, conv.missingRequired.concat(conv.optionalRemaining));
    }

    // ─── CONTACT MANAGEMENT ──────────────────────────────────────────────────────

    if (intent.intent === 'list_contacts') {
        const result = await execListContacts(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'get_contact') {
        if (!intent.params.nameOrId) return reply('Which contact? Provide the name or email (e.g., get contact "John Smith").');
        const result = await execGetContact(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'create_contact') {
        if (!canExecute('create_contact', ctx.permissions))
            return reply(`You don't have permission to create contacts. Your role: **${ctx.roleName}**.`);
        conv.mode = 'creating_contact';
        conv.entityType = 'contact';
        conv.collectedFields = { _isCreate: true };
        for (const [k, v] of Object.entries(intent.params)) {
            if (v !== null && v !== undefined && v !== '') {
                const fieldDef = CONTACT_FIELDS.find(f => f.key === k);
                if (fieldDef) processFieldValue(k, String(v), conv, master);
            }
        }
        conv.missingRequired = CONTACT_FIELDS.filter(f => f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        conv.optionalRemaining = CONTACT_FIELDS.filter(f => !f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        let response = `Let's create a new contact!\n`;
        const nextPrompt = await getNextFieldPrompt(conv);
        if (nextPrompt) response += `\n${nextPrompt}`;
        else { conv.mode = 'confirming'; response += `\n${buildConfirmationSummary(conv)}`; }
        return reply(response, undefined, conv.missingRequired.concat(conv.optionalRemaining));
    }

    if (intent.intent === 'delete_contact') {
        if (!canExecute('delete_contact', ctx.permissions))
            return reply(`You don't have permission to delete contacts. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which contact to delete? Provide the name or email.');
        const result = await execDeleteContact(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ─── COMMENTS / NOTES ────────────────────────────────────────────────────────

    if (intent.intent === 'add_comment') {
        if (!canExecute('add_comment', ctx.permissions))
            return reply(`You don't have permission to add comments. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity? Provide the name in quotes (e.g., add comment to "Project Alpha").');
        if (!intent.params.comment) return reply('What comment would you like to add? (e.g., add comment to "Project Alpha" comment "Update: Client approved budget")');
        const result = await execAddComment(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'list_comments') {
        if (!intent.params.nameOrId) return reply('Which opportunity? Provide the name in quotes (e.g., show comments on "Project Alpha").');
        const result = await execListComments(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ─── GOM / APPROVALS ─────────────────────────────────────────────────────────

    if (intent.intent === 'approve_gom') {
        if (!canExecute('approve_gom', ctx.permissions))
            return reply(`You don't have permission to approve GOM. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to approve GOM for? Provide the name.');
        const result = await execApproveGom(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'review_gom') {
        if (!canExecute('review_gom', ctx.permissions))
            return reply(`You don't have permission to review GOM approvals. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to review GOM approval for?');
        const result = await execReviewGom(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'gom_status') {
        if (!intent.params.nameOrId) return reply('Which opportunity to check GOM status for?');
        const result = await execGomStatus(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ─── CONVERT OPPORTUNITY ─────────────────────────────────────────────────────

    if (intent.intent === 'convert_opportunity') {
        if (!canExecute('convert_opportunity', ctx.permissions))
            return reply(`You don't have permission to convert opportunities. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to convert to Closed Won? Provide the name.');
        const result = await execConvertOpportunity(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ─── LIFECYCLE ACTIONS ───────────────────────────────────────────────────────

    if (intent.intent === 'move_to_presales') {
        if (!canExecute('move_to_presales', ctx.permissions))
            return reply(`You don't have permission to move opportunities. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to move to Presales? Provide the name in quotes (e.g., move "Project Alpha" to presales).');
        const result = await execMoveToPresales(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'move_to_sales') {
        if (!canExecute('move_to_sales', ctx.permissions))
            return reply(`You don't have permission to move opportunities. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to move to Sales? Provide the name in quotes (e.g., move "Project Alpha" to sales).');
        const result = await execMoveToSales(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'proposal_sent') {
        if (!canExecute('proposal_sent', ctx.permissions))
            return reply(`You don't have permission to update opportunities. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity\'s proposal was sent? Provide the name in quotes (e.g., proposal sent for "Project Alpha").');
        const result = await execProposalSent(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'mark_lost') {
        if (!canExecute('mark_lost', ctx.permissions))
            return reply(`You don't have permission to update opportunities. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to mark as lost? Provide the name in quotes (e.g., mark "Project Alpha" as lost).');
        const result = await execMarkLost(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'reestimate') {
        if (!canExecute('reestimate', ctx.permissions))
            return reply(`You don't have permission to update opportunities. Your role: **${ctx.roleName}**.`);
        if (!intent.params.nameOrId) return reply('Which opportunity to send back for re-estimate? Provide the name in quotes (e.g., send back "Project Alpha" for re-estimate).');
        const result = await execReestimate(intent.params, ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ─── ADMIN ───────────────────────────────────────────────────────────────────

    if (intent.intent === 'list_users') {
        if (!canExecute('list_users', ctx.permissions))
            return reply(`You don't have permission to list users. Your role: **${ctx.roleName}**.`);
        const result = await execListUsers(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'list_audit_logs') {
        if (!canExecute('list_audit_logs', ctx.permissions))
            return reply(`You don't have permission to view audit logs. Your role: **${ctx.roleName}**.`);
        const result = await execListAuditLogs(intent.params);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'my_profile') {
        const result = await execMyProfile(ctx);
        return reply(result.summary, result.data, undefined, [result]);
    }

    if (intent.intent === 'list_resources') {
        if (!canExecute('list_resources', ctx.permissions))
            return reply(`You don't have permission to view resources. Your role: **${ctx.roleName}**.`);
        const result = await execListResources();
        return reply(result.summary, result.data, undefined, [result]);
    }

    // ─── GREETINGS & SMALL TALK (handled before general_chat LLM call) ───
    if (intent.intent === 'greeting') {
        const timeH = new Date().getUTCHours() + 5.5; // IST approximate
        const timeOfDay = timeH < 12 ? 'morning' : timeH < 17 ? 'afternoon' : 'evening';
        return reply(`Good ${timeOfDay}, **${ctx.userName}**! How can I help you today?\n\nTry saying things like:\n- "Show my opportunities"\n- "Create a new deal"\n- "Pipeline analytics"\n- "Help" for full list of commands`);
    }
    if (intent.intent === 'thanks') {
        return reply(`You're welcome, **${ctx.userName}**! Let me know if you need anything else.`);
    }
    if (intent.intent === 'farewell') {
        return reply(`Goodbye, **${ctx.userName}**! Have a great day. I'm always here when you need me.`);
    }
    if (intent.intent === 'about_bot') {
        const status = getLLMStatus();
        const llmInfo = status.available && !status.circuitOpen
            ? `\n\n*Powered by LLM (${status.provider} / ${status.model}) + NLP fallback*`
            : `\n\n*Running on built-in NLP engine${status.available ? ' (LLM temporarily unavailable)' : ''}*`;
        return reply(getHelpText(ctx) + llmInfo);
    }

    // ─── SALVAGE: infer the question from what it CONTAINS ───
    //
    // Rule matching asks "does this sentence use the words I expect?", which
    // fails the moment someone phrases a question their own way — "show sales
    // person wise ADM statistics" names a grouping and a filter, yet matched no
    // rule and fell through to the help text.
    //
    // So before giving up, look at what the sentence actually resolves to. If
    // it names a dimension to group by, or an entity to filter on, it is a data
    // question regardless of the verbs used, and answering it beats reciting a
    // menu. Naming the filter back in the reply keeps a wrong guess visible
    // rather than silent.
    if (intent.intent === 'general_chat' && canExecute('list_opportunities', ctx.permissions)) {
        // What THIS sentence resolves to on its own, before any inherited
        // context is layered on. The distinction matters: filters carried over
        // from the previous question say nothing about whether the current one
        // was understood, and treating them as evidence would skip the rescue
        // and answer a brand-new question with the last one's shape.
        const own = await enrichFiltersFromMasterData(message, extractChartParams(message.toLowerCase()));
        let salvaged = inheritFilters({ ...own }, conv);

        // Rules found nothing usable — ask the model for slots. Its entity guess
        // is resolved against master data, so a hallucinated name simply fails
        // to match rather than producing a confident wrong answer.
        const noRealDimension = !own.groupBy || own.__groupByDefaulted;
        if (noRealDimension && !CARRYABLE_FILTERS.some(k => own[k])) {
            const hinted = await resolveSlots(message);
            if (hinted) {
                if (hinted.__entityHint) {
                    const resolved = await enrichFiltersFromMasterData(String(hinted.__entityHint), {});
                    Object.assign(salvaged, resolved);
                    delete hinted.__entityHint;
                }
                salvaged = { ...salvaged, ...hinted };
                // The model named a dimension, so it is no longer a default.
                if (hinted.groupBy) delete salvaged.__groupByDefaulted;
            }
        }
        const namedFilter = ['client', 'technology', 'practice', 'region', 'projectType', 'pricingModel', 'salesRep', 'stage']
            .some(k => salvaged[k]);
        const namedDimension = /\b(?:by|per|across|split|grouped)\b/i.test(message)
            || /\b[a-z]+\s*[- ]?wise\b/i.test(message)
            || (!!salvaged.groupBy && !salvaged.__groupByDefaulted);   // rules or model found a real one

        if (namedDimension && salvaged.groupBy) {
            delete salvaged.__groupByDefaulted;
            const result = await execCustomChart(salvaged, ctx);
            return reply(result.summary, result.data, undefined, [result]);
        }
        if (namedFilter) {
            const result = await execCountOpportunities(salvaged, ctx);
            return reply(result.summary, result.data, undefined, [result]);
        }
    }

    // ─── GENERAL CHAT (LLM-enriched conversational fallback) ───
    // This path has not queried anything, so it cannot know anything. Asked "is
    // there anything worth worrying about right now?" the local model replied
    // "everything seems to be running smoothly" — fluent, confident, and with no
    // data behind it. A CRM assistant telling a manager the pipeline is fine when
    // it never looked is worse than one that admits it did not understand.
    //
    // So prose is allowed only for talk ABOUT the assistant — greetings, thanks,
    // "what can you do". Everything else falls through to the deterministic help
    // text. Questions about the data are answered above from real rows, or not at
    // all.
    const CHITCHAT = /^\s*(hi|hello|hey|thanks|thank you|ok|okay|cool|bye|good\s+(morning|afternoon|evening)|who are you|what can you do|what do you do|how are you)\b/i;
    if (intent.intent === 'general_chat' && CHITCHAT.test(message)) {
        const llmResponse = await llmGeneralChat(message, ctx, conv.history);
        if (llmResponse) return reply(llmResponse);
    }

    return reply(getHelpText(ctx));
}

function reply(content: string, data?: any, pendingFields?: string[], actions?: ActionResult[]): ChatMessage {
    return { role: 'assistant', content, data, actions, pendingFields };
}

function getHelpText(ctx: UserContext): string {
    const lines = [`Hi **${ctx.userName}**! I'm your Q-CRM AI assistant. Here's what I can do:\n`];
    const p = ctx.permissions;
    const isAdmin = p.includes('*');
    if (isAdmin || p.includes('pipeline:view')) {
        lines.push('**Opportunities**');
        lines.push('  - "Show my opportunities" / "List deals in Proposal stage"');
        lines.push('  - "Tell me about deal \'Project Phoenix\'"');
        lines.push('  - "Which deals are stalled?"');
    }
    if (isAdmin || p.includes('pipeline:write')) {
        lines.push('');
        lines.push('**Create & Update**');
        lines.push('  - "Create a new opportunity" - guided step by step');
        lines.push('  - "Create a deal called \'ABC Project\' worth 500K for Acme Corp"');
        lines.push('  - "Move \'Project Alpha\' to Negotiation"');
        lines.push('  - "Convert \'Project Alpha\' to Closed Won"');
        lines.push('');
        lines.push('**Opportunity Lifecycle**');
        lines.push('  - "Move \'Project Alpha\' to Presales" — Pipeline → Presales');
        lines.push('  - "Move \'Project Alpha\' to Sales" — Presales → Sales (needs GOM)');
        lines.push('  - "Proposal sent for \'Project Alpha\'" — Proposal → Negotiation');
        lines.push('  - "Mark \'Project Alpha\' as lost" — Close as Lost');
        lines.push('  - "Send back \'Project Alpha\' for re-estimate" — Back to Presales');
        lines.push('  - "Convert \'Project Alpha\' to project" — Won → Project');
    }
    if (isAdmin || p.includes('leads:manage')) {
        lines.push('');
        lines.push('**Lead Management**');
        lines.push('  - "Create a new lead" - with lead scoring');
        lines.push('  - "New lead: John Smith from Acme Corp, VP Sales, 500K deal"');
    }
    lines.push('');
    lines.push('**Contact Management**');
    lines.push('  - "List contacts" / "Search contacts for John"');
    lines.push('  - "Create a contact" / "Get contact John Smith"');
    lines.push('  - "Delete contact john@acme.com"');
    if (isAdmin || p.includes('pipeline:write') || p.includes('presales:write')) {
        lines.push('');
        lines.push('**Comments & Notes**');
        lines.push('  - "Add comment to \'Project Alpha\': Client approved budget"');
        lines.push('  - "Show comments on \'Project Alpha\'"');
    }
    if (isAdmin || p.includes('approvals:manage')) {
        lines.push('');
        lines.push('**GOM & Approvals**');
        lines.push('  - "Approve GOM for \'Project Alpha\'"');
        lines.push('  - "Review GOM approval for \'Project Alpha\'"');
        lines.push('  - "Check GOM status for \'Project Alpha\'"');
    }
    if (isAdmin || p.includes('analytics:view')) {
        lines.push('');
        lines.push('**Analytics & Insights**');
        lines.push('  - "Show pipeline analytics" / "Revenue by technology"');
        lines.push('  - "Top clients by revenue" / "Monthly revenue trend"');
        lines.push('  - "What\'s our weighted forecast?"');
    }
    if (isAdmin) {
        lines.push('');
        lines.push('**Admin**');
        lines.push('  - "List users" / "Show users in Engineering"');
        lines.push('  - "Show audit logs" / "Recent audit logs"');
        lines.push('  - "List resources"');
    }
    lines.push('');
    lines.push('**General**');
    lines.push('  - "My profile" - view your role & permissions');
    lines.push('\nYou can chat naturally - I\'ll understand your intent!');
    return lines.join('\n');
}

// Log interaction to DB
export async function logInteraction(message: string, response: ChatMessage, ctx: UserContext) {
    try {
        await prisma.aIInteraction.create({
            data: {
                type: 'CHAT', prompt: message, response: response.content,
                status: response.actions?.every(r => r.success) ? 'Completed' : (response.actions?.length ? 'Partial' : 'Completed'),
                toolsCalled: response.actions?.map(r => ({ tool: r.tool, success: r.success })) || [],
                userId: ctx.userId,
                opportunityId: response.actions?.find(r => r.data?.opportunityId)?.data?.opportunityId || null,
            },
        });
    } catch {}
}

