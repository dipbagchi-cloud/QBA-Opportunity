import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// ── Region → Currency mapping ─────────────────────────────────────
// When a region is created, these currencies are auto-added.
const REGION_CURRENCY_MAP: Record<string, { code: string; name: string; symbol: string }[]> = {
    "India": [
        { code: "INR", name: "Indian Rupee", symbol: "₹" },
    ],
    "North America": [
        { code: "USD", name: "US Dollar", symbol: "$" },
        { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
        { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
    ],
    "Europe": [
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
    "Asia Pacific": [
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
    "Middle East": [
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
    "Latin America": [
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
    "Africa": [
        { code: "ZAR", name: "South African Rand", symbol: "R" },
        { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
        { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
        { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
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
    "CIS / Central Asia": [
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
    "Caribbean": [
        { code: "BSD", name: "Bahamian Dollar", symbol: "B$" },
        { code: "BBD", name: "Barbadian Dollar", symbol: "Bds$" },
        { code: "BMD", name: "Bermudian Dollar", symbol: "BD$" },
        { code: "KYD", name: "Cayman Islands Dollar", symbol: "CI$" },
        { code: "HTG", name: "Haitian Gourde", symbol: "G" },
        { code: "XCD", name: "East Caribbean Dollar", symbol: "EC$" },
    ],
    "Oceania": [
        { code: "FJD", name: "Fijian Dollar", symbol: "FJ$" },
        { code: "PGK", name: "Papua New Guinean Kina", symbol: "K" },
        { code: "WST", name: "Samoan Tala", symbol: "WS$" },
        { code: "TOP", name: "Tongan Paʻanga", symbol: "T$" },
        { code: "VUV", name: "Vanuatu Vatu", symbol: "VT" },
        { code: "SBD", name: "Solomon Islands Dollar", symbol: "SI$" },
    ],
};

export { REGION_CURRENCY_MAP };

// ── List all currency rates ───────────────────────────────────────
export async function listCurrencyRates(req: Request, res: Response) {
    const rates = await prisma.currencyRate.findMany({
        orderBy: [{ region: "asc" }, { code: "asc" }],
    });
    res.json(rates);
}

// ── Sync rates from free exchange-rate API ────────────────────────
// Uses https://open.er-api.com (free, no API key required)
export async function syncCurrencyRates(req: Request, res: Response) {
    const baseCurrency = (req.query.base as string) || "INR";
    const apiUrl = `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`;

    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) {
        return res.status(502).json({ error: "Failed to fetch exchange rates from provider." });
    }
    const data = await apiRes.json() as { result: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) {
        return res.status(502).json({ error: "Invalid response from exchange rate provider." });
    }

    const rates: Record<string, number> = data.rates;
    const now = new Date();

    // Get all existing currencies in the DB
    const existing = await prisma.currencyRate.findMany({
        where: { baseCurrency },
    });

    let updated = 0;
    for (const curr of existing) {
        const apiRate = rates[curr.code];
        if (apiRate !== undefined) {
            await prisma.currencyRate.update({
                where: { id: curr.id },
                data: { rateToBase: apiRate, lastSynced: now },
            });
            updated++;
        }
    }

    // Audit log
    await prisma.auditLog.create({
        data: {
            entity: "CurrencyRate",
            entityId: "bulk-sync",
            action: "sync",
            changes: { base: baseCurrency, updatedCount: updated, source: "open.er-api.com" },
            userId: (req as any).user?.id,
        },
    });

    res.json({ synced: updated, baseCurrency, lastSynced: now });
}

// ── Seed currencies for a region (called when region is created) ──
export async function seedCurrenciesForRegion(regionName: string, baseCurrency = "INR") {
    const currencies = REGION_CURRENCY_MAP[regionName];
    if (!currencies || currencies.length === 0) return [];

    const results = [];
    for (const c of currencies) {
        const existing = await prisma.currencyRate.findFirst({
            where: { code: c.code, baseCurrency },
        });
        if (!existing) {
            const created = await prisma.currencyRate.create({
                data: {
                    code: c.code,
                    name: c.name,
                    symbol: c.symbol,
                    region: regionName,
                    rateToBase: 1, // placeholder until synced
                    baseCurrency,
                },
            });
            results.push(created);
        }
    }
    return results;
}

// ── Seed all default region currencies ────────────────────────────
export async function seedAllDefaultCurrencies(req: Request, res: Response) {
    const regions = await prisma.region.findMany();
    let totalAdded = 0;
    for (const region of regions) {
        const added = await seedCurrenciesForRegion(region.name);
        totalAdded += added.length;
    }
    res.json({ message: `Seeded ${totalAdded} new currency entries.` });
}

// ── Toggle active state ───────────────────────────────────────────
export async function toggleCurrencyRate(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.currencyRate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Currency rate not found." });

    const updated = await prisma.currencyRate.update({
        where: { id },
        data: { isActive: !existing.isActive },
    });
    res.json(updated);
}

// ── Manual rate update ────────────────────────────────────────────
export async function updateCurrencyRate(req: Request, res: Response) {
    const { id } = req.params;
    const { rateToBase } = req.body;
    if (rateToBase === undefined || typeof rateToBase !== "number" || rateToBase <= 0) {
        return res.status(400).json({ error: "rateToBase must be a positive number." });
    }
    const updated = await prisma.currencyRate.update({
        where: { id },
        data: { rateToBase },
    });
    res.json(updated);
}

// ── Add a single currency manually ───────────────────────────────
export async function addCurrencyRate(req: Request, res: Response) {
    const { code, name, symbol, region, rateToBase, baseCurrency } = req.body;
    if (!code || !name || !symbol || !region) {
        return res.status(400).json({ error: "code, name, symbol, and region are required." });
    }
    const base = baseCurrency || "INR";
    const existing = await prisma.currencyRate.findFirst({
        where: { code: code.toUpperCase(), baseCurrency: base },
    });
    if (existing) {
        return res.status(409).json({ error: `Currency ${code} already exists.` });
    }
    const created = await prisma.currencyRate.create({
        data: {
            code: code.toUpperCase(),
            name,
            symbol,
            region,
            rateToBase: rateToBase || 1,
            baseCurrency: base,
        },
    });
    res.json(created);
}

// ── Delete a currency ─────────────────────────────────────────────
export async function deleteCurrencyRate(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.currencyRate.delete({ where: { id } });
    res.json({ success: true });
}
