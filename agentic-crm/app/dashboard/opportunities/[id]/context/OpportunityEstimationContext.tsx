"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { BudgetAssumptions, ResourceLine, OtherCost, GomResult, calculateProjectGom } from "@/lib/gom-calculator";
import { DEFAULT_ASSUMPTIONS } from "../components/AssumptionsView";

interface ResourceRow {
    id: string;
    role: string;
    baseLocation: string;
    deliveryFrom: string;
    type: "Offshore" | "Onsite";
    annualCTC: number;
    dailyCost: number;
    dailyRate: number;
    monthlyEfforts: Record<string, number>; // month -> days
}

interface TravelCosts {
    modeOfTravel: string;
    frequency: string;
    roundTripCost: number;
    medicalInsurance: number;
    visaCost: number;
    vaccineCost: number;
    localConveyance: number;
    marketingCom: number;
    hotelCost: number;
}

interface OpportunityEstimationContextType {
    // Assumptions
    assumptions: BudgetAssumptions;
    setAssumptions: (assumptions: BudgetAssumptions) => void;

    // Resource Assignment
    resources: ResourceRow[];
    setResources: (resources: ResourceRow[]) => void;
    selectedYear: number;
    setSelectedYear: (year: number) => void;

    // Travel Costs
    travelCosts: TravelCosts;
    setTravelCosts: (costs: TravelCosts) => void;

    // GOM Calculation Inputs
    markupPercent: number;
    setMarkupPercent: (markup: number) => void;
    currency: string;
    setCurrency: (currency: string) => void;

    // Calculated Values
    totalResourceCost: number;
    totalTravelCost: number;
    totalCost: number;
    revenue: number;
    gomPercent: number;
    gomStatus: { text: string; color: string };

    // GOM Summary
    gomSummary: GomResult | null;
    months: string[];
    otherCosts: OtherCost[];
}

const OpportunityEstimationContext = createContext<OpportunityEstimationContextType | undefined>(undefined);

export function OpportunityEstimationProvider({ children }: { children: ReactNode }) {
    // State
    const [assumptions, setAssumptions] = useState<BudgetAssumptions>(DEFAULT_ASSUMPTIONS);
    const [resources, setResources] = useState<ResourceRow[]>([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [travelCosts, setTravelCosts] = useState<TravelCosts>({
        modeOfTravel: "",
        frequency: "",
        roundTripCost: 0,
        medicalInsurance: 0,
        visaCost: 0,
        vaccineCost: 0,
        localConveyance: 0,
        marketingCom: 0,
        hotelCost: 0,
    });
    const [markupPercent, setMarkupPercent] = useState<number>(0);
    const [currency, setCurrency] = useState<string>("INR");

    // Calculated values
    const [totalResourceCost, setTotalResourceCost] = useState(0);
    const [totalTravelCost, setTotalTravelCost] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [revenue, setRevenue] = useState(0);
    const [gomPercent, setGomPercent] = useState(0);
    const [gomSummary, setGomSummary] = useState<GomResult | null>(null);
    const [months, setMonths] = useState<string[]>([]);
    const [otherCosts, setOtherCosts] = useState<OtherCost[]>([]);

    // Calculate months from resources
    useEffect(() => {
        const allMonths = new Set<string>();
        resources.forEach(resource => {
            Object.keys(resource.monthlyEfforts).forEach(month => {
                if (resource.monthlyEfforts[month] > 0) {
                    // Convert month name to YYYY-MM format
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(month);
                    if (monthIndex !== -1) {
                        const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        allMonths.add(monthStr);
                    }
                }
            });
        });
        setMonths(Array.from(allMonths).sort());
    }, [resources, selectedYear]);

    // Calculate total travel cost
    useEffect(() => {
        const total = travelCosts.roundTripCost +
            travelCosts.medicalInsurance +
            travelCosts.visaCost +
            travelCosts.vaccineCost +
            travelCosts.localConveyance +
            travelCosts.marketingCom +
            travelCosts.hotelCost;
        setTotalTravelCost(total);
    }, [travelCosts]);

    // Calculate resource cost and GOM
    useEffect(() => {
        // Convert resources to ResourceLine format
        const resourceLines: ResourceLine[] = resources.map(resource => {
            const monthsData: { month: string; days: number }[] = [];

            Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                if (days > 0) {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        monthsData.push({ month: monthStr, days });
                    }
                }
            });

            return {
                id: resource.id,
                role: resource.role,
                location: resource.type,
                dailyRate: resource.dailyRate,
                dailyCost: resource.dailyCost,
                months: monthsData,
            };
        });

        // Calculate total resource cost
        let resCost = 0;
        resourceLines.forEach(line => {
            line.months.forEach(m => {
                resCost += m.days * line.dailyCost;
            });
        });
        setTotalResourceCost(resCost);

        // Create other costs for travel (distribute across months if needed)
        const otherCosts: OtherCost[] = [];
        if (totalTravelCost > 0 && months.length > 0) {
            // Add travel cost to first month
            otherCosts.push({
                id: "travel-1",
                description: "Travel & Hospitality",
                amount: totalTravelCost,
                month: months[0],
                category: "Travel + Stay",
            });
        }
        setOtherCosts(otherCosts);

        // Calculate GOM Summary
        if (resourceLines.length > 0) {
            const summary = calculateProjectGom(resourceLines, otherCosts, assumptions);
            setGomSummary(summary);

            // Calculate totals
            const finalCost = resCost + totalTravelCost;
            setTotalCost(finalCost);

            const calculatedRevenue = finalCost * (1 + markupPercent / 100);
            setRevenue(calculatedRevenue);

            const gom = calculatedRevenue > 0 ? ((calculatedRevenue - finalCost) / calculatedRevenue) * 100 : 0;
            setGomPercent(gom);
        } else {
            // No resources, simple calculation
            const finalCost = totalTravelCost;
            setTotalCost(finalCost);

            const calculatedRevenue = finalCost * (1 + markupPercent / 100);
            setRevenue(calculatedRevenue);

            const gom = calculatedRevenue > 0 ? ((calculatedRevenue - finalCost) / calculatedRevenue) * 100 : 0;
            setGomPercent(gom);
            setGomSummary(null);
        }
    }, [resources, totalTravelCost, markupPercent, assumptions, selectedYear, months]);

    // Determine GOM status
    const getGomStatus = () => {
        if (gomPercent >= 30) return { text: "Approved", color: "text-green-600 bg-green-50 border-green-200" };
        if (gomPercent >= 20) return { text: "Review", color: "text-amber-600 bg-amber-50 border-amber-200" };
        return { text: "Rejected", color: "text-red-600 bg-red-50 border-red-200" };
    };

    const value: OpportunityEstimationContextType = {
        assumptions,
        setAssumptions,
        resources,
        setResources,
        selectedYear,
        setSelectedYear,
        travelCosts,
        setTravelCosts,
        markupPercent,
        setMarkupPercent,
        currency,
        setCurrency,
        totalResourceCost,
        totalTravelCost,
        totalCost,
        revenue,
        gomPercent,
        gomStatus: getGomStatus(),
        gomSummary,
        months,
        otherCosts,
    };

    return (
        <OpportunityEstimationContext.Provider value={value}>
            {children}
        </OpportunityEstimationContext.Provider>
    );
}

export function useOpportunityEstimation() {
    const context = useContext(OpportunityEstimationContext);
    if (context === undefined) {
        throw new Error("useOpportunityEstimation must be used within OpportunityEstimationProvider");
    }
    return context;
}

export type { ResourceRow, TravelCosts };
