// ── Offline country reference data ──
// Country names are resolved from Node's built-in ICU data (Intl.DisplayNames) rather
// than a network lookup, so adding a country to a region never depends on a third-party
// API being reachable or on a particular API version staying alive.

// ISO 3166-1 alpha-2, officially assigned codes only. ICU also resolves withdrawn and
// aggregate codes (SU, YU, EU, UN, ZZ...), which must not be accepted as countries.
const ISO_ALPHA2 = [
    'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
    'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
    'BT', 'BV', 'BW', 'BY', 'BZ',
    'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW',
    'CX', 'CY', 'CZ',
    'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
    'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
    'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
    'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT',
    'GU', 'GW', 'GY',
    'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
    'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
    'JE', 'JM', 'JO', 'JP',
    'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
    'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
    'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS',
    'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
    'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
    'OM',
    'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
    'QA',
    'RE', 'RO', 'RS', 'RU', 'RW',
    'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
    'ST', 'SV', 'SX', 'SY', 'SZ',
    'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
    'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
    'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
    'WF', 'WS',
    'YE', 'YT',
    'ZA', 'ZM', 'ZW',
];

// Names this app has standardised on where they differ from ICU's CLDR spelling. Region
// rows and COUNTRY_CURRENCY are keyed on these, so ICU must not be allowed to rename them
// (CLDR renamed Turkey -> Türkiye and Czech Republic -> Czechia; pinning here keeps stored
// data stable across Node/ICU upgrades).
const PREFERRED_NAMES: Record<string, string> = {
    HK: 'Hong Kong',              // CLDR: Hong Kong SAR China
    MO: 'Macau',                  // CLDR: Macao SAR China
    MM: 'Myanmar',                // CLDR: Myanmar (Burma)
    CZ: 'Czech Republic',         // CLDR: Czechia
    TR: 'Turkey',                 // CLDR: Türkiye
    CI: 'Ivory Coast',            // CLDR: Côte d'Ivoire
    CD: 'Democratic Republic of the Congo',
    CG: 'Republic of the Congo',
    PS: 'Palestine',              // CLDR: Palestinian Territories
    FM: 'Micronesia',
    VA: 'Vatican City',
    SZ: 'Eswatini',
    TL: 'Timor-Leste',
    CV: 'Cape Verde',
    VC: 'Saint Vincent and the Grenadines', // CLDR drops the "the"
};

// CLDR writes "Antigua & Barbuda" / "St. Lucia"; this app (and its stored region rows) use
// the ISO English style "Antigua and Barbuda" / "Saint Lucia". Convert rather than enumerate.
function toAppStyle(cldrName: string): string {
    return cldrName
        .replace(/ & /g, ' and ')
        .replace(/\bSt\. /g, 'Saint ');
}

// Alternate spellings users type, mapped to the canonical name above.
const ALIASES: Record<string, string> = {
    'usa': 'United States',
    'u.s.a.': 'United States',
    'u.s.': 'United States',
    'america': 'United States',
    'united states of america': 'United States',
    'uk': 'United Kingdom',
    'great britain': 'United Kingdom',
    'britain': 'United Kingdom',
    'england': 'United Kingdom',
    'uae': 'United Arab Emirates',
    'u.a.e.': 'United Arab Emirates',
    'emirates': 'United Arab Emirates',
    'brunei darussalam': 'Brunei',
    'holland': 'Netherlands',
    'russian federation': 'Russia',
    'south korea': 'South Korea',
    'korea, south': 'South Korea',
    'republic of korea': 'South Korea',
    'korea, north': 'North Korea',
    'burma': 'Myanmar',
    'swaziland': 'Eswatini',
    'macedonia': 'North Macedonia',
    'east timor': 'Timor-Leste',
    'holy see': 'Vatican City',
    'vatican': 'Vatican City',
    'ivory coast': 'Ivory Coast',
    'cabo verde': 'Cape Verde',
    'drc': 'Democratic Republic of the Congo',
    'congo': 'Republic of the Congo',
    'laos': 'Laos',
    'vietnam': 'Vietnam',
    'viet nam': 'Vietnam',
};

