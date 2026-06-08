"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { BudgetAssumptions, ResourceLine, OtherCost, GomResult, calculateProjectGom, calculateRateCard } from "@/lib/gom-calculator";
import { DEFAULT_ASSUMPTIONS } from "../components/AssumptionsView";
import { apiClient, API_URL, getAuthHeaders } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";

interface ResourceRow {
    id: string;
    role: string;
    projectRole?: string;   // separate dropdown — chosen from admin "Project Roles" lookup (PM, Tech Lead, BA, …)
    country?: string;
    city?: string;
    locationKey?: string;   // e.g. "India + Kolkata" — drives rate lookup
    rateCardCode?: string;  // original rate card code, for re-lookup on location change
    baseLocation: string;
    deliveryFrom: string;
    type: "Offshore" | "Onsite";
    annualCTC: number;
    dailyCost: number;
    dailyRate: number;
    monthlyEfforts: Record<string, number>; // month -> days
    experienceBand?: string;
    skill?: string;
    addedBy?: string; // presales person who added this resource
}

interface TravelCostEntry {
    id: string;
    category: string;
    description: string;
    amount: number;
}

type TravelCosts = TravelCostEntry[];

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

    // Who is currently logged in (used to scope resource editing to own rows)
    currentUserName: string;

    // Admin override: bypass the per-row "only the author can edit" rule so an
    // Admin may edit any resource row while the deal is still open.
    canEditOthersRows: boolean;

    // Original pipeline revenue reference.
    salesTargetRevenue: number;

    // Suggested revenue entered by sales when sending back for re-estimation.
    // This is displayed as guidance only and must not drive the calculated quote.
    reEstimateSuggestedRevenue: number;

    // Whether this opportunity is in re-estimation mode.
    isReEstimation: boolean;

    // Date range for calendar columns
    startDate: string;
    endDate: string;
    durationInDays: number; // Duration in working days from the form
    exchangeRatesSnapshot?: Record<string, number>;

    // Country-attributed holidays (from QPeople). Each resource row is in a
    // specific country, so the Resource Assignment grid uses these to clamp
    // each row's monthly effort to the working days in THAT country.
    holidays: HolidayInfo[];
}

export interface HolidayInfo {
    date: string;
    name: string;
    country: string;
    isOptional: boolean;
}

const OpportunityEstimationContext = createContext<OpportunityEstimationContextType | undefined>(undefined);

