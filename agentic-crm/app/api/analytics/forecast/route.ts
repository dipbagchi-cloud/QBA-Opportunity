import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateWeightedForecast } from '@/lib/intelligence';

// Epic 8: Forecasting & Insights API
export async function GET() {
    try {
        const opportunities = await prisma.opportunity.findMany({
            where: { isArchived: false, stage: { isClosed: false } }, // Active Pipeline only
            select: { value: true, probability: true, stage: { select: { name: true } } }
        });

        const forecast = calculateWeightedForecast(opportunities);

        return NextResponse.json({
            status: 'success',
            data: forecast
        });
    } catch (error) {
        return NextResponse.json({ error: 'Forecast Failed' }, { status: 500 });
    }
}
