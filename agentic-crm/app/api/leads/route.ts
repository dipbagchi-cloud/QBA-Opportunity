import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper: Calculate Lead Score (Epic 2 Logic)
function calculateLeadScore(data: any): { score: number, factors: any, explanation: string } {
    let score = 0;
    const factors: any = { explicit: 0, implicit: 0, distinct_factors: [] };

    // 1. Explicit Factors (Profile)
    // Job Title
    const title = data.contact?.title?.toLowerCase() || '';
    if (title.includes('c-level') || title.includes('vp') || title.includes('director') || title.includes('head')) {
        score += 25;
        factors.explicit += 25;
        factors.distinct_factors.push("Decision Maker Title");
    } else if (title.includes('manager')) {
        score += 10;
        factors.explicit += 10;
        factors.distinct_factors.push("Manager Title");
    }

    // Budget
    if (data.value && data.value > 50000) {
        score += 30;
        factors.explicit += 30;
        factors.distinct_factors.push("High Budget (>50k)");
    } else if (data.value > 10000) {
        score += 15;
        factors.explicit += 15;
        factors.distinct_factors.push("Medium Budget (>10k)");
    }

    // Company Size (if provided)
    if (data.companySize === 'Enterprise') {
        score += 20;
        factors.explicit += 20;
        factors.distinct_factors.push("Enterprise Company");
    }

    // 2. Implicit Factors (Behavior - Mocked for Intake)
    // Assuming 'source' tells us something
    if (data.source === 'Inbound Demo Request') {
        score += 25;
        factors.implicit += 25;
        factors.distinct_factors.push("High Intent Source (Demo)");
    } else if (data.source === 'Contact Form') {
        score += 15;
        factors.implicit += 15;
    }

    // Cap at 99
    score = Math.min(score, 99);

    let explanation = "Low fit lead.";
    if (score > 70) explanation = "Hot Lead! High budget and decision maker authority detected.";
    else if (score > 40) explanation = "Warm Lead. Good potential but requires qualification.";

    return { score, factors, explanation };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Deduplication (Epic 2 Capability)
        // Check for existing contact by email
        let contact = null;
        if (body.contact?.email) {
            contact = await prisma.contact.findFirst({
                where: { email: body.contact.email },
                include: { client: true }
            });
        }

        // Check for duplicate opportunity within last 60 days
        if (contact) {
            const duplicateOpp = await prisma.opportunity.findFirst({
                where: {
                    clientId: contact.clientId,
                    title: body.title, // Or match loosely
                    createdAt: { gt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } // 60 days
                }
            });

            if (duplicateOpp) {
                return NextResponse.json({
                    status: 'duplicate',
                    message: `Duplicate lead detected. Existing opportunity ID: ${duplicateOpp.id}`,
                    opportunityId: duplicateOpp.id
                });
            }
        }

        // 2. Client & Contact Management
        let clientId = contact?.clientId;

        if (!clientId && body.companyName) {
            // Find or Create Client
            let client = await prisma.client.findFirst({ where: { name: body.companyName } });
            if (!client) {
                client = await prisma.client.create({
                    data: {
                        name: body.companyName,
                        domain: body.domain,
                    }
                });
            }
            clientId = client.id;
        }

        if (!contact && body.contact?.email && clientId) {
            contact = await prisma.contact.create({
                data: {
                    firstName: body.contact.firstName,
                    lastName: body.contact.lastName,
                    email: body.contact.email,
                    title: body.contact.title,
                    clientId: clientId
                }
            });
        }

        // 3. Lead Qualification (Scoring)
        const qualification = calculateLeadScore(body);

        // 4. Creation (as Opportunity in 'Discovery' or 'Pipeline' stage)
        // Get 'Discovery' or first stage
        const stage = await prisma.stage.findUnique({ where: { name: 'Discovery' } })
            || await prisma.stage.findFirst({ orderBy: { order: 'asc' } });

        const defaultType = await prisma.opportunityType.findFirst();
        const defaultUser = await prisma.user.findFirst(); // Auto-assign to first user for now (or Round Robin in future)

        const newLead = await prisma.opportunity.create({
            data: {
                title: body.title || `New Deal - ${body.companyName}`,
                value: body.value || 0,
                description: body.description,
                source: body.source || 'API',
                tags: "",
                probability: qualification.score > 70 ? 30 : 10, // Higher score = Higher initial probability

                clientId: clientId!,
                stageId: stage?.id!,
                typeId: defaultType?.id!,
                ownerId: defaultUser?.id!, // Lead Assignment Rule would go here

                // Store Score
                leadScore: {
                    create: {
                        score: qualification.score,
                        scoreVersion: "v1.0",
                        factors: qualification.factors,
                        confidence: 0.85,
                        recommendedAction: qualification.explanation
                    }
                }
            },
            include: {
                leadScore: true,
                client: true
            }
        });

        return NextResponse.json({
            status: 'success',
            lead: newLead,
            qualification: qualification
        });

    } catch (error) {
        console.error('Lead Ingestion Error:', error);
        return NextResponse.json({ error: 'Failed to ingest lead' }, { status: 500 });
    }
}
