import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  truncate,
  slugify,
  capitalizeFirst,
} from '@/lib/utils';

describe('cn (class merge)', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('lets later tailwind utilities win over earlier conflicting ones', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('formatCurrency', () => {
  it('formats USD with the dollar symbol and two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('honours an explicit currency code', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00');
  });

  it('formats zero and negatives', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(-50)).toBe('-$50.00');
  });
});

describe('formatDate', () => {
  it('renders a short, human date', () => {
    // Construct in local time to stay timezone-stable
    expect(formatDate(new Date(2026, 0, 15))).toBe('Jan 15, 2026');
  });
});

describe('formatRelativeTime', () => {
  it('says "just now" for very recent timestamps', () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 1000))).toBe('just now');
  });

  it('reports minutes, hours and days ago', () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000))).toBe('5m ago');
    expect(formatRelativeTime(new Date(Date.now() - 3 * 3600 * 1000))).toBe('3h ago');
    expect(formatRelativeTime(new Date(Date.now() - 2 * 86400 * 1000))).toBe('2d ago');
  });

  it('falls back to an absolute date beyond a week', () => {
    const result = formatRelativeTime(new Date(2020, 5, 1));
    expect(result).toBe('Jun 1, 2020');
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('cuts long strings and appends an ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });
});

describe('slugify', () => {
  it('lowercases, strips punctuation and hyphenates', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses spaces and underscores and trims stray hyphens', () => {
    expect(slugify('  Foo __ Bar  ')).toBe('foo-bar');
  });
});

describe('capitalizeFirst', () => {
  it('uppercases only the first character', () => {
    expect(capitalizeFirst('hello')).toBe('Hello');
    expect(capitalizeFirst('hELLO')).toBe('HELLO');
  });

  it('handles an empty string without throwing', () => {
    expect(capitalizeFirst('')).toBe('');
  });
});
