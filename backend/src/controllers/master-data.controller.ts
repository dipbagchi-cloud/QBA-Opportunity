import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { seedCurrenciesForRegion } from './currency.controller';

// ── Country validation via REST Countries API ──
interface CountryValidationResult {
    input: string;
    valid: boolean;
    correctedName?: string;
    currencies?: { code: string; name: string; symbol: string }[];
}

export async function validateCountries(req: Request, res: Response) {
    const { countries } = req.body; // array of country name strings
    if (!Array.isArray(countries) || countries.length === 0) {
        res.status(400).json({ error: 'countries must be a non-empty array of strings.' });
        return;
    }

    const results: CountryValidationResult[] = [];

    for (const raw of countries) {
        const name = (raw as string).trim();
        if (!name) continue;
        try {
            const apiRes = await fetch(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,currencies`
            );
            if (!apiRes.ok) {
                results.push({ input: name, valid: false });
                continue;
            }
            const data = await apiRes.json() as any[];
            if (!data || data.length === 0) {
                results.push({ input: name, valid: false });
                continue;
            }
            // Find best match: exact match on common name, or first result
            const exact = data.find(
                (c: any) => c.name?.common?.toLowerCase() === name.toLowerCase()
                    || c.name?.official?.toLowerCase() === name.toLowerCase()
            );
            const match = exact || data[0];
            const correctedName = match.name?.common || name;
            const currencies: { code: string; name: string; symbol: string }[] = [];
            if (match.currencies) {
                for (const [code, info] of Object.entries(match.currencies) as [string, any][]) {
                    currencies.push({ code, name: info.name || code, symbol: info.symbol || code });
                }
            }
            results.push({ input: name, valid: true, correctedName, currencies });
        } catch {
            results.push({ input: name, valid: false });
        }
    }

    res.json(results);
}

// ── Auto-add currencies for newly added countries in a region ──
async function autoAddCurrenciesForCountries(
    regionName: string,
    countryValidations: CountryValidationResult[]
) {
    const added: string[] = [];
    for (const cv of countryValidations) {
        if (!cv.valid || !cv.currencies) continue;
        for (const curr of cv.currencies) {
            const existing = await prisma.currencyRate.findFirst({
                where: { code: curr.code, baseCurrency: 'INR' },
            });
            if (!existing) {
                await prisma.currencyRate.create({
                    data: {
                        code: curr.code,
                        name: curr.name,
                        symbol: curr.symbol,
                        region: regionName,
                        rateToBase: 1, // placeholder until synced
                        baseCurrency: 'INR',
                    },
                });
                added.push(curr.code);
            }
        }
    }
    return added;
}

// ── Auto-add currencies from pre-validated data (sent by frontend) ──
async function autoAddCurrenciesFromData(
    regionName: string,
    currencyData: { code: string; name: string; symbol: string }[]
) {
    const added: string[] = [];
    for (const curr of currencyData) {
        if (!curr.code) continue;
        const existing = await prisma.currencyRate.findFirst({
            where: { code: curr.code, baseCurrency: 'INR' },
        });
        if (!existing) {
            await prisma.currencyRate.create({
                data: {
                    code: curr.code,
                    name: curr.name || curr.code,
                    symbol: curr.symbol || curr.code,
                    region: regionName,
                    rateToBase: 1,
                    baseCurrency: 'INR',
                },
            });
            added.push(curr.code);
        }
    }
    return added;
}

// ── Server-side: fetch currencies from REST Countries API for country names ──
// This is called as a fallback when the frontend doesn't provide currencyData,
// ensuring currencies are always auto-added when countries are saved.
async function fetchAndAddCurrenciesForCountries(
    regionName: string,
    countryNames: string[]
): Promise<string[]> {
    const added: string[] = [];
    for (const countryName of countryNames) {
        if (!countryName.trim()) continue;
        try {
            const apiRes = await fetch(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName.trim())}?fields=name,currencies`
            );
            if (!apiRes.ok) continue;
            const data = await apiRes.json() as any[];
            if (!data || data.length === 0) continue;

            // Find best match
            const exact = data.find(
                (c: any) => c.name?.common?.toLowerCase() === countryName.trim().toLowerCase()
                    || c.name?.official?.toLowerCase() === countryName.trim().toLowerCase()
            );
            const match = exact || data[0];

            if (match.currencies) {
                for (const [code, info] of Object.entries(match.currencies) as [string, any][]) {
                    const existing = await prisma.currencyRate.findFirst({
                        where: { code, baseCurrency: 'INR' },
                    });
                    if (!existing) {
                        await prisma.currencyRate.create({
                            data: {
                                code,
                                name: info.name || code,
                                symbol: info.symbol || code,
                                region: regionName,
                                rateToBase: 1,
                                baseCurrency: 'INR',
                            },
                        });
                        added.push(code);
                    }
                }
            }
        } catch {
            // Non-critical: skip this country if API fails
            console.log(`[currency-auto-add] Failed to fetch currency for country: ${countryName}`);
        }
    }
    return added;
}

