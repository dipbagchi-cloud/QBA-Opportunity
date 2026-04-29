const fs = require('fs');
const path = 'd:/Opportunity/Jaydeep_work/agentic-crm/app/dashboard/opportunities/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add getPresalesConverted helper
const helperCode = `
    const cSym = getSymbol(opportunityCurrency);
    
    // Convert presales data saved in potentially different currency to current opportunity currency
    const getPresalesConverted = (val: number) => {
        if (!val) return 0;
        const presalesCurr = rawPresalesData?.currency || opportunityCurrency;
        if (presalesCurr === opportunityCurrency) return val;
        
        const ratesSnapshot = rawMetadata?.exchangeRatesSnapshot as Record<string, number>;
        const rateToOpp = ratesSnapshot ? ratesSnapshot[opportunityCurrency] : getRate(opportunityCurrency);
        const rateFromPre = ratesSnapshot ? ratesSnapshot[presalesCurr] : getRate(presalesCurr);
        
        if (!rateToOpp || !rateFromPre) return val;
        return (val * rateToOpp) / rateFromPre;
    };
`;
content = content.replace('const cSym = getSymbol(opportunityCurrency);', helperCode);

// 2. Replace all the {cSym}{Number((rawPresalesData...)} lines with {cSym}{getPresalesConverted(...).toLocaleString()}
const fields = [
    'travelCosts?.roundTripCost',
    'travelCosts?.medicalInsurance',
    'travelCosts?.visaCost',
    'travelCosts?.vaccineCost',
    'travelCosts?.hotelCost',
    'gomSummary?.totalRevenue',
    'gomSummary?.totalCost',
    'gomSummary?.profit'
];

for (const field of fields) {
    const regex = new RegExp(`\\{cSym\\}\\{Number\\(\\(?rawPresalesData\\?\\.${field.replace(/\?/g, '\\?').replace(/\./g, '\\.')} \\|\\| 0\\)?\\)\\.toLocaleString\\(undefined, \\{ minimumFractionDigits: 0, maximumFractionDigits: 2 \\}\\)\\}[\\s\\S]*?\\<\\/p\\>`, 'g');
    
    content = content.replace(regex, `{cSym}{getPresalesConverted(rawPresalesData?.${field} || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>`);
}

fs.writeFileSync(path, content);
console.log('Done rewriting page.tsx presales details');