export function OpportunityEstimationProvider({ children, opportunityId, readOnly = false, startDate = '', endDate = '', durationInDays = 0, salesTargetRevenue = 0, reEstimateSuggestedRevenue = 0, isReEstimation = false, initialCurrency = "INR", currentUserName = "", canEditOthersRows = false, holidays = [] }: { children: ReactNode; opportunityId?: string; readOnly?: boolean; startDate?: string; endDate?: string; durationInDays?: number; salesTargetRevenue?: number; reEstimateSuggestedRevenue?: number; isReEstimation?: boolean; initialCurrency?: string; currentUserName?: string; canEditOthersRows?: boolean; holidays?: HolidayInfo[] }) {
    // State
    const [assumptions, setAssumptions] = useState<BudgetAssumptions>(DEFAULT_ASSUMPTIONS);
    const [resources, setResources] = useState<ResourceRow[]>([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [travelCosts, setTravelCosts] = useState<TravelCosts>([]);
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
    const [savedFinalRevenue, setSavedFinalRevenue] = useState<number | null>(null);
    const [savedFinalTotalCost, setSavedFinalTotalCost] = useState<number | null>(null);
    const [savedFinalGomPercent, setSavedFinalGomPercent] = useState<number | null>(null);
    const { getRate, loaded: ratesLoaded } = useCurrency();
    // Track the currency that special/travel cost values were entered in.
    // This ensures conversions stay stable when the user switches display currency.
    const [dataCurrency, setDataCurrency] = useState<string>(initialCurrency || 'INR');

    // Backward-compat: old data may have been saved in a non-INR currency before the
    // INR-normalisation fix. Runs once when both the opportunity data and exchange rates
    // are loaded, converts amounts to INR so that state is always in INR base.
    useEffect(() => {
        if (!isLoaded || !ratesLoaded || dataCurrency === 'INR') return;
        const loadRate = getRate(dataCurrency);
        if (!loadRate || loadRate === 0) return;
        setTravelCosts(prev => prev.map(e => ({ ...e, amount: Math.round((e.amount / loadRate) * 100) / 100 })));
        setSpecialCosts(prev => ({
            subcontracting: Math.round(((prev.subcontracting || 0) / loadRate) * 100) / 100,
            miscExpense:     Math.round(((prev.miscExpense     || 0) / loadRate) * 100) / 100,
            specialHwCost:   Math.round(((prev.specialHwCost   || 0) / loadRate) * 100) / 100,
            specialSwCost:   Math.round(((prev.specialSwCost   || 0) / loadRate) * 100) / 100,
        }));
        setDataCurrency('INR');
    }, [isLoaded, ratesLoaded, dataCurrency, getRate]);

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

    // Recalculate all resources' dailyCost & dailyRate when assumptions change.
    // This ensures saved resources (with stale dailyCost) get updated
    // when the correct assumptions are fetched from the API.
    const assumptionsRef = useCallback(() => assumptions, [assumptions]);
    useEffect(() => {
        setResources(prev => {
            if (prev.length === 0) return prev;
            let changed = false;
            const updated = prev.map(r => {
                if (!r.annualCTC || r.annualCTC <= 0) return r;
                const rc = calculateRateCard({ annualCtc: r.annualCTC, monthsPerYear: 12, ...assumptions });
                // Only update if dailyCost actually changed (avoid unnecessary re-renders)
                if (Math.abs(rc.dailyCost - r.dailyCost) < 0.01) return r;
                changed = true;
                return { ...r, dailyCost: rc.dailyCost, dailyRate: rc.dailyCost * (1 + (markupPercent / 100)) };
            });
            return changed ? updated : prev;
        });
    }, [assumptions, markupPercent]);

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
                    if (saved.travelCosts) {
                        // Backward compat: migrate old single-object format to array
                        if (Array.isArray(saved.travelCosts)) {
                            setTravelCosts(saved.travelCosts);
                        } else {
                            // Old format: convert non-zero cost fields to entries
                            const migrated: TravelCostEntry[] = [];
                            const old = saved.travelCosts as Record<string, unknown>;
                            const fieldMap: Record<string, string> = {
                                roundTripCost: 'Round Trip',
                                medicalInsurance: 'Medical Insurance',
                                visaCost: 'Visa',
                                vaccineCost: 'Vaccine',
                                localConveyance: 'Local Conveyance',
                                marketingCom: 'Marketing/Communication',
                                hotelCost: 'Hotel',
                            };
                            const freq = Number(old.frequency) || 1;
                            Object.entries(fieldMap).forEach(([key, label]) => {
                                const val = Number(old[key]) || 0;
                                if (val > 0) {
                                    migrated.push({ id: crypto.randomUUID(), category: label, description: (old.modeOfTravel as string) || '', amount: val * freq });
                                }
                            });
                            setTravelCosts(migrated);
                        }
                    }
                    if (saved.specialCosts) setSpecialCosts(prev => ({ ...prev, ...saved.specialCosts }));
                    if (saved.markupPercent != null) setMarkupPercent(saved.markupPercent);
                    if (saved.salesCommissionPercent != null) setSalesCommissionPercent(saved.salesCommissionPercent);
                    if (saved.preSalesCostPercent != null) setPreSalesCostPercent(saved.preSalesCostPercent);
                    if (readOnly && saved.currency) setCurrency(saved.currency);
                    // Track the currency the cost data was saved in
                    if (saved.currency) setDataCurrency(saved.currency);
                    if (saved.effortType) setEffortType(saved.effortType);
                    if (saved.selectedYear) setSelectedYear(saved.selectedYear);
                    // Snapshot the committed final numbers so read-only consumers
                    // (GOM Calculator on Project / Closed-Won pages, etc.) can
                    // surface the exact figures every other view uses, instead
                    // of a stale live recomputation drifting after assumptions
                    // / rate cards change.
                    if (saved.finalRevenue != null) setSavedFinalRevenue(Number(saved.finalRevenue));
                    if (saved.finalTotalCost != null) setSavedFinalTotalCost(Number(saved.finalTotalCost));
                    if (saved.finalGomPercent != null) setSavedFinalGomPercent(Number(saved.finalGomPercent));
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

    // Track initial load values to detect changes in duration parameters
    const [initialLoadState, setInitialLoadState] = useState<{ startDate: string; endDate: string; durationInDays: number } | null>(null);
    
    // When resources are first loaded, capture the current duration parameters
    useEffect(() => {
        if (isLoaded && !initialLoadState && resources.length > 0) {
            setInitialLoadState({ startDate, endDate, durationInDays });
        }
    }, [isLoaded, resources.length, initialLoadState, startDate, endDate, durationInDays]);

    // Clear resource allocations when duration parameters change significantly.
    // Both writes below are made idempotent: we only rebuild the resources
    // array when there are allocations to clear, and we only re-capture
    // initialLoadState when the tracked values actually differ. Without these
    // guards a transient wobble in the parent-derived endDate / durationInDays
    // props (which settle a couple of frames after the detail page loads) made
    // this effect rebuild new resource arrays + a new initialLoadState object
    // on every render — an infinite re-render loop ("screen dancing").
    useEffect(() => {
        if (!isLoaded || !initialLoadState || readOnly) return;

        const datesChanged = initialLoadState.startDate !== startDate || initialLoadState.endDate !== endDate;
        const durationChanged = Math.abs(initialLoadState.durationInDays - durationInDays) > Math.max(1, initialLoadState.durationInDays * 0.1); // >10% change or >1 day

        if (!datesChanged && !durationChanged) return;

        // Clear monthlyEfforts only if any resource actually has allocations —
        // otherwise return the same array so no re-render is triggered.
        setResources(prev => {
            const hasEfforts = prev.some(r => r.monthlyEfforts && Object.keys(r.monthlyEfforts).length > 0);
            if (!hasEfforts) return prev;
            return prev.map(r => ({ ...r, monthlyEfforts: {} }));
        });

        // Re-capture tracked params only if they truly changed, so we don't
        // spin on a fresh object identity each render.
        setInitialLoadState(prev => {
            if (prev && prev.startDate === startDate && prev.endDate === endDate && prev.durationInDays === durationInDays) {
                return prev;
            }
            return { startDate, endDate, durationInDays };
        });
    }, [startDate, endDate, durationInDays, isLoaded, initialLoadState, readOnly]);


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
            // Amounts in state are always in INR base — save them directly
            const payload = {
                presalesData: {
                    resources,
                    travelCosts,
                    specialCosts: {
                        subcontracting: Number(specialCosts.subcontracting) || 0,
                        miscExpense:    Number(specialCosts.miscExpense) || 0,
                        specialHwCost:  Number(specialCosts.specialHwCost) || 0,
                        specialSwCost:  Number(specialCosts.specialSwCost) || 0,
                    },
                    markupPercent,
                    salesCommissionPercent,
                    preSalesCostPercent,
                    currency: 'INR',
                    effortType,
                    selectedYear,
                    gomSummary,
                    finalRevenue: revenue,
                    finalTotalCost: totalCost,
                    finalGomPercent: gomPercent,
                    finalProfit: revenue - totalCost,
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
    }, [opportunityId, resources, travelCosts, specialCosts, markupPercent, salesCommissionPercent, preSalesCostPercent, effortType, selectedYear, gomSummary, revenue, totalCost, gomPercent]);

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

    // Travel cost amounts are always stored in INR base
    useEffect(() => {
        setTotalTravelCost(travelCosts.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
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
                projectRole: resource.projectRole,
                location: resource.type,
                dailyRate: resource.dailyRate,
                // Use the loaded daily cost (includes overhead: DM, Bench, Leave, Growth, Increment)
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

        // Special cost amounts are always stored in INR base
        const specToBase = (val: number) => Number(val) || 0;

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
                otherCosts.push({ id: "spec-1", description: "Subcontracting", amount: specToBase(Number(specialCosts.subcontracting)), month: specMonth, category: "Subcontracting" });
            }
            if (Number(specialCosts.miscExpense) > 0) {
                otherCosts.push({ id: "spec-2", description: "Miscl. Expense", amount: specToBase(Number(specialCosts.miscExpense)), month: specMonth, category: "Miscl. Expense" });
            }
            if (Number(specialCosts.specialHwCost) > 0) {
                otherCosts.push({ id: "spec-3", description: "Special HW Cost", amount: specToBase(Number(specialCosts.specialHwCost)), month: specMonth, category: "Special HW Cost" });
            }
            if (Number(specialCosts.specialSwCost) > 0) {
                otherCosts.push({ id: "spec-4", description: "Special SW Cost", amount: specToBase(Number(specialCosts.specialSwCost)), month: specMonth, category: "Special SW Cost" });
            }
        }

        setOtherCosts(otherCosts);
        setTotalSpecCost(specToBase(currentTotalSpecCost));

        // Calculate GOM Summary
        if (resourceLines.length > 0) {
            const summary = calculateProjectGom(resourceLines, otherCosts, assumptions);
            setGomSummary(summary);

            const baseCost = summary.totalCost;

            const calculatedRevenue = baseCost * (1 + markupPercent / 100);

            setRevenue(calculatedRevenue);

            const commAmount = calculatedRevenue * (salesCommissionPercent / 100);
            const preSalesAmount = calculatedRevenue * (preSalesCostPercent / 100);

            setSalesCommissionAmount(commAmount);
            setPreSalesCostAmount(preSalesAmount);

            const finalCost = baseCost + commAmount + preSalesAmount;
            setTotalCost(finalCost);

            const gom = calculatedRevenue > 0 ? ((calculatedRevenue - finalCost) / calculatedRevenue) * 100 : 0;
            setGomPercent(gom);
        } else {
            // No resources, simple calculation
            const baseCost = totalTravelCost + specToBase(currentTotalSpecCost);

            const calculatedRevenue = baseCost * (1 + markupPercent / 100);

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
    }, [resources, totalTravelCost, specialCosts, markupPercent, salesCommissionPercent, preSalesCostPercent, assumptions, selectedYear, months, startDate]);

    // Override the live recalculation with the saved committed figures whenever
    // the opportunity is in a read-only state. Keeps GOM Calculator tiles in
    // lockstep with Project Details / list view / proposal email.
    useEffect(() => {
        if (!readOnly) return;
        if (savedFinalRevenue != null) setRevenue(savedFinalRevenue);
        if (savedFinalTotalCost != null) setTotalCost(savedFinalTotalCost);
        if (savedFinalGomPercent != null) setGomPercent(savedFinalGomPercent);
    }, [readOnly, savedFinalRevenue, savedFinalTotalCost, savedFinalGomPercent, resources, totalTravelCost, specialCosts, markupPercent, salesCommissionPercent, preSalesCostPercent, assumptions]);

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
        currentUserName,
        canEditOthersRows,
        salesTargetRevenue,
        reEstimateSuggestedRevenue,
        isReEstimation,
        startDate,
        endDate,
        durationInDays,
        exchangeRatesSnapshot,
        holidays,
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

export type { ResourceRow, TravelCosts, TravelCostEntry };