// Helper: write audit log for admin master data changes
async function auditMasterData(entity: string, entityId: string, action: string, userId: string, changes: any) {
    await prisma.auditLog.create({
        data: { entity, entityId, action, userId, changes },
    });
}

// ── Clients ──
export async function listClients(req: Request, res: Response) {
    const clients = await prisma.client.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, domain: true, industry: true, country: true, contactPerson: true, address: true, isActive: true },
    });
    res.json(clients);
}

export async function listAllClients(req: Request, res: Response) {
    const clients = await prisma.client.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, domain: true, industry: true, country: true, contactPerson: true, address: true, isActive: true, createdAt: true },
    });
    res.json(clients);
}

export async function createClient(req: Request, res: Response) {
    const { name, domain, industry, country, contactPerson, address } = req.body;
    if (!name) { res.status(400).json({ error: 'Client name is required.' }); return; }
    const existing = await prisma.client.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Client "${name}" already exists.` }); return; }
    const client = await prisma.client.create({ data: { name, domain, industry, country, contactPerson, address } });
    await auditMasterData('Client', client.id, 'CREATE', req.user!.userId, `Created client: ${name}`);
    res.status(201).json(client);
}

export async function updateClient(req: Request, res: Response) {
    const { id } = req.params;
    const { name, domain, industry, country, contactPerson, address, isActive } = req.body;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Client not found.' }); return; }

    // If only toggling isActive, do a simple update
    if (isActive !== undefined && !name && !domain && !industry && !country && contactPerson === undefined && address === undefined) {
        const client = await prisma.client.update({ where: { id }, data: { isActive } });
        await auditMasterData('Client', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} client: ${existing.name}`);
        res.json(client);
        return;
    }

    // Soft-version: deactivate old, create new
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    const newClient = await prisma.client.create({
        data: {
            name: name ?? existing.name,
            domain: domain ?? existing.domain,
            industry: industry ?? existing.industry,
            country: country ?? existing.country,
            contactPerson: contactPerson ?? existing.contactPerson,
            address: address ?? existing.address,
        },
    });
    const changes: string[] = [];
    if (name && name !== existing.name) changes.push(`Name: "${existing.name}" → "${name}"`);
    if (domain !== undefined && domain !== existing.domain) changes.push(`Domain updated`);
    if (industry !== undefined && industry !== existing.industry) changes.push(`Industry updated`);
    if (country !== undefined && country !== existing.country) changes.push(`Country updated`);
    await auditMasterData('Client', newClient.id, 'UPDATE', req.user!.userId, `Updated client (versioned): ${changes.join('; ') || 'No field changes'}`);
    res.json(newClient);
}

export async function deleteClient(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Client not found.' }); return; }
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('Client', id, 'DELETE', req.user!.userId, `Deactivated client: ${existing.name}`);
    res.json({ message: 'Client deactivated.' });
}

// ── Regions ──
export async function listRegions(req: Request, res: Response) {
    const regions = await prisma.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(regions);
}

