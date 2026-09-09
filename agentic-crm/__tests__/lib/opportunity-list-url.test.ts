import {
  DEFAULT_PAGE_SIZE,
  parseListState,
  serializeListState,
  type ListUrlConfig,
  type ListViewState,
} from '@/lib/opportunity-list-url';

const CONFIG: ListUrlConfig = {
  filterKeys: ['name', 'stage', 'salesRep', 'practice', 'technology', 'lifecycleStatus'],
  sortableKeys: ['name', 'stage', 'value', 'probability'],
};

const DEFAULTS: ListViewState = {
  search: '',
  filters: {},
  openOnly: false,
  sortKey: null,
  sortDir: 'asc',
  viewMode: 'list',
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
};

const state = (over: Partial<ListViewState> = {}): ListViewState => ({ ...DEFAULTS, ...over });

describe('serializeListState', () => {
  it('writes nothing for the default review view', () => {
    expect(serializeListState(DEFAULTS, CONFIG)).toBe('');
  });

  it('keeps every picked value of a multi-select column', () => {
    const qs = serializeListState(state({ filters: { practice: ['AI', 'Data'] } }), CONFIG);
    expect(new URLSearchParams(qs).getAll('f_practice')).toEqual(['AI', 'Data']);
  });

  it('records the All Open preset, sort, view, page and page size', () => {
    const qs = serializeListState(
      state({ openOnly: true, sortKey: 'value', sortDir: 'desc', viewMode: 'kanban', page: 3, limit: 50 }),
      CONFIG,
    );
    const p = new URLSearchParams(qs);
    expect(p.get('open')).toBe('1');
    expect(p.get('sort')).toBe('value');
    expect(p.get('dir')).toBe('desc');
    expect(p.get('view')).toBe('kanban');
    expect(p.get('page')).toBe('3');
    expect(p.get('limit')).toBe('50');
  });

  it('drops a sort on a column the list cannot sort', () => {
    expect(serializeListState(state({ sortKey: 'not-a-column' }), CONFIG)).toBe('');
  });
});

describe('parseListState', () => {
  it('returns null for a plain link, so the sidebar keeps giving a clean view', () => {
    // CR-13 acceptance criterion 5: the default review view must not silently
    // inherit a previously applied narrow filter.
    expect(parseListState('', CONFIG)).toBeNull();
    expect(parseListState('?', CONFIG)).toBeNull();
    expect(parseListState('?unrelated=1', CONFIG)).toBeNull();
  });

  it('restores a full review state', () => {
    const restored = parseListState(
      '?q=acme&f_practice=AI&f_practice=Data&f_stage=Proposal&open=1&sort=value&dir=desc&view=by_owner&page=2&limit=25',
      CONFIG,
    );
    expect(restored).toEqual({
      search: 'acme',
      filters: { stage: ['Proposal'], practice: ['AI', 'Data'] },
      openOnly: true,
      sortKey: 'value',
      sortDir: 'desc',
      viewMode: 'by_owner',
      page: 2,
      limit: 25,
    });
  });

  it('ignores filter columns the list does not have', () => {
    const restored = parseListState('?f_practice=AI&f_injected=x', CONFIG);
    expect(restored?.filters).toEqual({ practice: ['AI'] });
  });

  it('treats a URL of nothing but unusable values as no state at all', () => {
    expect(parseListState('?sort=DROP&dir=sideways&view=evil&limit=999&page=-4&open=yes', CONFIG)).toBeNull();
  });

  it('sanitises unusable values but keeps the rest of the review', () => {
    const restored = parseListState('?f_stage=Proposal&sort=DROP&view=evil&limit=999&page=-4&open=yes', CONFIG);
    expect(restored).toEqual({
      search: '',
      filters: { stage: ['Proposal'] },
      openOnly: false,       // only the exact '1' turns the preset on
      sortKey: null,
      sortDir: 'asc',
      viewMode: 'list',
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it('does not read a missing page size as the ALL option', () => {
    expect(parseListState('?q=acme', CONFIG)?.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListState('?q=acme&limit=', CONFIG)?.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListState('?q=acme&limit=0', CONFIG)?.limit).toBe(0); // the explicit "ALL" choice
  });

  it('drops blank filter values', () => {
    expect(parseListState('?f_practice=&f_practice=%20', CONFIG)).toBeNull();
  });

  it('round-trips a state through the URL unchanged', () => {
    const original = state({
      search: 'renewal',
      filters: { salesRep: ['A. Rep'], lifecycleStatus: ['Active', 'On Hold'] },
      openOnly: true,
      sortKey: 'name',
      sortDir: 'desc',
      viewMode: 'kanban',
      page: 4,
      limit: 100,
    });
    expect(parseListState(`?${serializeListState(original, CONFIG)}`, CONFIG)).toEqual(original);
  });
});
