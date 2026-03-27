import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/opportunities
export async function listOpportunities(req: Request, res: Response) {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
        const search = (req.query.search as string || '').trim();
        const stageFilter = req.query.stage as string || '';

        const where: any = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { client: { name: { contains: search, mode: 'insensitive' } } },
                { owner: { name: { contains: search, mode: 'insensitive' } } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (stageFilter) {
            where.stage = { name: stageFilter };
        }

        const [opportunities, total] = await Promise.all([
            prisma.opportunity.findMany({
                where,
                include: {
                    client: true,
                    stage: true,
                    owner: true,
                },
                orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.opportunity.count({ where }),
        ]);

        // Transform for frontend with dynamic intelligence 
        const formatted = opportunities.map(opp => {
            const stageName = opp.stage?.name || opp.currentStage || 'Discovery';

            // 1. Dynamic Probability based on stage progression
            // Logic: Each stage represents increasing likelihood of closing
            let probability = 10;
            switch (stageName) {
                case 'Discovery': probability = 10; break;
                case 'Qualification': probability = 25; break;
                case 'Proposal': probability = 50; break;
                case 'Negotiation': probability = 75; break;
                case 'Closed Won': probability = 100; break;
                case 'Closed Lost': probability = 0; break;
                default: probability = 10;
            }

            // Boost probability based on completeness
            const hasPresalesData = opp.presalesData && Object.keys(opp.presalesData as any).length > 0;
            const hasSalesData = opp.salesData && Object.keys(opp.salesData as any).length > 0;
            const hasExpectedClose = !!opp.expectedCloseDate;
            const hasDescription = !!opp.description;
            const hasDuration = !!opp.tentativeDuration;
            const hasRate = opp.expectedDayRate && Number(opp.expectedDayRate) > 0;
            const completenessBonus = [hasPresalesData, hasSalesData, hasExpectedClose, hasDescription, hasDuration, hasRate]
                .filter(Boolean).length; // 0-6 fields
            // Add up to +10% for completeness (but cap at stage ceiling)
            const maxForStage = probability;
            probability = Math.min(probability + Math.round(completenessBonus * 1.5), Math.min(maxForStage + 15, 100));

            // 2. Days in Stage
            const lastUpdate = new Date(opp.updatedAt);
            const now = new Date();
            const daysInStage = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));

            // 3. Stalled detection
            const isStalled = daysInStage > 30 && !['Closed Won', 'Closed Lost'].includes(stageName);

            // 4. Dynamic Health Score (composite of 4 factors)
            //    a) Stage Progress (30%): further along = healthier
            const stageProgressMap: Record<string, number> = {
                'Discovery': 20, 'Qualification': 40, 'Proposal': 60,
                'Negotiation': 80, 'Closed Won': 100, 'Closed Lost': 0
            };
            const stageScore = stageProgressMap[stageName] ?? 20;

            //    b) Recency (30%): recent activity = healthier
            let recencyScore = 100;
            if (daysInStage > 60) recencyScore = 0;
            else if (daysInStage > 30) recencyScore = 20;
            else if (daysInStage > 14) recencyScore = 50;
            else if (daysInStage > 7) recencyScore = 75;

            //    c) Deal Completeness (20%): more data = healthier
            const totalFields = 8;
            const filledFields = [
                opp.description, opp.region, opp.practice,
                opp.technology, opp.tentativeDuration, opp.tentativeStartDate,
                hasPresalesData, hasRate
            ].filter(Boolean).length;
            const completenessScore = Math.round((filledFields / totalFields) * 100);

            //    d) Value Confidence (20%): has rate/duration/pricing model
            const valueFields = [opp.pricingModel, opp.tentativeDuration, hasRate, opp.tentativeEndDate].filter(Boolean).length;
            const valueScore = Math.round((valueFields / 4) * 100);

            const healthScore = Math.round(
                stageScore * 0.3 +
                recencyScore * 0.3 +
                completenessScore * 0.2 +
                valueScore * 0.2
            );

            // Clamp health for closed states
            const finalHealth = stageName === 'Closed Won' ? 100 : stageName === 'Closed Lost' ? 0 : healthScore;

            return {
                id: opp.id,
                name: opp.title,
                client: opp.client.name,
                value: Number(opp.value),
                stage: stageName,
                currentStage: opp.currentStage,
                probability,
                lastActivity: daysInStage === 0 ? 'Today' : `${daysInStage} days ago`,
                owner: opp.owner.name,
                salesRepName: opp.salesRepName || '',
                managerName: (opp as any).managerName || '',
                status: finalHealth > 70 ? 'healthy' : (finalHealth > 40 ? 'at-risk' : 'critical'),
                description: opp.description,
                daysInStage,
                isStalled,
                healthScore: finalHealth
            };
        });

        res.json({
            data: formatted,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
}

// POST /api/opportunities
export async function createOpportunity(req: Request, res: Response) {
    try {
        const body = req.body;

        const defaultType = await prisma.opportunityType.findFirst();
        const discoveryStage = await prisma.stage.findFirst({ where: { name: 'Discovery' } });

        // Use authenticated user as owner
        const ownerId = req.user!.userId;

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
                ownerId: ownerId,
                stageId: discoveryStage?.id!,
                typeId: defaultType?.id!
            } as any,
            include: {
                client: true,
                stage: true
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                entity: 'Opportunity',
                entityId: newOpp.id,
                action: 'CREATE',
                userId: ownerId,
                changes: { title: newOpp.title, value: newOpp.value, client: newOpp.client?.name, stage: newOpp.stage?.name },
            },
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

        // Include project info if exists
        const project = await prisma.project.findFirst({ where: { opportunityId: id } });
        res.json({ ...opportunity, project: project || null });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch opportunity' });
    }
}

// PATCH /api/opportunities/:id
export async function updateOpportunity(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const body = req.body;

        // Fetch current state for audit diff
        const previous = await prisma.opportunity.findUnique({
            where: { id },
            include: { client: true, stage: true },
        });

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
        const newStageName = body.stageName || body.stage;
        if (newStageName) {
            const stage = await prisma.stage.findFirst({ where: { name: newStageName } });
            if (stage) {
                stageUpdate = {
                    stageId: stage.id,
                    currentStage: newStageName
                };
                if (newStageName === 'Closed Lost') {
                    stageUpdate.detailedStatus = 'Lost';
                }
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
                managerName: body.managerName,
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

        // Audit log — capture what changed
        const changes: any = {};
        if (body.projectName || body.title) changes.title = { from: previous?.title, to: body.projectName || body.title };
        if (body.value !== undefined) changes.value = { from: previous?.value, to: body.value };
        if (body.description !== undefined) changes.description = { from: previous?.description, to: body.description };
        if (newStageName) changes.stage = { from: previous?.stage?.name || previous?.currentStage, to: newStageName };
        if (body.clientName) changes.client = { from: previous?.client?.name, to: body.clientName };
        if (body.region !== undefined) changes.region = { from: previous?.region, to: body.region };
        if (body.practice !== undefined) changes.practice = { from: previous?.practice, to: body.practice };
        if (body.technology !== undefined) changes.technology = { from: previous?.technology, to: body.technology };
        if (body.pricingModel !== undefined) changes.pricingModel = { from: previous?.pricingModel, to: body.pricingModel };
        if (body.presalesData !== undefined) changes.presalesData = 'updated';
        if (body.salesData !== undefined) changes.salesData = 'updated';

        const action = newStageName ? 'STAGE_CHANGE' : 'UPDATE';
        await prisma.auditLog.create({
            data: {
                entity: 'Opportunity',
                entityId: id,
                action,
                userId: req.user!.userId,
                changes,
            },
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

        // 4. Update opportunity stage to reflect project conversion
        const closedWonStage = await prisma.stage.findFirst({ where: { name: 'Closed Won' } });
        await prisma.opportunity.update({
            where: { id },
            data: {
                currentStage: 'Closed Won',
                detailedStatus: 'SOW Approved',
                ...(closedWonStage ? { stageId: closedWonStage.id } : {}),
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                entity: 'Opportunity',
                entityId: id,
                action: 'CONVERT_TO_PROJECT',
                userId: req.user!.userId,
                changes: { projectId: project.id, projectCode: project.code, stage: { from: opportunity.currentStage, to: 'Closed Won' } },
            },
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