export async function getCountryRegionMap(req: Request, res: Response) {
    const regions = await prisma.region.findMany({ where: { isActive: true }, select: { name: true, countries: true } });
    // Also fetch currency rates to map region → primary currency
    const currencyRates = await prisma.currencyRate.findMany({
        where: { isActive: true, baseCurrency: 'INR' },
        select: { code: true, region: true },
        orderBy: { code: 'asc' },
    });
    // Build region → primary currency map (first currency alphabetically for each region)
    const regionCurrencyMap: Record<string, string> = {};
    for (const cr of currencyRates) {
        if (cr.region && !regionCurrencyMap[cr.region]) {
            regionCurrencyMap[cr.region] = cr.code;
        }
    }
    // Special overrides: use the most common/primary currency for well-known regions
    const REGION_PRIMARY_CURRENCY: Record<string, string> = {
        'India': 'INR',
        'North America': 'USD',
        'Europe': 'GBP',
        'Asia Pacific': 'SGD',
        'Middle East': 'AED',
        'Latin America': 'BRL',
        'Africa': 'ZAR',
        'CIS / Central Asia': 'RUB',
        'Caribbean': 'USD',
        'Oceania': 'AUD',
    };
    for (const [region, code] of Object.entries(REGION_PRIMARY_CURRENCY)) {
        regionCurrencyMap[region] = code;
    }
    // Also create a country-specific currency override map
    const COUNTRY_CURRENCY_OVERRIDE: Record<string, string> = {
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
    const map: Record<string, { region: string; currency: string }> = {};
    for (const r of regions) {
        if (r.countries) {
            for (const c of r.countries.split(',').map(s => s.trim()).filter(Boolean)) {
                map[c] = {
                    region: r.name,
                    currency: COUNTRY_CURRENCY_OVERRIDE[c] || regionCurrencyMap[r.name] || 'INR',
                };
            }
        }
    }
    res.json(map);
}

export async function listAllRegions(req: Request, res: Response) {
    const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } });
    res.json(regions);
}

export async function createRegion(req: Request, res: Response) {
    const { name, countries, currencyData } = req.body;
    if (!name) { res.status(400).json({ error: 'Region name is required.' }); return; }
    const existing = await prisma.region.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Region "${name}" already exists.` }); return; }
    const region = await prisma.region.create({ data: { name, countries: countries || null } });
    await seedCurrenciesForRegion(name).catch(() => { /* non-critical */ });

    // Auto-add currencies: prefer frontend-validated data, fallback to server-side fetch
    let addedCurrencies: string[] = [];
    if (currencyData && Array.isArray(currencyData) && currencyData.length > 0) {
        addedCurrencies = await autoAddCurrenciesFromData(name, currencyData).catch(() => []) || [];
    } else if (countries) {
        // Fallback: server-side fetch currencies for all countries
        const countryList = countries.split(',').map((s: string) => s.trim()).filter(Boolean);
        addedCurrencies = await fetchAndAddCurrenciesForCountries(name, countryList).catch(() => []) || [];
    }

    await auditMasterData('Region', region.id, 'CREATE', req.user!.userId, `Created region: ${name}${addedCurrencies.length > 0 ? `. Auto-added currencies: ${addedCurrencies.join(', ')}` : ''}`);
    res.status(201).json({ ...region, addedCurrencies });
}

export async function updateRegion(req: Request, res: Response) {
    const { id } = req.params;
    const { name, countries, isActive, currencyData } = req.body;
    // currencyData: optional array of { code, name, symbol } from frontend validation
    const existing = await prisma.region.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Region not found.' }); return; }

    // If only toggling isActive, do a simple update
    if (isActive !== undefined && !name && countries === undefined) {
        const region = await prisma.region.update({ where: { id }, data: { isActive } });
        await auditMasterData('Region', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} region: ${existing.name}`);
        res.json(region);
        return;
    }

    // Determine which countries are new (not in existing region)
    const getNewCountryNames = (newCountries: string | undefined): string[] => {
        if (!newCountries) return [];
        const newList = newCountries.split(',').map(s => s.trim()).filter(Boolean);
        const existingSet = new Set(
            ((existing as any).countries || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
        );
        return newList.filter(c => !existingSet.has(c.toLowerCase()));
    };

    // If only updating countries (no name change), do in-place update
    if (countries !== undefined && (!name || name === existing.name)) {
        const region = await prisma.region.update({ where: { id }, data: { countries } });
        const regionName = existing.name;

        // Auto-add currencies: prefer frontend data, fallback to server-side fetch for new countries
        let addedCurrencies: string[] = [];
        if (currencyData && Array.isArray(currencyData) && currencyData.length > 0) {
            addedCurrencies = await autoAddCurrenciesFromData(regionName, currencyData).catch(() => []) || [];
        } else {
            const newCountries = getNewCountryNames(countries);
            if (newCountries.length > 0) {
                addedCurrencies = await fetchAndAddCurrenciesForCountries(regionName, newCountries).catch(() => []) || [];
            }
        }

        await auditMasterData('Region', id, 'UPDATE', req.user!.userId, `Updated countries for region: ${existing.name}${addedCurrencies.length > 0 ? `. Auto-added currencies: ${addedCurrencies.join(', ')}` : ''}`);
        res.json({ ...region, addedCurrencies });
        return;
    }

    // Soft-version: deactivate old, create new
    await prisma.region.update({ where: { id }, data: { isActive: false } });
    const finalCountries = countries ?? (existing as any).countries;
    const newRegion = await prisma.region.create({ data: { name: name ?? existing.name, countries: finalCountries } });
    const regionName = name ?? existing.name;

    // Auto-add currencies: prefer frontend data, fallback to server-side fetch
    let addedCurrencies: string[] = [];
    if (currencyData && Array.isArray(currencyData) && currencyData.length > 0) {
        addedCurrencies = await autoAddCurrenciesFromData(regionName, currencyData).catch(() => []) || [];
    } else {
        const newCountries = getNewCountryNames(finalCountries);
        if (newCountries.length > 0) {
            addedCurrencies = await fetchAndAddCurrenciesForCountries(regionName, newCountries).catch(() => []) || [];
        }
    }

    await auditMasterData('Region', newRegion.id, 'UPDATE', req.user!.userId, `Updated region (versioned): "${existing.name}" → "${regionName}"${addedCurrencies.length > 0 ? `. Auto-added currencies: ${addedCurrencies.join(', ')}` : ''}`);
    res.json({ ...newRegion, addedCurrencies });
}

