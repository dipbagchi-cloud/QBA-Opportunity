
export const ADM_RATES_DATA = [
    // --- .NET Developer ---
    { code: "NET-00-02", role: ".NET Developer (00-02)", ctc: 450000, category: "ADM" },
    { code: "NET-02-04", role: ".NET Developer (02-04)", ctc: 800000, category: "ADM" },
    { code: "NET-04-06", role: ".NET Developer (04-06)", ctc: 1250000, category: "ADM" },
    { code: "NET-06-08", role: ".NET Developer (06-08)", ctc: 1750000, category: "ADM" },
    { code: "NET-08-12", role: ".NET Developer (08-12)", ctc: 2400000, category: "ADM" },
    { code: "NET-12-15", role: ".NET Developer (12-15)", ctc: 3150000, category: "ADM" },
    { code: "NET-GT15", role: ".NET Developer (>15)", ctc: 4250000, category: "ADM" },

    // --- AI/ML ---
    { code: "AIML-00-02", role: "AI/ML (00-02)", ctc: 450000, category: "ADM" },
    { code: "AIML-02-04", role: "AI/ML (02-04)", ctc: 800000, category: "ADM" },
    { code: "AIML-04-06", role: "AI/ML (04-06)", ctc: 1250000, category: "ADM" },
    { code: "AIML-06-08", role: "AI/ML (06-08)", ctc: 1750000, category: "ADM" },
    { code: "AIML-08-12", role: "AI/ML (08-12)", ctc: 2400000, category: "ADM" },
    { code: "AIML-12-15", role: "AI/ML (12-15)", ctc: 3150000, category: "ADM" },
    { code: "AIML-GT15", role: "AI/ML (>15)", ctc: 4250000, category: "ADM" },

    // --- Java ---
    { code: "JAV-00-02", role: "Java (00-02)", ctc: 600000, category: "ADM" },
    { code: "JAV-02-04", role: "Java (02-04)", ctc: 950000, category: "ADM" },
    { code: "JAV-08-12", role: "Java (08-12)", ctc: 2300000, category: "ADM" },
    { code: "JAV-12-15", role: "Java (12-15)", ctc: 3300000, category: "ADM" },
    { code: "JAV-GT15", role: "Java (>15)", ctc: 4400000, category: "ADM" },

    // --- SAP Functional ---
    { code: "FAC", role: "Functional Associate Cons", ctc: 660000, category: "SAP Functional" },
    { code: "FC", role: "Functional Consultant", ctc: 1440000, category: "SAP Functional" },
    { code: "FSC", role: "Functional Sr. Consultant", ctc: 2184000, category: "SAP Functional" },
    { code: "FLC", role: "Functional Lead Consultant", ctc: 3360000, category: "SAP Functional" },
    { code: "FPC", role: "Functional Principal Consultant", ctc: 4056000, category: "SAP Functional" },

    // --- SAP Technical ---
    { code: "TAC", role: "Technical Associate Cons", ctc: 612000, category: "SAP Technical" },
    { code: "TC", role: "Technical Consultant", ctc: 1284000, category: "SAP Technical" },
    { code: "TSC", role: "Technical Sr. Consultant", ctc: 2496000, category: "SAP Technical" },
    { code: "TLC", role: "Technical Lead Consultant", ctc: 2892000, category: "SAP Technical" },
    { code: "TPC", role: "Technical Principal Consultant", ctc: 4920000, category: "SAP Technical" },

    // --- Management ---
    { code: "DM", role: "Delivery Manager", ctc: 5460000, category: "Management" },
    { code: "SDM", role: "Sr. Delivery Manager", ctc: 6504000, category: "Management" },
    { code: "PM", role: "Project Manager", ctc: 3408000, category: "Management" },

    // --- SAP Project Mgmt ---
    { code: "PMSAP-06-08", role: "Project Manager SAP (06-08)", ctc: 1750000, category: "ADM" },
    { code: "PMSAP-08-12", role: "Project Manager SAP (08-12)", ctc: 2400000, category: "ADM" },
    { code: "PMSAP-12-15", role: "Project Manager SAP (12-15)", ctc: 3150000, category: "ADM" },

    // --- SAP BW ---
    { code: "SAPBW-00-02", role: "SAP BW (00-02)", ctc: 450000, category: "ADM" },
    { code: "SAPBW-02-04", role: "SAP BW (02-04)", ctc: 800000, category: "ADM" },
    { code: "SAPBW-04-06", role: "SAP BW (04-06)", ctc: 1250000, category: "ADM" },
    { code: "SAPBW-06-08", role: "SAP BW (06-08)", ctc: 1750000, category: "ADM" },
    { code: "SAPBW-08-12", role: "SAP BW (08-12)", ctc: 2400000, category: "ADM" },
    { code: "SAPBW-12-15", role: "SAP BW (12-15)", ctc: 3150000, category: "ADM" },
    { code: "SAPBW-GT15", role: "SAP BW (>15)", ctc: 4250000, category: "ADM" },
];

export const MOCK_ASSUMPTIONS = {
    marginPercent: 35,
    benchPercent: 10,
    workingDaysPerYear: 240,
};

export function getRateCards() {
    const allRates: any[] = [];

    ADM_RATES_DATA.forEach((r: any) => {
        // OFFSHORE Calculation
        const offCost = r.ctc * (1 + (MOCK_ASSUMPTIONS.benchPercent / 100));
        const offDailyCost = offCost / MOCK_ASSUMPTIONS.workingDaysPerYear;
        const offDailyRate = offDailyCost / (1 - (MOCK_ASSUMPTIONS.marginPercent / 100));

        allRates.push({
            code: r.code,
            role: r.role,
            category: r.category,
            annualCtc: r.ctc,
            dailyCost: offDailyCost,
            dailyRate: offDailyRate,
        });
    });

    return allRates;
}
