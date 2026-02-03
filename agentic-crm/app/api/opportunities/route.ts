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

        // Transform for frontend if needed (e.g. mapping DB fields to UI fields)
        const formatted = opportunities.map(opp => ({
            id: opp.id,
            name: opp.title,
            client: opp.client.name,
            value: Number(opp.value),
            stage: opp.stage.name,
            probability: opp.probability,
            lastActivity: opp.updatedAt.toISOString(), // Simplified
            owner: opp.owner.name,
            status: opp.probability > 50 ? 'healthy' : 'at-risk', // Simple logic
            description: opp.description
        }));

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

        // Handle Client (Find or Create)
        let clientId = body.clientId;
        if (!clientId && body.client) {
            const existingClient = await prisma.client.findFirst({ where: { name: body.client } });
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const newClient = await prisma.client.create({
                    data: { name: body.client }
                });
                clientId = newClient.id;
            }
        }

        const newOpp = await prisma.opportunity.create({
            data: {
                title: body.name,
                value: body.value,
                description: body.description,
                probability: body.probability || 20,
                priority: "Medium",
                tags: "",

                // Relations
                clientId: clientId,
                ownerId: defaultUser?.id!, // Fallback
                stageId: discoveryStage?.id!,
                typeId: defaultType?.id!
            },
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
