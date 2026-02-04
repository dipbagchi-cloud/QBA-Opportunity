import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const opportunities = await prisma.opportunity.findMany({
            include: {
                client: true,
                stage: true,
                owner: true,
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Transform for frontend with Epic 3 Intelligence Logic
        const formatted = opportunities.map(opp => {
            // 1. Calculate Days in Stage (Logic: Days since last update)
            const lastUpdate = new Date(opp.updatedAt);
            const now = new Date();
            const daysInStage = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));

            // 2. Risk Detection Logic (Epic 3)
            // Stalled if > 30 days in non-closed stage
            const isStalled = daysInStage > 30 && !['Closed Won', 'Closed Lost'].includes(opp.stage.name);

            // 3. Deal Health Score (Epic 3 Formula)
            // Health = (Probability * 0.5) + (RecencyFactor * 0.5)
            // RecencyFactor: 100 if < 7 days, 50 if < 30 days, 0 if > 30 days
            let recencyScore = 100;
            if (daysInStage > 30) recencyScore = 0;
            else if (daysInStage > 7) recencyScore = 50;

            const healthScore = Math.round((opp.probability * 0.5) + (recencyScore * 0.5));

            return {
                id: opp.id,
                name: opp.title,
                client: opp.client.name,
                value: Number(opp.value),
                stage: opp.stage.name,
                probability: opp.probability,
                lastActivity: daysInStage === 0 ? 'Today' : `${daysInStage} days ago`,
                owner: opp.owner.name,
                // Status derivation based on Health Score
                status: healthScore > 70 ? 'healthy' : (healthScore > 40 ? 'at-risk' : 'critical'),
                description: opp.description,

                // New Intelligent Fields
                daysInStage,
                isStalled,
                healthScore
            };
        });

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // In a real app, you'd lookup IDs dynamically or use the logged-in user
        // For this prototype, we'll grab the first user/type/stage if not provided

        const defaultUser = await prisma.user.findFirst();
        const defaultType = await prisma.opportunityType.findFirst();
        const discoveryStage = await prisma.stage.findFirst({ where: { name: 'Discovery' } });

        // Handle Client name mapping
        const clientName = body.client || body.companyName; // Frontend sends 'companyName' or 'client'
        let clientId = body.clientId;

        if (!clientId && clientName) {
            const existingClient = await prisma.client.findFirst({ where: { name: clientName } });
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const newClient = await prisma.client.create({
                    data: { name: clientName }
                });
                clientId = newClient.id;
            }
        }

        const newOpp = await prisma.opportunity.create({
            data: {
                title: body.title || body.name, // Frontend sends title or name
                value: body.value,
                description: body.description,
                probability: body.probability || 20,
                priority: "Medium",
                tags: "",

                // New Detailed Fields
                region: body.region,
                practice: body.practice,
                technology: body.technology,
                tentativeStartDate: body.tentativeStartDate ? new Date(body.tentativeStartDate) : undefined,
                tentativeDuration: body.tentativeDuration,
                tentativeEndDate: body.tentativeEndDate ? new Date(body.tentativeEndDate) : undefined,
                pricingModel: body.pricingModel,
                expectedDayRate: body.expectedDayRate,
                salesRepName: body.salesRepName,

                // Relations
                clientId: clientId,
                ownerId: defaultUser?.id!, // Fallback to logged in user logic later
                stageId: discoveryStage?.id!,
                typeId: defaultType?.id!
            } as any,
            include: {
                client: true,
                stage: true
            }
        });

        return NextResponse.json(newOpp);
    } catch (error) {
        console.error('Create Error:', error);
        return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 });
    }
}
