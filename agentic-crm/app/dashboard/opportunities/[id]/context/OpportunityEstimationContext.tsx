"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { BudgetAssumptions, ResourceLine, OtherCost, GomResult, calculateProjectGom } from "@/lib/gom-calculator";
import { DEFAULT_ASSUMPTIONS } from "../components/AssumptionsView";
import { apiClient, API_URL, getAuthHeaders } from "@/lib/api";

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
    experienceBand?: string;
    skill?: string;
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

export interface SpecialCosts {
    subcontracting: number;
    miscExpense: number;
    specialHwCost: number;
    specialSwCost: number;
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
    specialCosts: SpecialCosts;
    setSpecialCosts: React.Dispatch<React.SetStateAction<SpecialCosts>>;

    // GOM Calculation Inputs
    markupPercent: number;
    setMarkupPercent: (markup: number) => void;
    salesCommissionPercent: number;
    setSalesCommissionPercent: (val: number) => void;
    preSalesCostPercent: number;
    setPreSalesCostPercent: (val: number) => void;
    currency: string;
    setCurrency: (currency: string) => void;
    effortType: string;
    setEffortType: (type: string) => void;

    // Calculated Values
    totalResourceCost: number;
    totalTravelCost: number;
    totalSpecCost: number;
    salesCommissionAmount: number;
    preSalesCostAmount: number;
    totalCost: number;
    revenue: number;
    gomPercent: number;
    gomStatus: { text: string; color: string };

    // GOM Summary
    gomSummary: GomResult | null;
    months: string[];
    otherCosts: OtherCost[];

    // Persistence
    saveEstimation: () => Promise<void>;
    isSaving: boolean;
    isLoaded: boolean;

    // Read-only mode (when estimation submitted)
    readOnly: boolean;

    // Date range for calendar columns
    startDate: string;
    endDate: string;
    exchangeRatesSnapshot?: Record<string, number>;
}

const OpportunityEstimationContext = createContext<OpportunityEstimationContextType | undefined>(undefined);