// Country -> ISO 4217 currency. Consumed both by country validation (to auto-add currency
// rows) and by the country/region map endpoint.
export const COUNTRY_CURRENCY: Record<string, string> = {
    'United States': 'USD', 'Canada': 'CAD', 'Mexico': 'MXN',
    'United Kingdom': 'GBP', 'Switzerland': 'CHF', 'Sweden': 'SEK',
    'Norway': 'NOK', 'Denmark': 'DKK', 'Poland': 'PLN',
    'Czech Republic': 'CZK', 'Romania': 'RON', 'Hungary': 'HUF',
    'Iceland': 'ISK', 'Serbia': 'RSD', 'Ukraine': 'UAH', 'Turkey': 'TRY',
    'Croatia': 'HRK', 'Bulgaria': 'BGN',
    'Japan': 'JPY', 'China': 'CNY', 'South Korea': 'KRW',
    'Australia': 'AUD', 'New Zealand': 'NZD', 'Singapore': 'SGD',
    'Hong Kong': 'HKD', 'Taiwan': 'TWD', 'Indonesia': 'IDR',
    'Malaysia': 'MYR', 'Thailand': 'THB', 'Philippines': 'PHP',
    'Vietnam': 'VND', 'Bangladesh': 'BDT', 'Sri Lanka': 'LKR',
    'Pakistan': 'PKR', 'Myanmar': 'MMK', 'Cambodia': 'KHR', 'Nepal': 'NPR',
    'United Arab Emirates': 'AED', 'Saudi Arabia': 'SAR', 'Qatar': 'QAR',
    'Kuwait': 'KWD', 'Bahrain': 'BHD', 'Oman': 'OMR',
    'Jordan': 'JOD', 'Lebanon': 'LBP', 'Iraq': 'IQD', 'Israel': 'ILS',
    'Egypt': 'EGP',
    'Brazil': 'BRL', 'Argentina': 'ARS', 'Chile': 'CLP',
    'Colombia': 'COP', 'Peru': 'PEN', 'Uruguay': 'UYU',
    'Paraguay': 'PYG', 'Bolivia': 'BOB', 'Venezuela': 'VES',
    'Costa Rica': 'CRC', 'Panama': 'PAB', 'Dominican Republic': 'DOP',
    'Guatemala': 'GTQ', 'Honduras': 'HNL', 'Nicaragua': 'NIO',
    'Cuba': 'CUP', 'Jamaica': 'JMD', 'Trinidad and Tobago': 'TTD',
    'South Africa': 'ZAR', 'Nigeria': 'NGN', 'Kenya': 'KES',
    'Ghana': 'GHS', 'Ethiopia': 'ETB', 'Tanzania': 'TZS',
    'Morocco': 'MAD', 'Algeria': 'DZD', 'Tunisia': 'TND',
    'Uganda': 'UGX', 'Mozambique': 'MZN', 'Zambia': 'ZMW',
    'Botswana': 'BWP', 'Mauritius': 'MUR', 'Rwanda': 'RWF',
    'Angola': 'AOA', 'Namibia': 'NAD',
    'Russia': 'RUB', 'Kazakhstan': 'KZT', 'Uzbekistan': 'UZS',
    'Georgia': 'GEL', 'Armenia': 'AMD', 'Azerbaijan': 'AZN',
    'Belarus': 'BYN', 'Kyrgyzstan': 'KGS', 'Tajikistan': 'TJS',
    'Turkmenistan': 'TMT', 'Moldova': 'MDL',
    'India': 'INR',
    // EU countries use EUR
    'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR',
    'Netherlands': 'EUR', 'Belgium': 'EUR', 'Austria': 'EUR',
    'Finland': 'EUR', 'Ireland': 'EUR', 'Portugal': 'EUR',
    'Greece': 'EUR', 'Luxembourg': 'EUR', 'Slovakia': 'EUR',
    'Slovenia': 'EUR', 'Lithuania': 'EUR', 'Latvia': 'EUR', 'Estonia': 'EUR',
};

// Build a comparison key that ignores the ways one country gets written: accents
// ("Côte d'Ivoire" / "Cote d Ivoire"), "&" vs "and", "St." vs "Saint", a stray "the"
// ("St. Vincent & Grenadines" / "Saint Vincent and the Grenadines"), case and punctuation.
function normalize(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .map(t => (t === 'st' ? 'saint' : t))
        .filter(t => t && t !== 'and' && t !== 'the')
        .join(' ');
}

// normalized name -> canonical name, built once at module load.
const CANONICAL_BY_NAME: Map<string, string> = (() => {
    const map = new Map<string, string>();
    const display = new Intl.DisplayNames(['en'], { type: 'region' });

    for (const code of ISO_ALPHA2) {
        let cldrName: string | undefined;
        try {
            cldrName = display.of(code);
        } catch {
            cldrName = undefined;
        }
        const canonical = PREFERRED_NAMES[code] || (cldrName && toAppStyle(cldrName));
        if (!canonical) continue;

        map.set(normalize(canonical), canonical);
        // Accept the CLDR spelling as input too, but resolve it to the pinned name.
        if (cldrName) map.set(normalize(cldrName), canonical);
    }

    for (const [alias, canonical] of Object.entries(ALIASES)) {
        map.set(normalize(alias), canonical);
    }
    return map;
})();

/** Resolve a user-typed country name to its canonical spelling, or null if unrecognised. */
export function resolveCountryName(input: string): string | null {
    return CANONICAL_BY_NAME.get(normalize(input)) || null;
}

/** Currency for a canonical country name, with display name/symbol from ICU. */
export function getCurrencyForCountry(
    canonicalCountry: string
): { code: string; name: string; symbol: string } | null {
    const code = COUNTRY_CURRENCY[canonicalCountry];
    if (!code) return null;

    let name = code;
    try {
        name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || code;
    } catch {
        // fall back to the code
    }

    let symbol = code;
    try {
        const part = new Intl.NumberFormat('en', { style: 'currency', currency: code })
            .formatToParts(0)
            .find(p => p.type === 'currency');
        if (part) symbol = part.value;
    } catch {
        // fall back to the code
    }

    return { code, name, symbol };
}
