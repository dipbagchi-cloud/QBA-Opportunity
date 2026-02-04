import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // 1. Fetch Opportunity
        const opportunity = await prisma.opportunity.findUnique({
            where: { id },
            include: {
                client: true,
                project: true
            }
        });

        if (!opportunity) {
            return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
        }

        // 2. Idempotency Check
        if (opportunity.project) {
            return NextResponse.json({
                error: 'Project already exists for this opportunity',
                projectId: opportunity.project.id
            }, { status: 409 });
        }

        // 3. Create Project (Epic 6 Logic: Auto-mapping)
        // Map fields: Value -> Budget, CloseDate -> StartDate
        const project = await prisma.project.create({
            data: {
                name: opportunity.title,
                code: `PROJ-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`, // Simple generator
                description: opportunity.description,
                budget: opportunity.value,
                currency: opportunity.currency,
                startDate: opportunity.expectedCloseDate || new Date(),
                status: 'Planning',

                // Relations
                clientId: opportunity.clientId,
                managerId: opportunity.ownerId, // Default to Opp owner, usually changes
                opportunityId: opportunity.id,

                // Initial Milestones (Epic 6 Template)
                milestones: {
                    create: [
                        { name: "Project Kickoff", status: "Pending", dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
                        { name: "Requirements Gathering", status: "Pending", dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) }
                    ]
                }
            }
        });

        // 4. Update Opportunity Status (optional, if not auto-handled by stage)
        // await prisma.opportunity.update({ where: { id }, data: { isArchived: true } });

        return NextResponse.json({
            status: 'success',
            message: 'Project created successfully',
            project: project
        });

    } catch (error) {
        console.error('Conversion Error:', error);
        return NextResponse.json({ error: 'Failed to convert opportunity' }, { status: 500 });
    }
}
