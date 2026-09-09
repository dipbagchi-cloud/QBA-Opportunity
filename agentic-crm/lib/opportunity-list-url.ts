/**
 * Review state <-> URL for the opportunities list.
 *
 * Extracted from the list page so the round trip can be unit tested: these
 * helpers decide what a user gets back when they return to a review, and they
 * parse a user-supplied query string into values that go on to build the API
 * request.
 */

type ColFilters = Record<string, string[]>;

/** The list's column model, as far as these helpers care about it. */
export type ListUrlConfig = {
    /** Columns that carry a server-side filter. */
    filterKeys: string[];
    /** Columns that can be sorted (server- or client-side). */
    sortableKeys: string[];
};

// -- Review state <-> URL ----------------------------------------------------
// The filter / sort / view selection is mirrored into the query string so a
// review survives leaving the list and coming back - opening a deal and
// pressing Back, a refresh, or re-opening the same link in another tab - rather
// than silently resetting to an unfiltered first page.
//
// Keeping it in the URL rather than in storage is deliberate for CR-13's fifth
// acceptance criterion: arriving at /dashboard/opportunities fresh (the sidebar
// link) always gives the clean default view, so a narrow filter applied earlier
// can never invisibly exclude opportunities from a later review. When a filter
// IS restored it comes back with its chips, so it stays visible and one click
// still clears it.
export const VIEW_MODES = ['list', 'kanban', 'by_owner', 'delivery'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];
export const DEFAULT_PAGE_SIZE = 10;
export const ALLOWED_PAGE_SIZES = [10, 25, 50, 100, 0];

export type ListViewState = {
    search: string;
    filters: ColFilters;
    openOnly: boolean;
    sortKey: string | null;
    sortDir: 'asc' | 'desc';
    viewMode: ViewMode;
    page: number;
    limit: number;
};

export function serializeListState(state: ListViewState, config: ListUrlConfig): string {
    const params = new URLSearchParams();
    if (state.search.trim()) params.set('q', state.search);
    config.filterKeys.forEach((k) => {
        (state.filters[k] || []).filter(Boolean).forEach((v) => params.append(`f_${k}`, v));
    });
    if (state.openOnly) params.set('open', '1');
    if (state.sortKey && config.sortableKeys.includes(state.sortKey)) {
        params.set('sort', state.sortKey);
        params.set('dir', state.sortDir);
    }
    if (state.viewMode !== 'list') params.set('view', state.viewMode);
    if (state.page > 1) params.set('page', String(state.page));
    if (state.limit !== DEFAULT_PAGE_SIZE) params.set('limit', String(state.limit));
    return params.toString();
}

// Reads a review state back out of the query string. Every value is checked
// against the known column / view / page-size sets, because the URL is
// user-supplied and these values go on to build the API query. Returns null
// when the URL carries no review state at all - that is the plain sidebar
// link, which must stay unfiltered.
export function parseListState(search: string, config: ListUrlConfig): ListViewState | null {
    if (!search) return null;
    const params = new URLSearchParams(search);

    const filters: ColFilters = {};
    config.filterKeys.forEach((k) => {
        const values = params.getAll(`f_${k}`).map(v => v.trim()).filter(Boolean);
        if (values.length) filters[k] = values;
    });

    const rawSort = params.get('sort');
    const rawView = params.get('view') || '';
    // A missing or blank value must not be read as a number: Number(null) is 0,
    // and 0 is the legitimate "ALL" page size, so any query string at all would
    // otherwise flip the list to an unpaged 500-row fetch.
    const asNumber = (raw: string | null) => (raw !== null && raw.trim() !== '' ? Number(raw) : NaN);
    const rawLimit = asNumber(params.get('limit'));
    const rawPage = asNumber(params.get('page'));

    const state: ListViewState = {
        search: params.get('q') || '',
        filters,
        openOnly: params.get('open') === '1',
        sortKey: rawSort && config.sortableKeys.includes(rawSort) ? rawSort : null,
        sortDir: params.get('dir') === 'desc' ? 'desc' : 'asc',
        viewMode: (VIEW_MODES as readonly string[]).includes(rawView) ? (rawView as ViewMode) : 'list',
        page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
        limit: ALLOWED_PAGE_SIZES.includes(rawLimit) ? rawLimit : DEFAULT_PAGE_SIZE,
    };

    const carriesState = !!state.search
        || Object.keys(filters).length > 0
        || state.openOnly
        || !!state.sortKey
        || state.viewMode !== 'list'
        || state.page > 1
        || state.limit !== DEFAULT_PAGE_SIZE;
    return carriesState ? state : null;
}
