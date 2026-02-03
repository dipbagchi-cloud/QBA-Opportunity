import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const opportunity = await prisma.opportunity.findUnique({
            where: { id: params.id },
            include: {
                client: true,
                stage: true,
                type: true,
                owner: true
            }
        });

        if (!opportunity) {
            return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
        }

        return NextResponse.json(opportunity);
    } catch (error) {
        console.error('Fetch Opportunity Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();

        // We update fields based on what's passed.
        // Specially handle JSON fields if needed, but Prisma handles 'presalesData: jsonObject' fine.

        const updatedOpp = await prisma.opportunity.update({
            where: { id: params.id },
            data: {
                title: body.title,
                description: body.description,
                geolocation: body.geolocation,
                salesRepName: body.salesRepName,
                currentStage: body.currentStage,
                detailedStatus: body.detailedStatus,
                presalesData: body.presalesData, // Pass the JSON object directly
                salesData: body.salesData,       // Pass the JSON object directly
                value: body.value,               // Decimal/Float
                probability: body.probability,
                // Relations updates if needed
                stageId: body.stageId
            }
        });

        return NextResponse.json(updatedOpp);
    } catch (error) {
        console.error('Update Opportunity Error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        await prisma.opportunity.delete({ where: { id: params.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