export async function deleteRegion(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.region.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Region not found.' }); return; }
    await prisma.region.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('Region', id, 'DELETE', req.user!.userId, `Deactivated region: ${existing.name}`);
    res.json({ message: 'Region deactivated.' });
}

// ── Technologies ──
export async function listTechnologies(req: Request, res: Response) {
    const techs = await prisma.technology.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(techs);
}

export async function listAllTechnologies(req: Request, res: Response) {
    const techs = await prisma.technology.findMany({ orderBy: { name: 'asc' } });
    res.json(techs);
}

export async function createTechnology(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Technology name is required.' }); return; }
    const existing = await prisma.technology.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Technology "${name}" already exists.` }); return; }
    const tech = await prisma.technology.create({ data: { name } });
    await auditMasterData('Technology', tech.id, 'CREATE', req.user!.userId, `Created technology: ${name}`);
    res.status(201).json(tech);
}

export async function updateTechnology(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.technology.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Technology not found.' }); return; }

    if (isActive !== undefined && !name) {
        const tech = await prisma.technology.update({ where: { id }, data: { isActive } });
        await auditMasterData('Technology', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} technology: ${existing.name}`);
        res.json(tech);
        return;
    }

    // Soft-version: deactivate old, create new
    await prisma.technology.update({ where: { id }, data: { isActive: false } });
    const newTech = await prisma.technology.create({ data: { name: name ?? existing.name } });
    await auditMasterData('Technology', newTech.id, 'UPDATE', req.user!.userId, `Updated technology (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newTech);
}

export async function deleteTechnology(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.technology.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Technology not found.' }); return; }
    await prisma.technology.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('Technology', id, 'DELETE', req.user!.userId, `Deactivated technology: ${existing.name}`);
    res.json({ message: 'Technology deactivated.' });
}

// ── Pricing Models ──
export async function listPricingModels(req: Request, res: Response) {
    const models = await prisma.pricingModel.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(models);
}

export async function listAllPricingModels(req: Request, res: Response) {
    const models = await prisma.pricingModel.findMany({ orderBy: { name: 'asc' } });
    res.json(models);
}

export async function createPricingModel(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Pricing model name is required.' }); return; }
    const existing = await prisma.pricingModel.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Pricing model "${name}" already exists.` }); return; }
    const model = await prisma.pricingModel.create({ data: { name } });
    await auditMasterData('PricingModel', model.id, 'CREATE', req.user!.userId, `Created pricing model: ${name}`);
    res.status(201).json(model);
}

