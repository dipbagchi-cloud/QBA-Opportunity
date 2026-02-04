"use client";

import { useState, useEffect } from "react";

export interface BudgetAssumptions {
    marginPercent: number;
    workingDaysPerYear: number;
    deliveryMgmtPercent: number;
    benchPercent: number;
    leaveEligibilityPercent: number;
    annualGrowthBufferPercent: number;
    averageIncrementPercent: number;
    bonusPercent: number;
    indirectCostPercent: number;
    welfarePerFte: number;
    trainingPerFte: number;
}

export const DEFAULT_ASSUMPTIONS: BudgetAssumptions = {
    marginPercent: 35,
    workingDaysPerYear: 240,
    deliveryMgmtPercent: 5,
    benchPercent: 10,
    leaveEligibilityPercent: 0,
    annualGrowthBufferPercent: 0,
    averageIncrementPercent: 0,
    bonusPercent: 0,
    indirectCostPercent: 0,
    welfarePerFte: 0,
    trainingPerFte: 0,
};

interface Props {
    data: BudgetAssumptions;
    onChange: (data: BudgetAssumptions) => void;
}

export function AssumptionsView({ data, onChange }: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onChange({
            ...data,
            [name]: parseFloat(value) || 0,
        });
    };

    const InputGroup = ({ label, name, desc }: { label: string, name: keyof BudgetAssumptions, desc?: string }) => (
        <div className="grid gap-2">
            <label htmlFor={name} className="text-sm font-medium leading-none text-slate-700">{label}</label>
            <input
                id={name}
                name={name}
                type="number"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                value={data[name]}
                onChange={handleChange}
            />
            {desc && <p className="text-xs text-slate-500">{desc}</p>}
        </div>
    );

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2 text-slate-800">Core Rates</h3>
                    <InputGroup label="Margin %" name="marginPercent" desc="Target profit margin percentage." />
                    <InputGroup label="Working Days / Year" name="workingDaysPerYear" desc="Standard working days (e.g. 240)." />
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2 text-slate-800">Overheads (Loadings)</h3>
                    <InputGroup label="Delivery Management %" name="deliveryMgmtPercent" />
                    <InputGroup label="Bench %" name="benchPercent" />
                    <InputGroup label="Leave Eligibility %" name="leaveEligibilityPercent" />
                    <InputGroup label="Growth Buffer %" name="annualGrowthBufferPercent" />
                    <InputGroup label="Increments %" name="averageIncrementPercent" />
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2 text-slate-800">Other Cost Drivers</h3>
                    <InputGroup label="Bonus % (of Base)" name="bonusPercent" desc="Performance bonus loading." />
                    <InputGroup label="Indirect Cost % (of Base)" name="indirectCostPercent" desc="Overheads and SG&A." />
                    <InputGroup label="Welfare / FTE (Yearly)" name="welfarePerFte" desc="Team building amount per head/year." />
                    <InputGroup label="Training / FTE (Yearly)" name="trainingPerFte" desc="Learning budget per head/year." />
                </div>
            </div>
        </div>
    );
}
