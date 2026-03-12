import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/opportunities
export async function listOpportunities(req: Request, res: Response) {
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

        res.json(formatted);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
}

// POST /api/opportunities
export async function createOpportunity(req: Request, res: Response) {
    try {
        const body = req.body;

        const defaultUser = await prisma.user.findFirst();
        const defaultType = await prisma.opportunityType.findFirst();
        const discoveryStage = await prisma.stage.findFirst({ where: { name: 'Discovery' } });

        // Handle Client name mapping
        const clientName = body.client || body.companyName;
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
                title: body.title || body.name,
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
                ownerId: defaultUser?.id!,
                stageId: discoveryStage?.id!,
                typeId: defaultType?.id!
            } as any,
            include: {
                client: true,
                stage: true
            }
        });

        res.json(newOpp);
    } catch (error) {
        console.error('Create Error:', error);
        res.status(500).json({ error: 'Failed to create opportunity' });
    }
}

// GET /api/opportunities/:id
export async function getOpportunity(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const opportunity = await prisma.opportunity.findUnique({
            where: { id },
            include: {
                client: true,
                stage: true,
                owner: true,
            }
        });

        if (!opportunity) {
            return res.status(404).json({ error: 'Opportunity not found' });
        }

        res.json(opportunity);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch opportunity' });
    }
}

// PATCH /api/opportunities/:id
export async function updateOpportunity(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const body = req.body;

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
        let stageUpdate: any = {};
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
                title: body.projectName || body.title,
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

        res.json(updatedOpp);
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: 'Failed to update opportunity' });
    }
}

// POST /api/opportunities/:id/convert
export async function convertOpportunity(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // 1. Fetch Opportunity
        const opportunity = await prisma.opportunity.findUnique({
            where: { id },
            include: {
                client: true,
                project: true
            }
        });

        if (!opportunity) {
            return res.status(404).json({ error: 'Opportunity not found' });
        }

        // 2. Idempotency Check
        if (opportunity.project) {
            return res.status(409).json({
                error: 'Project already exists for this opportunity',
                projectId: opportunity.project.id
            });
        }

        // 3. Create Project (Epic 6 Logic: Auto-mapping)
        const project = await prisma.project.create({
            data: {
                name: opportunity.title,
                code: `PROJ-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                description: opportunity.description,
                budget: opportunity.value,
                currency: opportunity.currency,
                startDate: opportunity.expectedCloseDate || new Date(),
                status: 'Planning',

                // Relations
                clientId: opportunity.clientId,
                managerId: opportunity.ownerId,
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

        res.json({
            status: 'success',
            message: 'Project created successfully',
            project: project
        });

    } catch (error) {
        console.error('Conversion Error:', error);
        res.status(500).json({ error: 'Failed to convert opportunity' });
    }
}
