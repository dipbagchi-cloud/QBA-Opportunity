/**
 * The one experience-band ladder, shared by QCRM rate cards, the HR associate
 * workbook and the Q-People matcher.
 *
 * Lower bound inclusive, upper bound exclusive — so 4.17 years is "4 - 6 Years",
 * and a boundary value like exactly 4.0 lands in 4-6 rather than ambiguously in
 * both 2-4 and 4-6.
 *
 * This lives on its own because the same normalisation is needed in two very
 * different places: matching employees to resource rows, and lining up an old
 * rate card against a new one when their bands are spelled differently
 * ("00-02" in the April 2026 import vs "0 - 2 Years" in August 2026).
 */
export const EXPERIENCE_BANDS = [
  { key: '0-2', label: '0 - 2 Years', min: 0, max: 2 },
  { key: '2-4', label: '2 - 4 Years', min: 2, max: 4 },
  { key: '4-6', label: '4 - 6 Years', min: 4, max: 6 },
  { key: '6-8', label: '6 - 8 Years', min: 6, max: 8 },
  { key: '8-12', label: '8 - 12 Years', min: 8, max: 12 },
  { key: '12-15', label: '12 - 15 Years', min: 12, max: 15 },
  { key: '15+', label: '15+ Years', min: 15, max: Infinity },
] as const;

export type ExperienceBandKey = (typeof EXPERIENCE_BANDS)[number]['key'];

/**
 * Reduce any spelling of a band to its canonical key. In circulation today:
 * "00-02" and "0 - 2 Years"; "12-15" and "12 - 15 Years"; ">15" and
 * "15+ Years"; and the cost card's sort-coded "08) 0 - 2 Years".
 */
export function canonicalBandKey(band?: string | null): ExperienceBandKey | null {
  if (!band) return null;
  // Drop a leading sort code such as "02) " used by the cost card workbook.
  const b = band.trim().replace(/^\d+\)\s*/, '').toLowerCase();
  if (b.startsWith('>') || /^\s*15\s*\+/.test(b)) return '15+';
  const m = b.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    const exactHit = EXPERIENCE_BANDS.find((x) => x.min === lo && x.max === hi);
    if (exactHit) return exactHit.key;
    // Tolerate a band written slightly off the ladder by matching its lower
    // bound, which is what actually distinguishes the bands from each other.
    const byLow = EXPERIENCE_BANDS.find((x) => x.min === lo);
    return byLow ? byLow.key : null;
  }
  const single = b.match(/^(\d+)/);
  if (single) {
    const byLow = EXPERIENCE_BANDS.find((x) => x.min === Number(single[1]));
    return byLow ? byLow.key : null;
  }
  return null;
}

/**
 * Place a fractional year count on the ladder: 4.17 -> "4-6", 9.67 -> "8-12",
 * 22.42 -> "15+". This is what makes a decimal experience figure comparable to
 * the banded requirement on a resource row.
 */
export function bandForYears(years?: number | null): ExperienceBandKey | null {
  if (years === null || years === undefined || !Number.isFinite(years)) return null;
  const hit = EXPERIENCE_BANDS.find((b) => years >= b.min && years < b.max);
  return hit ? hit.key : '15+';
}

/** Human label for a canonical key. */
export function bandLabel(key?: ExperienceBandKey | null): string | null {
  if (!key) return null;
  return EXPERIENCE_BANDS.find((b) => b.key === key)?.label ?? null;
}

/** Sort helper — orders bands by seniority rather than alphabetically. */
export function bandOrder(key?: ExperienceBandKey | null): number {
  if (!key) return 99;
  const i = EXPERIENCE_BANDS.findIndex((b) => b.key === key);
  return i < 0 ? 99 : i;
}