export async function updatePricingModel(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.pricingModel.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Pricing model not found.' }); return; }

    if (isActive !== undefined && !name) {
        const model = await prisma.pricingModel.update({ where: { id }, data: { isActive } });
        await auditMasterData('PricingModel', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} pricing model: ${existing.name}`);
        res.json(model);
        return;
    }

    await prisma.pricingModel.update({ where: { id }, data: { isActive: false } });
    const newModel = await prisma.pricingModel.create({ data: { name: name ?? existing.name } });
    await auditMasterData('PricingModel', newModel.id, 'UPDATE', req.user!.userId, `Updated pricing model (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newModel);
}

export async function deletePricingModel(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.pricingModel.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Pricing model not found.' }); return; }
    await prisma.pricingModel.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('PricingModel', id, 'DELETE', req.user!.userId, `Deactivated pricing model: ${existing.name}`);
    res.json({ message: 'Pricing model deactivated.' });
}

// ── Project Types ──
export async function listProjectTypes(req: Request, res: Response) {
    const types = await prisma.projectType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(types);
}

export async function listAllProjectTypes(req: Request, res: Response) {
    const types = await prisma.projectType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
}

export async function createProjectType(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Project type name is required.' }); return; }
    const existing = await prisma.projectType.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Project type "${name}" already exists.` }); return; }
    const type = await prisma.projectType.create({ data: { name } });
    await auditMasterData('ProjectType', type.id, 'CREATE', req.user!.userId, `Created project type: ${name}`);
    res.status(201).json(type);
}

export async function updateProjectType(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.projectType.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Project type not found.' }); return; }

    if (isActive !== undefined && !name) {
        const type = await prisma.projectType.update({ where: { id }, data: { isActive } });
        await auditMasterData('ProjectType', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} project type: ${existing.name}`);
        res.json(type);
        return;
    }

    await prisma.projectType.update({ where: { id }, data: { isActive: false } });
    const newType = await prisma.projectType.create({ data: { name: name ?? existing.name } });
    await auditMasterData('ProjectType', newType.id, 'UPDATE', req.user!.userId, `Updated project type (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newType);
}

export async function deleteProjectType(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.projectType.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Project type not found.' }); return; }
    await prisma.projectType.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('ProjectType', id, 'DELETE', req.user!.userId, `Deactivated project type: ${existing.name}`);
    res.json({ message: 'Project type deactivated.' });
}

// ── Salespersons (only users with the Sales role) ──
export async function listSalespersons(req: Request, res: Response) {
    const users = await prisma.user.findMany({
        where: {
            isActive: true,
            roles: { some: { name: 'Sales' } },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, department: true, roles: { select: { name: true } } },
    });
    res.json(users);
}

// ── Departments from QPeople ──
export async function listDepartments(req: Request, res: Response) {
    try {
        const qpeopleToken = process.env.QPEOPLE_API_TOKEN;
        if (!qpeopleToken) {
          return res.status(500).json({ error: 'QPEOPLE_API_TOKEN not configured' });
        }
        const response = await fetch(
            'https://hr.qbadvisory.com/api/method/hrms.api.employee.get_all_managers_with_departments',
            { headers: { 'Authorization': `token ${qpeopleToken}` } }
        );
        const json: any = await response.json();
        const departments = [...new Set(
            (json.message?.data || [])
                .map((e: any) => e.department || e.department_name)
                .filter(Boolean)
        )].sort();
        res.json(departments);
    } catch (error) {
        console.error('QPeople API error:', error);
        res.status(502).json({ error: 'Failed to fetch departments from HRMS.' });
    }
}

// ── Managers by Department (CRM users with Manager role) ──
export async function listManagersByDepartment(req: Request, res: Response) {
    const { department } = req.query;
    try {
        const where: any = {
            isActive: true,
            roles: { some: { name: 'Manager' } },
        };
        if (department && typeof department === 'string') {
            where.department = department;
        }
        const users = await prisma.user.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, email: true, department: true },
        });
        res.json(users);
    } catch (error) {
        console.error('List managers error:', error);
        res.status(500).json({ error: 'Failed to fetch managers.' });
    }
}

// ─ Presales Team (CRM users with Presales role) ─
export async function listPresalesTeam(req: Request, res: Response) {
    try {
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                roles: { some: { name: 'Presales' } },
            },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, email: true, department: true },
        });
        res.json(users);
    } catch (error) {
        console.error('List presales team error:', error);
        res.status(500).json({ error: 'Failed to fetch presales team.' });
    }
}
