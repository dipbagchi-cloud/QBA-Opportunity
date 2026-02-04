import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const opportunity = await prisma.opportunity.findUnique({
            where: { id },
            include: {
                client: true,
                stage: true,
                owner: true,
            }
        });

        if (!opportunity) {
            return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
        }

        return NextResponse.json(opportunity);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch opportunity' }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        // Handle Client update if name changed
        let clientId = body.clientId;
        if (body.clientName) {
            const existingClient = await prisma.client.findFirst({ where: { name: body.clientName } });
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const newClient = await prisma.client.create({ data: { name: body.clientName } });
                clientId = newClient.id;
            }
        }

        // Handle Stage Transition
        let stageUpdate = {};
        if (body.stageName) {
            const stage = await prisma.stage.findFirst({ where: { name: body.stageName } });
            if (stage) {
                stageUpdate = {
                    stageId: stage.id,
                    currentStage: body.stageName
                };
            }
        }

        const updatedOpp = await prisma.opportunity.update({
            where: { id },
            data: {
                title: body.projectName || body.title, // Map UI 'projectName' to DB 'title'
                description: body.description,
                value: body.value,

                // Detailed Fields
                region: body.region,
                practice: body.practice,
                technology: body.technology,
                salesRepName: body.salesRepName || body.salesRep,
                tentativeStartDate: body.tentativeStartDate ? new Date(body.tentativeStartDate) : undefined,
                tentativeEndDate: body.tentativeEndDate ? new Date(body.tentativeEndDate) : undefined,
                tentativeDuration: body.tentativeDuration || body.duration,
                pricingModel: body.pricingModel,
                expectedDayRate: body.expectedDayRate,

                // Complex Data
                presalesData: body.presalesData,
                salesData: body.salesData,

                // Relations if changed
                clientId: clientId,
                ...stageUpdate
            }
        });

        return NextResponse.json(updatedOpp);
    } catch (error) {
        console.error("Update Error:", error);
        return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 });
    }
}
