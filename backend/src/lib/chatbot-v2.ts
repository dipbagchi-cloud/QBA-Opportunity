import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import * as chrono from 'chrono-node';

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
    mode: 'idle' | 'creating' | 'updating' | 'confirming' | 'creating_lead' | 'creating_contact';
    entityType?: 'opportunity' | 'lead' | 'contact';
    targetOpportunityId?: string;
    targetContactId?: string;
    collectedFields: Record<string, any>;
    missingRequired: string[];
    optionalRemaining: string[];
    history: { role: 'user' | 'assistant'; content: string }[];
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
    const [clients, stages, regions, technologies, pricingModels, projectTypes, salespersons, currencies] = await Promise.all([
        prisma.client.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.stage.findMany({ select: { id: true, name: true, order: true, probability: true, isClosed: true, isWon: true }, orderBy: { order: 'asc' } }),
        prisma.region.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.technology.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.pricingModel.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.projectType.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.currencyRate.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, symbol: true }, orderBy: { code: 'asc' } }),
    ]);
    _masterCache = { clients, stages, regions, technologies, pricingModels, projectTypes, salespersons, currencies, lastLoaded: Date.now() };
    console.log(`[Chatbot] Master cache loaded: ${clients.length} clients, ${stages.length} stages, ${regions.length} regions, ${technologies.length} techs, ${pricingModels.length} pricing, ${projectTypes.length} projTypes, ${salespersons.length} users, ${currencies.length} currencies`);
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
//

const LLM_API_URL = process.env.LLM_API_URL || process.env.OPENAI_API_URL || process.env.OPENAI_BASE_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Circuit breaker: stop calling LLM after repeated failures to avoid latency
let llmFailureCount = 0;
let llmCircuitOpenUntil = 0;
const LLM_CIRCUIT_THRESHOLD = 3;   // failures before opening circuit
const LLM_CIRCUIT_COOLDOWN = 5 * 60 * 1000; // 5 min cooldown

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
    if (!LLM_API_KEY) return null;
    // Circuit breaker open?
    if (llmFailureCount >= LLM_CIRCUIT_THRESHOLD && Date.now() < llmCircuitOpenUntil) {
        return null;
    }
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: LLM_API_KEY,
            ...(LLM_API_URL ? { baseURL: LLM_API_URL.replace(/\/chat\/completions\/?$/, '') } : {}),
        });
    }
    return openaiClient;
}

function recordLLMSuccess() {
    llmFailureCount = 0;
    llmCircuitOpenUntil = 0;
}

function recordLLMFailure() {
    llmFailureCount++;
    if (llmFailureCount >= LLM_CIRCUIT_THRESHOLD) {
        llmCircuitOpenUntil = Date.now() + LLM_CIRCUIT_COOLDOWN;
        console.warn(`[Chatbot] LLM circuit breaker OPEN — ${llmFailureCount} failures. Cooling down until ${new Date(llmCircuitOpenUntil).toISOString()}`);
    }
}

