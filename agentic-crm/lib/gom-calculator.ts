export type BudgetAssumptions = {
    marginPercent: number;
    deliveryMgmtPercent: number;
    benchPercent: number;
    leaveEligibilityPercent: number;
    annualGrowthBufferPercent: number;
    averageIncrementPercent: number;
    workingDaysPerYear: number;
    bonusPercent: number;
    indirectCostPercent: number;
    welfarePerFte: number;
    trainingPerFte: number;
};

export type RateCardParams = {
    annualCtc: number;
    monthsPerYear: number; // usually 12
} & BudgetAssumptions;

export type RateCardResult = {
    adjustedCost: number;
    monthlyCost: number;
    dailyCost: number;
};

// Logic for calculating cost rates
export function calculateRateCard(params: RateCardParams): RateCardResult {
    const {
        annualCtc,
        deliveryMgmtPercent,
        benchPercent,
        leaveEligibilityPercent,
        annualGrowthBufferPercent,
        averageIncrementPercent,
        workingDaysPerYear,
    } = params;

    // Step 1: Base Loadings
    const dmCost = annualCtc * (deliveryMgmtPercent / 100);
    const benchCost = annualCtc * (benchPercent / 100);
    const leaveCost = annualCtc * (leaveEligibilityPercent / 100);

    // Growth & Increment
    const growthCost = annualCtc * (annualGrowthBufferPercent / 100);
    const incrementCost = annualCtc * (averageIncrementPercent / 100);

    const totalAnnualCost = annualCtc + dmCost + benchCost + leaveCost + growthCost + incrementCost;

    const monthlyCost = totalAnnualCost / 12;
    // dailyCost = loaded cost per day (CTC + all overhead loadings)
    // This is the actual cost to the company per working day
    const dailyCost = totalAnnualCost / workingDaysPerYear;

    return {
        adjustedCost: totalAnnualCost,
        monthlyCost,
        dailyCost,
    };
}

export type ResourceMonth = {
    month: string; // "YYYY-MM"
    days: number;
};

export type ResourceLine = {
    id: string;
    role: string;
    projectRole?: string;
    location: "Offshore" | "Onsite";
    dailyRate: number; // Revenue
    dailyCost: number; // Cost
    months: ResourceMonth[];
    experienceBand?: string;
    skill?: string;
};

export type OtherCost = {
    id: string;
    description: string;
    amount: number;
    month: string;
    category: string;
};

export type GomResult = {
    totalRevenue: number;
    totalCost: number;
    gomFull: number;
    gomPercent: number;
    monthlyData: Record<string, {
        revenue: number;
        cost: number;
        gom: number;
        // Breakdowns for detail view
        salary: number;
        overhead: number;
        bonus: number;
        welfare: number;
        training: number;
        indirect: number;
        other: number;
    }>;
};

export function calculateProjectGom(lines: ResourceLine[], otherCosts: OtherCost[], assumptions: BudgetAssumptions): GomResult {
    let totalRevenue = 0;
    let totalCost = 0;

    // Helper to init month data
    const getMonthData = (m: string) => ({
        revenue: 0, cost: 0, gom: 0,
        salary: 0, overhead: 0, bonus: 0, welfare: 0, training: 0, indirect: 0, other: 0
    });

    const monthlyData: Record<string, ReturnType<typeof getMonthData>> = {};

    // 1. Calculate Resource-based Costs
    // dailyCost is loaded (includes org-level overhead: DM, Bench, Leave, Growth, Increment).
    // We decompose it into raw salary + overhead for GOM display purposes.
    const workingDaysPerMonth = assumptions.workingDaysPerYear / 12;
    const overheadPct = (assumptions.deliveryMgmtPercent + assumptions.benchPercent +
        assumptions.leaveEligibilityPercent + assumptions.annualGrowthBufferPercent +
        assumptions.averageIncrementPercent) / 100;

    for (const line of lines) {
        for (const m of line.months) {
            if (!monthlyData[m.month]) monthlyData[m.month] = getMonthData(m.month);

            const days = m.days;
            if (days <= 0) continue;

            const fte = days / workingDaysPerMonth;

            // Revenue
            const rev = days * line.dailyRate;
            monthlyData[m.month].revenue += rev;
            totalRevenue += rev;

            // Total loaded cost for this resource-month
            const totalLoaded = days * line.dailyCost;

            // Split into raw salary and org-level overhead for display
            // loaded = raw * (1 + overheadPct), so raw = loaded / (1 + overheadPct)
            const rawSalary = overheadPct > 0 ? totalLoaded / (1 + overheadPct) : totalLoaded;
            const overhead = totalLoaded - rawSalary;

            monthlyData[m.month].salary += rawSalary;
            monthlyData[m.month].overhead += overhead;

            // Project-level costs (bonus, indirect, welfare, training) based on raw salary
            const bonus = rawSalary * (assumptions.bonusPercent / 100);
            monthlyData[m.month].bonus += bonus;

            const indirect = rawSalary * (assumptions.indirectCostPercent / 100);
            monthlyData[m.month].indirect += indirect;

            const welfare = (assumptions.welfarePerFte / 12) * fte;
            monthlyData[m.month].welfare += welfare;

            const training = (assumptions.trainingPerFte / 12) * fte;
            monthlyData[m.month].training += training;

            // Total for this line-month = loaded salary + project-level costs
            const lineCost = totalLoaded + bonus + indirect + welfare + training;
            monthlyData[m.month].cost += lineCost;
            totalCost += lineCost;
        }
    }

    // 2. Process Other Costs (Manual Overrides)
    for (const cost of otherCosts) {
        if (!monthlyData[cost.month]) monthlyData[cost.month] = getMonthData(cost.month);

        monthlyData[cost.month].other += cost.amount;
        monthlyData[cost.month].cost += cost.amount;
        totalCost += cost.amount;
    }

    // 3. Final Aggregation
    let gomFull = totalRevenue - totalCost;
    let gomPercent = totalRevenue > 0 ? (gomFull / totalRevenue) * 100 : 0;

    // Recalculate GOM per month
    Object.keys(monthlyData).forEach(m => {
        monthlyData[m].gom = monthlyData[m].revenue - monthlyData[m].cost;
    });

    return {
        totalRevenue,
        totalCost,
        gomFull,
        gomPercent,
        monthlyData,
    };
}
