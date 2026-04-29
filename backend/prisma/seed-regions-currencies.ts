/**
 * Seed script: Populate all regions with comprehensive country lists and auto-add currency rates.
 * Run: npx ts-node prisma/seed-regions-currencies.ts
 * 
 * Safe to run multiple times — uses upsert logic:
 *   - Regions: creates if not exists, updates countries if exists
 *   - Currencies: creates if not exists (skips duplicates)
 *   - Exchange rates: syncs live rates from open.er-api.com at the end
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE REGION → COUNTRY → CURRENCY MAPPING
// ────────────────────────────────────────────────────────────────────────────

interface CurrencyInfo {
    code: string;
    name: string;
    symbol: string;
}

interface RegionData {
    name: string;
    countries: string[];
    currencies: CurrencyInfo[];
}

const REGIONS: RegionData[] = [
    {
        name: "India",
        countries: [
            "India",
        ],
        currencies: [
            { code: "INR", name: "Indian Rupee", symbol: "₹" },
        ],
    },
    {
        name: "North America",
        countries: [
            "United States", "Canada", "Mexico",
        ],
        currencies: [
            { code: "USD", name: "US Dollar", symbol: "$" },
            { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
            { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
        ],
    },
    {
        name: "Europe",
        countries: [
            "United Kingdom", "Germany", "France", "Italy", "Spain",
            "Netherlands", "Belgium", "Austria", "Switzerland", "Sweden",
            "Norway", "Denmark", "Finland", "Ireland", "Portugal",
            "Poland", "Czech Republic", "Romania", "Hungary", "Greece",
            "Luxembourg", "Bulgaria", "Croatia", "Slovakia", "Slovenia",
            "Lithuania", "Latvia", "Estonia", "Iceland", "Serbia",
            "Ukraine", "Turkey",
        ],
        currencies: [
            { code: "EUR", name: "Euro", symbol: "€" },
            { code: "GBP", name: "British Pound", symbol: "£" },
            { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
            { code: "SEK", name: "Swedish Krona", symbol: "kr" },
            { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
            { code: "DKK", name: "Danish Krone", symbol: "kr" },
            { code: "PLN", name: "Polish Zloty", symbol: "zł" },
            { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
            { code: "RON", name: "Romanian Leu", symbol: "lei" },
            { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
            { code: "ISK", name: "Icelandic Króna", symbol: "kr" },
            { code: "RSD", name: "Serbian Dinar", symbol: "din" },
            { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴" },
            { code: "TRY", name: "Turkish Lira", symbol: "₺" },
            { code: "HRK", name: "Croatian Kuna", symbol: "kn" },
            { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
        ],
    },
    {
        name: "Asia Pacific",
        countries: [
            "China", "Japan", "South Korea", "Singapore", "Australia",
            "New Zealand", "Hong Kong", "Taiwan", "Indonesia", "Malaysia",
            "Thailand", "Philippines", "Vietnam", "Bangladesh", "Sri Lanka",
            "Pakistan", "Myanmar", "Cambodia", "Nepal",
        ],
        currencies: [
            { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
            { code: "JPY", name: "Japanese Yen", symbol: "¥" },
            { code: "KRW", name: "South Korean Won", symbol: "₩" },
            { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
            { code: "AUD", name: "Australian Dollar", symbol: "A$" },
            { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
            { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
            { code: "TWD", name: "Taiwan Dollar", symbol: "NT$" },
            { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
            { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
            { code: "THB", name: "Thai Baht", symbol: "฿" },
            { code: "PHP", name: "Philippine Peso", symbol: "₱" },
            { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
            { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
            { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
            { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
            { code: "MMK", name: "Myanmar Kyat", symbol: "K" },
            { code: "KHR", name: "Cambodian Riel", symbol: "៛" },
            { code: "NPR", name: "Nepalese Rupee", symbol: "Rs" },
        ],
    },
    {
        name: "Middle East",
        countries: [
            "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait",
            "Bahrain", "Oman", "Jordan", "Lebanon", "Iraq", "Israel",
            "Egypt",
        ],
        currencies: [
            { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
            { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
            { code: "QAR", name: "Qatari Riyal", symbol: "﷼" },
            { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
            { code: "BHD", name: "Bahraini Dinar", symbol: "BD" },
            { code: "OMR", name: "Omani Rial", symbol: "﷼" },
            { code: "JOD", name: "Jordanian Dinar", symbol: "JD" },
            { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل" },
            { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د" },
            { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
            { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
        ],
    },
    {
        name: "Latin America",
        countries: [
            "Brazil", "Argentina", "Chile", "Colombia", "Peru",
            "Ecuador", "Uruguay", "Paraguay", "Bolivia", "Venezuela",
            "Costa Rica", "Panama", "Dominican Republic", "Guatemala",
            "Honduras", "El Salvador", "Nicaragua", "Cuba", "Jamaica",
            "Trinidad and Tobago",
        ],
        currencies: [
            { code: "BRL", name: "Brazilian Real", symbol: "R$" },
            { code: "ARS", name: "Argentine Peso", symbol: "$" },
            { code: "CLP", name: "Chilean Peso", symbol: "$" },
            { code: "COP", name: "Colombian Peso", symbol: "$" },
            { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
            { code: "UYU", name: "Uruguayan Peso", symbol: "$U" },
            { code: "PYG", name: "Paraguayan Guarani", symbol: "₲" },
            { code: "BOB", name: "Bolivian Boliviano", symbol: "Bs" },
            { code: "VES", name: "Venezuelan Bolívar", symbol: "Bs.S" },
            { code: "CRC", name: "Costa Rican Colón", symbol: "₡" },
            { code: "PAB", name: "Panamanian Balboa", symbol: "B/." },
            { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
            { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q" },
            { code: "HNL", name: "Honduran Lempira", symbol: "L" },
            { code: "NIO", name: "Nicaraguan Córdoba", symbol: "C$" },
            { code: "CUP", name: "Cuban Peso", symbol: "$" },
            { code: "JMD", name: "Jamaican Dollar", symbol: "J$" },
            { code: "TTD", name: "Trinidad Dollar", symbol: "TT$" },
        ],
    },
    {
        name: "Africa",
        countries: [
            "South Africa", "Nigeria", "Kenya", "Egypt", "Ghana",
            "Ethiopia", "Tanzania", "Morocco", "Algeria", "Tunisia",
            "Uganda", "Mozambique", "Zambia", "Zimbabwe", "Botswana",
            "Mauritius", "Rwanda", "Senegal", "Ivory Coast", "Cameroon",
            "Angola", "Namibia",
        ],
        currencies: [
            { code: "ZAR", name: "South African Rand", symbol: "R" },
            { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
            { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
            { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
            { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
            { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
            { code: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
            { code: "DZD", name: "Algerian Dinar", symbol: "د.ج" },
            { code: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
            { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
            { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
            { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
            { code: "BWP", name: "Botswana Pula", symbol: "P" },
            { code: "MUR", name: "Mauritian Rupee", symbol: "₨" },
            { code: "RWF", name: "Rwandan Franc", symbol: "FRw" },
            { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
            { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
            { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
            { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
        ],
    },
    {
        name: "CIS / Central Asia",
        countries: [
            "Russia", "Kazakhstan", "Uzbekistan", "Georgia", "Armenia",
            "Azerbaijan", "Belarus", "Kyrgyzstan", "Tajikistan", "Turkmenistan",
            "Moldova",
        ],
        currencies: [
            { code: "RUB", name: "Russian Ruble", symbol: "₽" },
            { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
            { code: "UZS", name: "Uzbekistani Som", symbol: "сўм" },
            { code: "GEL", name: "Georgian Lari", symbol: "₾" },
            { code: "AMD", name: "Armenian Dram", symbol: "֏" },
            { code: "AZN", name: "Azerbaijani Manat", symbol: "₼" },
            { code: "BYN", name: "Belarusian Ruble", symbol: "Br" },
            { code: "KGS", name: "Kyrgystani Som", symbol: "сом" },
            { code: "TJS", name: "Tajikistani Somoni", symbol: "SM" },
            { code: "TMT", name: "Turkmenistani Manat", symbol: "T" },
            { code: "MDL", name: "Moldovan Leu", symbol: "L" },
        ],
    },
    {
        name: "Caribbean",
        countries: [
            "Bahamas", "Barbados", "Bermuda", "Cayman Islands", "Haiti",
            "Puerto Rico", "Antigua and Barbuda", "Saint Lucia",
            "Saint Kitts and Nevis", "Grenada", "Dominica",
            "Saint Vincent and the Grenadines", "Turks and Caicos Islands",
        ],
        currencies: [
            { code: "BSD", name: "Bahamian Dollar", symbol: "B$" },
            { code: "BBD", name: "Barbadian Dollar", symbol: "Bds$" },
            { code: "BMD", name: "Bermudian Dollar", symbol: "BD$" },
            { code: "KYD", name: "Cayman Islands Dollar", symbol: "CI$" },
            { code: "HTG", name: "Haitian Gourde", symbol: "G" },
            { code: "XCD", name: "East Caribbean Dollar", symbol: "EC$" },
        ],
    },
    {
        name: "Oceania",
        countries: [
            "Fiji", "Papua New Guinea", "Samoa", "Tonga", "Vanuatu",
            "Solomon Islands",
        ],
        currencies: [
            { code: "FJD", name: "Fijian Dollar", symbol: "FJ$" },
            { code: "PGK", name: "Papua New Guinean Kina", symbol: "K" },
            { code: "WST", name: "Samoan Tala", symbol: "WS$" },
            { code: "TOP", name: "Tongan Paʻanga", symbol: "T$" },
            { code: "VUV", name: "Vanuatu Vatu", symbol: "VT" },
            { code: "SBD", name: "Solomon Islands Dollar", symbol: "SI$" },
        ],
    },
];

// ────────────────────────────────────────────────────────────────────────────
// SEED LOGIC
// ────────────────────────────────────────────────────────────────────────────

async function seedRegionsAndCurrencies() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  SEED: Regions, Countries & Currency Rates");
    console.log("═══════════════════════════════════════════════════════════\n");

    let regionsCreated = 0;
    let regionsUpdated = 0;
    let currenciesCreated = 0;
    let currenciesSkipped = 0;

    for (const regionData of REGIONS) {
        const countriesStr = regionData.countries.join(", ");

        // Check if region exists
        const existing = await prisma.region.findFirst({
            where: { name: regionData.name },
        });

        if (existing) {
            // Merge countries: keep existing + add new
            const existingCountries = new Set(
                (existing.countries || "").split(",").map(s => s.trim()).filter(Boolean)
            );
            let hasNew = false;
            for (const c of regionData.countries) {
                if (!existingCountries.has(c)) {
                    existingCountries.add(c);
                    hasNew = true;
                }
            }

            if (hasNew || !existing.isActive) {
                const mergedCountries = [...existingCountries].sort().join(", ");
                await prisma.region.update({
                    where: { id: existing.id },
                    data: { countries: mergedCountries, isActive: true },
                });
                console.log(`✏️  Updated region: ${regionData.name} (${existingCountries.size} countries)`);
                regionsUpdated++;
            } else {
                console.log(`✅ Region exists: ${regionData.name} (${existingCountries.size} countries)`);
            }
        } else {
            await prisma.region.create({
                data: {
                    name: regionData.name,
                    countries: countriesStr,
                    isActive: true,
                },
            });
            console.log(`🆕 Created region: ${regionData.name} (${regionData.countries.length} countries)`);
            regionsCreated++;
        }

        // Seed currencies for this region
        for (const curr of regionData.currencies) {
            const existingCurrency = await prisma.currencyRate.findFirst({
                where: { code: curr.code, baseCurrency: "INR" },
            });

            if (!existingCurrency) {
                await prisma.currencyRate.create({
                    data: {
                        code: curr.code,
                        name: curr.name,
                        symbol: curr.symbol,
                        region: regionData.name,
                        rateToBase: 1, // placeholder
                        baseCurrency: "INR",
                        isActive: true,
                    },
                });
                console.log(`   💱 Added currency: ${curr.code} (${curr.name})`);
                currenciesCreated++;
            } else {
                currenciesSkipped++;
            }
        }
    }

    console.log("\n───────────────────────────────────────────────────────────");
    console.log(`  Regions: ${regionsCreated} created, ${regionsUpdated} updated`);
    console.log(`  Currencies: ${currenciesCreated} created, ${currenciesSkipped} already existed`);
    console.log("───────────────────────────────────────────────────────────\n");

    // ── Sync live exchange rates ──
    console.log("🌐 Fetching live exchange rates from open.er-api.com ...");
    try {
        const apiRes = await fetch("https://open.er-api.com/v6/latest/INR");
        const apiData = await apiRes.json() as { result: string; rates?: Record<string, number> };

        if (apiData.result === "success" && apiData.rates) {
            const allCurrencies = await prisma.currencyRate.findMany({
                where: { baseCurrency: "INR" },
            });

            let synced = 0;
            const now = new Date();
            for (const curr of allCurrencies) {
                const rate = apiData.rates[curr.code];
                if (rate !== undefined) {
                    await prisma.currencyRate.update({
                        where: { id: curr.id },
                        data: { rateToBase: rate, lastSynced: now },
                    });
                    synced++;
                }
            }
            console.log(`✅ Synced live rates for ${synced} currencies.\n`);
        } else {
            console.log("⚠️  Exchange rate API returned invalid data. Rates left as placeholders.\n");
        }
    } catch (err) {
        console.log("⚠️  Failed to fetch live rates. Rates left as placeholders (run 'Sync Live Rates' from the admin UI later).\n");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("  SEED COMPLETE ✓");
    console.log("═══════════════════════════════════════════════════════════\n");
}

seedRegionsAndCurrencies()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