export function getLLMStatus(): { available: boolean; provider: string; model: string; circuitOpen: boolean; failures: number } {
    return {
        available: !!LLM_API_KEY,
        provider: LLM_API_URL ? new URL(LLM_API_URL).hostname : 'api.openai.com',
        model: LLM_MODEL,
        circuitOpen: llmFailureCount >= LLM_CIRCUIT_THRESHOLD && Date.now() < llmCircuitOpenUntil,
        failures: llmFailureCount,
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
For mark_lost: nameOrId (deal name), lostType ("Closed Lost" or "Proposal Lost"), remarks (reason for losing)
For reestimate: nameOrId (deal name), comment (why re-estimation needed), adjustedValue (optional new value)
For revenue_analytics: groupBy (technology, client, owner, month)
For provide_field_value: fieldName, fieldValue

Opportunity Lifecycle: Pipeline (Discovery) → Presales (Qualification) → Sales (Proposal → Negotiation) → Project (Closed Won)
The words "presales" and "qualification" refer to the same stage. "sales" and "proposal" refer to the same stage.

Value parsing: "500K" = 500000, "2M" = 2000000, "1.5 crore" = 15000000
Date formats: accept any format
If the user says "skip" or "none" for a field, set fieldValue to "__SKIP__"

IMPORTANT: Return ONLY the JSON object, no markdown or extra text.`;

async function callLLM(userMessage: string, conversationContext: string): Promise<LLMParsedIntent | null> {
    const client = getOpenAIClient();
    if (!client) return null;
    try {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...(conversationContext ? [{ role: 'system' as const, content: `Current conversation state: ${conversationContext}` }] : []),
            { role: 'user', content: userMessage },
        ];
        const completion = await client.chat.completions.create({
            model: LLM_MODEL, messages, temperature: 0.1, max_tokens: 500,
        });
        const content = completion.choices?.[0]?.message?.content?.trim();
        if (!content) return null;
        const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(jsonStr);
        recordLLMSuccess();
        return parsed;
    } catch (e) {
        recordLLMFailure();
        console.error('[Chatbot] LLM call failed, falling back to NLP:', (e as Error).message);
        return null;
    }
}

/** Use LLM for free-form conversational response (general_chat) */
async function llmGeneralChat(userMessage: string, ctx: UserContext, conversationHistory: { role: string; content: string }[]): Promise<string | null> {
    const client = getOpenAIClient();
    if (!client) return null;
    try {
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
            model: LLM_MODEL, messages, temperature: 0.7, max_tokens: 300,
        });
        const content = completion.choices?.[0]?.message?.content?.trim();
        recordLLMSuccess();
        return content || null;
    } catch (e) {
        recordLLMFailure();
        return null;
    }
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

    if (conv.mode === 'confirming') {
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
        const lostType = /\bproposal.?lost\b/i.test(lower) ? 'Proposal Lost' : 'Closed Lost';
        const remarksMatch = lower.match(/(?:reason|because|remark|due to|:\s*)["']?(.{5,})["']?\s*$/i);
        return { intent: 'mark_lost', params: { nameOrId: extractEntityName(lower), lostType, remarks: remarksMatch?.[1]?.trim() || '' }, confidence: 0.9 };
    }

    // Send back for Re-estimate (before generic UPDATE)
    if (/\b(re[\s-]?estimat|send\s*back|return\s*(for|to)|revert|revision)\b/i.test(lower) &&
        !(/\b(create|add|new)\b/i.test(lower))) {
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

    // ANALYTICS: Pipeline (before list)
    if (/\b(pipeline|funnel|stage\s*breakdown|conversion\s*rate|how\s*(?:is|are)\s*(?:our|the)\s*pipeline|stage\s*distribution)\b/i.test(lower) &&
        /\b(analytics?|stats?|summary|overview|report|breakdown|show|get|how)\b/i.test(lower))
        return { intent: 'pipeline_analytics', params: {}, confidence: 0.9 };

    // ANALYTICS: Revenue (before list)
    if (/\b(revenue|top\s*clients?|revenue\s*by|monthly\s*revenue|earning|income|sales\s*by)\b/i.test(lower)) {
        let groupBy = 'technology';
        if (/\b(tech(nology)?|stack)\b/i.test(lower)) groupBy = 'technology';
        else if (/\b(clients?|customers?|accounts?)\b/i.test(lower)) groupBy = 'client';
        else if (/\b(owners?|reps?|sales\s*reps?)\b/i.test(lower)) groupBy = 'owner';
        else if (/\b(months?|monthly|trend)\b/i.test(lower)) groupBy = 'month';
        return { intent: 'revenue_analytics', params: { groupBy }, confidence: 0.85 };
    }

    // ANALYTICS: Deal Health (before list)
    if (/\b(health|stalled|at.risk|risk|aging|stuck|inactive|dormant)\b/i.test(lower))
        return { intent: 'deal_health', params: {}, confidence: 0.85 };

    // ANALYTICS: Forecast (before list)
    if (/\b(forecast|predict|expected\s*revenue|weighted\s*pipeline|projection)\b/i.test(lower))
        return { intent: 'forecast', params: {}, confidence: 0.9 };

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
    if (/(delete|remove|deactivate)\b/i.test(lower) && /\b(contacts?)\b/i.test(lower)) {
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
    if (/\b(my|me|who am i|profile|my role|my permissions?|what can i do)\b/i.test(lower) &&
        /\b(profile|role|permissions?|info|details?|who|what)\b/i.test(lower)) {
        return { intent: 'my_profile', params: {}, confidence: 0.85 };
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

function extractListParams(lower: string): Record<string, any> {
    const params: Record<string, any> = {};
    for (const stage of STAGE_NAMES) {
        if (lower.includes(stage)) {
            params.stage = stage.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            break;
        }
    }
    if (/\bmy\b/.test(lower)) params.owner = '__SELF__';
    const clientMatch = lower.match(/(?:for|from|client)\s+["']([^"']+)["']/i);
    if (clientMatch) params.client = clientMatch[1].trim();
    const valMatch = lower.match(/(?:above|over|more than|greater than|>)\s+\$?([\d,.]+)\s*(k|m)?/i);
    if (valMatch) params.minValue = parseMoneyValue(valMatch[0].replace(/^(above|over|more than|greater than|>)\s+/i, ''));
    return params;
}

// ─── PERMISSION CHECKS ─────────────────────────────────────────────────────

function canExecute(intent: string, permissions: string[]): boolean {
    if (permissions.includes('*')) return true;
    switch (intent) {
        case 'list_opportunities': case 'get_details': case 'deal_health':
        case 'list_comments': case 'gom_status':
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
    const where: any = { isArchived: false };
    if (params.stage) {
        const stage = await prisma.stage.findFirst({ where: { name: { contains: params.stage, mode: 'insensitive' } } });
        if (stage) where.stageId = stage.id;
    }
    if (params.client) where.client = { name: { contains: params.client, mode: 'insensitive' } };
    if (params.owner === '__SELF__') where.ownerId = ctx.userId;
    if (params.technology) where.technology = { contains: params.technology, mode: 'insensitive' };
    if (params.region) where.region = { contains: params.region, mode: 'insensitive' };
    if (params.minValue) where.value = { gte: params.minValue };
    if (params.maxValue) where.value = { ...where.value, lte: params.maxValue };
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
    return {
        tool: 'list_opportunities', success: true,
        summary: data.length > 0 ? `Found **${data.length}** opportunities.` : 'No opportunities found matching your criteria.',
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
        await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: newStage.id } });
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
        summary: `Pipeline: **${activeCount}** active deals worth **$${(pipelineValue / 1000).toFixed(0)}K**. Conversion rate: **${convRate}%**.`,
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
        summary: `Revenue by ${groupBy}: **${sorted.length}** groups. Top: **${sorted[0]?.[0]}** ($${Math.round((sorted[0]?.[1]?.value || 0) / 1000)}K).`,
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
        summary: `Pipeline: **$${(pipelineValue / 1000).toFixed(0)}K** total, **$${(weightedValue / 1000).toFixed(0)}K** weighted forecast (${((weightedValue / (pipelineValue || 1)) * 100).toFixed(1)}% confidence).`,
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

    let scoreLabel = 'Cold';
    if (score > 70) scoreLabel = 'Hot';
    else if (score > 40) scoreLabel = 'Warm';

    return {
        tool: 'create_lead', success: true,
        summary: `Lead **"${params.title}"** created successfully!\n- Company: ${params.companyName || '-'}\n- Contact: ${params.contactFirstName} ${params.contactLastName} (${params.contactEmail})\n- Value: $${Number(params.value || 0).toLocaleString()}\n- Lead Score: **${score}** (${scoreLabel})\n- Factors: ${factors.join(', ') || 'None'}`,
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
    await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: closedWon.id } });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'CONVERT_TO_PROJECT', userId: ctx.userId, changes: `Converted to Closed Won via Chat` } });
    return {
        tool: 'convert_opportunity', success: true,
        summary: `**"${opp.title}"** has been converted to **Closed Won**!\n- Client: ${opp.client?.name}\n- Value: $${Number(opp.value).toLocaleString()}\n- Status: SOW Approved`,
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
    await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: qualStage.id } });
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
    await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: proposalStage.id } });
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
    await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: negStage.id } });
    await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: opp.id, action: 'STAGE_CHANGE', userId: ctx.userId, changes: `Proposal sent — moved to Negotiation via Chat` } });
    return {
        tool: 'proposal_sent', success: true,
        summary: `Proposal marked as sent for **"${opp.title}"** — moved to **Negotiation**!\n- Client: ${opp.client?.name || '-'}\n- Previous: Proposal → **Negotiation**\n- Probability: ${negStage.probability || 80}%\n\nNext: Convert to project when won, or mark as lost if declined.`,
    };
}

/** Mark as Lost (→ Closed Lost or Proposal Lost) */
async function execMarkLost(params: any, ctx: UserContext): Promise<ActionResult> {
    if (!params.nameOrId) return { tool: 'mark_lost', success: false, summary: 'Which opportunity? Provide the name in quotes (e.g., mark "Project Alpha" as lost).' };
    const opp = await findOpportunity(params.nameOrId);
    if (!opp) return { tool: 'mark_lost', success: false, summary: `Opportunity "${params.nameOrId}" not found.` };

    const currentStage = opp.stage?.name || '';
    if (currentStage === 'Closed Won' || currentStage === 'Closed Lost' || currentStage === 'Proposal Lost') {
        return { tool: 'mark_lost', success: false, summary: `**"${opp.title}"** is already in **${currentStage}** — cannot change.` };
    }

    // Determine lost type based on current stage
    let lostType = params.lostType || 'Closed Lost';
    if (currentStage === 'Qualification' || currentStage === 'Proposal') {
        lostType = 'Proposal Lost';
    }

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
    await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: lostStage.id } });
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
        update.adjustedEstimatedValue = Number(params.adjustedValue);
    }

    await prisma.opportunity.update({ where: { id: opp.id }, data: update });
    await prisma.stageHistory.create({ data: { opportunityId: opp.id, stageId: qualStage.id } });
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
        availability: r.availability || '-', rate: r.standardRate ? `$${Number(r.standardRate).toLocaleString()}` : '-',
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

    let intent = await callLLM(message, convContext);
    if (!intent) intent = nlpParseIntent(message, conv);

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
        conv.mode = 'creating';
        conv.collectedFields = { _isCreate: true };
        for (const [k, v] of Object.entries(intent.params)) {
            if (v !== null && v !== undefined && v !== '') {
                const fieldDef = OPPORTUNITY_FIELDS.find(f => f.key === k);
                if (fieldDef) processFieldValue(k, String(v), conv, master);
            }
        }
        conv.missingRequired = OPPORTUNITY_FIELDS.filter(f => f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        conv.optionalRemaining = OPPORTUNITY_FIELDS.filter(f => !f.required && !(f.key in conv.collectedFields)).map(f => f.key);
        const prefilled = Object.entries(conv.collectedFields).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
            const def = OPPORTUNITY_FIELDS.find(f => f.key === k);
            return `- **${def?.label || k}:** ${k === 'value' ? `$${Number(v).toLocaleString()}` : v}`;
        });
        let response = `Let's create a new opportunity! I'll walk you through the required information.\n`;
        if (prefilled.length > 0) response += `\nI captured these details from your message:\n${prefilled.join('\n')}\n`;
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
        return reply(`What would you like to update on **"${opp.title}"**?\n\nCurrent details:\n- Stage: ${opp.stage?.name}\n- Client: ${opp.client?.name}\n- Value: $${Number(opp.value).toLocaleString()}\n- Technology: ${opp.technology || '-'}\n- Region: ${opp.region || '-'}\n\nYou can say things like:\n- "Move to Negotiation"\n- "Change value to 500K"\n- "Set technology to AI/ML"\n\nOr say **"cancel"** to abort.`);
    }

    // LIST
    if (intent.intent === 'list_opportunities') {
        if (!canExecute('list_opportunities', ctx.permissions)) return reply('You don\'t have permission to view opportunities.');
        const result = await execListOpportunities(intent.params, ctx);
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
        if (m) extra = `\n\n**Pipeline Summary:**\n- Active: ${m.activeCount} | Won: ${m.wonCount} | Lost: ${m.lostCount}\n- Conversion: ${m.conversionRate}\n- Pipeline value: $${(m.pipelineValue / 1000).toFixed(0)}K\n- Weighted: $${(m.weightedPipeline / 1000).toFixed(0)}K\n- Avg deal: $${(m.avgDealValue / 1000).toFixed(0)}K`;
        return reply(r.summary + extra, r.data, undefined, [r]);
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
        if (r.data?.stalled?.length > 0) { extra += '\n\n**Stalled (30+ days):**'; r.data.stalled.slice(0, 5).forEach((s: any) => extra += `\n  - ${s.title} (${s.client}) - ${s.daysSinceUpdate}d, $${(s.value / 1000).toFixed(0)}K`); }
        if (r.data?.atRisk?.length > 0) { extra += '\n\n**At Risk (14-30 days):**'; r.data.atRisk.slice(0, 5).forEach((s: any) => extra += `\n  - ${s.title} (${s.client}) - ${s.daysSinceUpdate}d, $${(s.value / 1000).toFixed(0)}K`); }
        return reply(r.summary + extra, r.data, undefined, [r]);
    }
    if (intent.intent === 'forecast') {
        if (!canExecute('forecast', ctx.permissions)) return reply('No permission for analytics.');
        const r = await execForecast();
        const m = r.data?.metrics;
        let extra = '';
        if (m) extra = `\n\n**Forecast:**\n- Total pipeline: $${(m.totalPipeline / 1000).toFixed(0)}K\n- Weighted: $${(m.weightedForecast / 1000).toFixed(0)}K\n- Confidence: ${m.confidence}\n- Active deals: ${m.dealCount}`;
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

    // ─── GENERAL CHAT (LLM-enriched conversational fallback) ───
    if (intent.intent === 'general_chat') {
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