export function OpportunityEstimationProvider({ children, opportunityId, readOnly = false, startDate = '', endDate = '', adjustedEstimatedValue = 0, initialCurrency = "INR" }: { children: ReactNode; opportunityId?: string; readOnly?: boolean; startDate?: string; endDate?: string; adjustedEstimatedValue?: number; initialCurrency?: string }) {
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
    const [specialCosts, setSpecialCosts] = useState<SpecialCosts>({
        subcontracting: 0,
        miscExpense: 0,
        specialHwCost: 0,
        specialSwCost: 0,
    });
    const [markupPercent, setMarkupPercentRaw] = useState<number>(0);
    const [salesCommissionPercent, setSalesCommissionPercent] = useState<number>(0);
    const [preSalesCostPercent, setPreSalesCostPercent] = useState<number>(0);
    const [currency, setCurrency] = useState<string>(initialCurrency);
    const [effortType, setEffortType] = useState<string>("QBA");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [exchangeRatesSnapshot, setExchangeRatesSnapshot] = useState<Record<string, number> | undefined>();

    // Wrap setMarkupPercent to also recalculate all resources' dailyRate
    const setMarkupPercent = useCallback((newMarkup: number) => {
        setMarkupPercentRaw(newMarkup);
        setResources(prev => prev.map(r => ({
            ...r,
            dailyRate: r.dailyCost * (1 + newMarkup / 100),
        })));
    }, []);

    // Fetch budget assumptions from admin settings
    useEffect(() => {
        (async () => {
            try {
                const data = await apiClient("/api/admin/budget-assumptions");
                if (data && typeof data === "object") {
                    setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...data });
                }
            } catch {
                // Silently use defaults if API fails
            }
        })();
    }, []);

    // Sync currency with global currency if not read-only
    useEffect(() => {
        if (!readOnly && initialCurrency) {
            setCurrency(initialCurrency);
        }
    }, [initialCurrency, readOnly]);

    // Load saved estimation data from the opportunity record
    useEffect(() => {
        if (!opportunityId) { setIsLoaded(true); return; }
        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}`, { headers: getAuthHeaders() });
                if (!res.ok) { setIsLoaded(true); return; }
                const opp = await res.json();
                const saved = opp.presalesData;
                if (saved && typeof saved === "object" && !Array.isArray(saved)) {
                    // Restore estimation data (skip if it's the old modal-only format)
                    if (saved.resources) setResources(saved.resources);
                    if (saved.travelCosts) setTravelCosts(prev => ({ ...prev, ...saved.travelCosts }));
                    if (saved.specialCosts) setSpecialCosts(prev => ({ ...prev, ...saved.specialCosts }));
                    if (saved.markupPercent != null) setMarkupPercent(saved.markupPercent);
                    if (saved.salesCommissionPercent != null) setSalesCommissionPercent(saved.salesCommissionPercent);
                    if (saved.preSalesCostPercent != null) setPreSalesCostPercent(saved.preSalesCostPercent);
                    if (readOnly && saved.currency) setCurrency(saved.currency);
                    if (saved.effortType) setEffortType(saved.effortType);
                    if (saved.selectedYear) setSelectedYear(saved.selectedYear);
                }
                if (opp.metadata && typeof opp.metadata === "object" && !Array.isArray(opp.metadata) && opp.metadata.exchangeRatesSnapshot) {
                    setExchangeRatesSnapshot(opp.metadata.exchangeRatesSnapshot as Record<string, number>);
                }
            } catch {
                // silently use defaults
            } finally {
                setIsLoaded(true);
            }
        })();
    }, [opportunityId]);


    // Calculated values
    const [totalResourceCost, setTotalResourceCost] = useState(0);
    const [totalTravelCost, setTotalTravelCost] = useState(0);
    const [totalSpecCost, setTotalSpecCost] = useState(0);
    const [salesCommissionAmount, setSalesCommissionAmount] = useState(0);
    const [preSalesCostAmount, setPreSalesCostAmount] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [revenue, setRevenue] = useState(0);
    const [gomPercent, setGomPercent] = useState(0);
    const [gomSummary, setGomSummary] = useState<GomResult | null>(null);
    const [months, setMonths] = useState<string[]>([]);
    const [otherCosts, setOtherCosts] = useState<OtherCost[]>([]);

    // Save estimation data to the opportunity record
    const saveEstimation = useCallback(async () => {
        if (!opportunityId) return;
        setIsSaving(true);
        try {
            const payload = {
                presalesData: {
                    resources,
                    travelCosts,
                    specialCosts,
                    markupPercent,
                    salesCommissionPercent,
                    preSalesCostPercent,
                    currency,
                    effortType,
                    selectedYear,
                    gomSummary,
                },
            };
            await fetch(`${API_URL}/api/opportunities/${opportunityId}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
        } finally {
            setIsSaving(false);
        }
    }, [opportunityId, resources, travelCosts, specialCosts, markupPercent, salesCommissionPercent, preSalesCostPercent, currency, effortType, selectedYear, gomSummary]);

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
        const freqMultiplier = Number(travelCosts.frequency) || 1;
        const total = (
            (Number(travelCosts.roundTripCost) || 0) +
            (Number(travelCosts.medicalInsurance) || 0) +
            (Number(travelCosts.visaCost) || 0) +
            (Number(travelCosts.vaccineCost) || 0) +
            (Number(travelCosts.localConveyance) || 0) +
            (Number(travelCosts.marketingCom) || 0) +
            (Number(travelCosts.hotelCost) || 0)
        ) * freqMultiplier;
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
                experienceBand: resource.experienceBand,
                skill: resource.skill,
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
        if (totalTravelCost > 0) {
            // Determine month for travel cost: first resource month, or derive from start date
            let travelMonth = months.length > 0 ? months[0] : null;
            if (!travelMonth && startDate) {
                const d = new Date(startDate);
                travelMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            if (!travelMonth) {
                travelMonth = `${selectedYear}-01`;
            }
            otherCosts.push({
                id: "travel-1",
                description: "Travel & Hospitality",
                amount: totalTravelCost,
                month: travelMonth,
                category: "Travel + Stay",
            });
        }

        const currentTotalSpecCost = (Number(specialCosts.subcontracting) || 0) + 
                              (Number(specialCosts.miscExpense) || 0) + 
                              (Number(specialCosts.specialHwCost) || 0) + 
                              (Number(specialCosts.specialSwCost) || 0);

        if (currentTotalSpecCost > 0) {
            let specMonth = months.length > 0 ? months[0] : null;
            if (!specMonth && startDate) {
                const d = new Date(startDate);
                specMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            if (!specMonth) {
                specMonth = `${selectedYear}-01`;
            }
            if (Number(specialCosts.subcontracting) > 0) {
                otherCosts.push({ id: "spec-1", description: "Subcontracting", amount: Number(specialCosts.subcontracting), month: specMonth, category: "Subcontracting" });
            }
            if (Number(specialCosts.miscExpense) > 0) {
                otherCosts.push({ id: "spec-2", description: "Miscl. Expense", amount: Number(specialCosts.miscExpense), month: specMonth, category: "Miscl. Expense" });
            }
            if (Number(specialCosts.specialHwCost) > 0) {
                otherCosts.push({ id: "spec-3", description: "Special HW Cost", amount: Number(specialCosts.specialHwCost), month: specMonth, category: "Special HW Cost" });
            }
            if (Number(specialCosts.specialSwCost) > 0) {
                otherCosts.push({ id: "spec-4", description: "Special SW Cost", amount: Number(specialCosts.specialSwCost), month: specMonth, category: "Special SW Cost" });
            }
        }

        setOtherCosts(otherCosts);
        setTotalSpecCost(currentTotalSpecCost);

        // Calculate GOM Summary
        if (resourceLines.length > 0) {
            const summary = calculateProjectGom(resourceLines, otherCosts, assumptions);
            setGomSummary(summary);

            // Calculate Base Cost (now includes budget assumptions from calculateProjectGom)
            const baseCost = summary.totalCost;

            // Use adjustedEstimatedValue as revenue if provided, otherwise use markup calculation
            // Base Cost is used for markup to determine the sale price.
            const calculatedRevenue = adjustedEstimatedValue > 0
                ? adjustedEstimatedValue
                : baseCost * (1 + markupPercent / 100);
            
            setRevenue(calculatedRevenue);

            // Calculate Additional Costs based on Revenue
            const commAmount = calculatedRevenue * (salesCommissionPercent / 100);
            const preSalesAmount = calculatedRevenue * (preSalesCostPercent / 100);
            
            setSalesCommissionAmount(commAmount);
            setPreSalesCostAmount(preSalesAmount);

            // Final Total Cost includes these additional components
            const finalCost = baseCost + commAmount + preSalesAmount;
            setTotalCost(finalCost);

            const gom = calculatedRevenue > 0 ? ((calculatedRevenue - finalCost) / calculatedRevenue) * 100 : 0;
            setGomPercent(gom);
        } else {
            // No resources, simple calculation
            const baseCost = totalTravelCost + currentTotalSpecCost;
            
            const calculatedRevenue = adjustedEstimatedValue > 0
                ? adjustedEstimatedValue
                : baseCost * (1 + markupPercent / 100);
            
            setRevenue(calculatedRevenue);

            const commAmount = calculatedRevenue * (salesCommissionPercent / 100);
            const preSalesAmount = calculatedRevenue * (preSalesCostPercent / 100);

            setSalesCommissionAmount(commAmount);
            setPreSalesCostAmount(preSalesAmount);

            const finalCost = baseCost + commAmount + preSalesAmount;
            setTotalCost(finalCost);

            const gom = calculatedRevenue > 0 ? ((calculatedRevenue - finalCost) / calculatedRevenue) * 100 : 0;
            setGomPercent(gom);
            setGomSummary(null);
        }
    }, [resources, totalTravelCost, specialCosts, markupPercent, salesCommissionPercent, preSalesCostPercent, assumptions, selectedYear, months, adjustedEstimatedValue, startDate]);

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
        specialCosts,
        setSpecialCosts,
        markupPercent,
        setMarkupPercent,
        salesCommissionPercent,
        setSalesCommissionPercent,
        preSalesCostPercent,
        setPreSalesCostPercent,
        currency,
        setCurrency,
        effortType,
        setEffortType,
        totalResourceCost,
        totalTravelCost,
        totalSpecCost,
        salesCommissionAmount,
        preSalesCostAmount,
        totalCost,
        revenue,
        gomPercent,
        gomStatus: getGomStatus(),
        gomSummary,
        months,
        otherCosts,
        saveEstimation,
        isSaving,
        isLoaded,
        readOnly,
        startDate,
        endDate,
        exchangeRatesSnapshot,
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
