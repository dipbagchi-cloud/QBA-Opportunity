import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendNotificationEmail } from '../lib/email';
import { evaluateStageChangeRules, evaluateDataConditionRules, evaluateOpportunityCreatedRules } from '../lib/notification-engine';
import path from 'path';
import fs from 'fs';

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
                    stageHistory: {
                        orderBy: { enteredAt: 'desc' },
                        take: 1,
                    },
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

            // 2. Days in Stage - use stageHistory.enteredAt for accurate calculation
            const currentStageEntry = opp.stageHistory?.[0];
            const stageEnteredAt = currentStageEntry?.enteredAt 
                ? new Date(currentStageEntry.enteredAt) 
                : new Date(opp.createdAt); // fallback to createdAt if no history
            const now = new Date();
            const daysInStage = Math.floor((now.getTime() - stageEnteredAt.getTime()) / (1000 * 3600 * 24));

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
                technology: opp.technology || '',
                region: opp.region || '',
                expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().slice(0, 10) : '',
                actualCloseDate: opp.actualCloseDate ? new Date(opp.actualCloseDate).toISOString().slice(0, 10) : '',
                tentativeStartDate: opp.tentativeStartDate ? new Date(opp.tentativeStartDate).toISOString().slice(0, 10) : '',
                tentativeEndDate: opp.tentativeEndDate ? new Date(opp.tentativeEndDate).toISOString().slice(0, 10) : '',
                createdAt: new Date(opp.createdAt).toISOString().slice(0, 10),
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

        // Duplicate detection: Check if same title + client was created in last 30 seconds
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const recentDuplicate = await prisma.opportunity.findFirst({
            where: {
                title: body.title || body.name,
                clientId: clientId,
                ownerId: ownerId,
                createdAt: { gte: thirtySecondsAgo }
            }
        });

        if (recentDuplicate) {
            console.log(`Duplicate detected: ${recentDuplicate.id} - returning existing record`);
            return res.json(recentDuplicate);
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
                projectType: body.projectType,
                tentativeStartDate: body.tentativeStartDate ? new Date(body.tentativeStartDate) : undefined,
                tentativeDuration: body.tentativeDuration,
                tentativeDurationUnit: body.tentativeDurationUnit,
                tentativeEndDate: body.tentativeEndDate ? new Date(body.tentativeEndDate) : undefined,
                pricingModel: body.pricingModel,
                expectedDayRate: body.expectedDayRate ? body.expectedDayRate : null,
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

        // Fire-and-forget: notify configured recipients about the new opportunity
        try {
            const creator = await prisma.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
            evaluateOpportunityCreatedRules({
                opportunityId: newOpp.id,
                opportunityTitle: newOpp.title,
                clientName: newOpp.client?.name || clientName || '',
                stageName: newOpp.stage?.name || 'Discovery',
                ownerName: creator?.name || '',
                ownerEmail: creator?.email || '',
                salesRepName: (newOpp as any).salesRepName || creator?.name || '',
                createdByName: creator?.name || '',
                value: newOpp.value != null ? Number(newOpp.value) : null,
                probability: newOpp.probability,
                region: (newOpp as any).region || undefined,
                technology: (newOpp as any).technology || undefined,
                practice: (newOpp as any).practice || undefined,
                projectType: (newOpp as any).projectType || undefined,
                pricingModel: (newOpp as any).pricingModel || undefined,
                description: newOpp.description || undefined,
                tentativeStartDate: (newOpp as any).tentativeStartDate ? new Date((newOpp as any).tentativeStartDate).toISOString().slice(0, 10) : undefined,
                tentativeDuration: (newOpp as any).tentativeDuration != null
                    ? `${(newOpp as any).tentativeDuration} ${(newOpp as any).tentativeDurationUnit || ''}`.trim()
                    : undefined,
            });
        } catch (notifyErr) {
            console.error('[opportunity_created] notification dispatch failed:', notifyErr);
        }

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
                attachments: {
                    select: { id: true, fileName: true, fileType: true, fileSize: true, uploadedAt: true },
                    orderBy: { uploadedAt: 'desc' },
                },
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
            include: { client: true, stage: true, owner: true },
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
                if (newStageName === 'Closed Won' || newStageName === 'Closed Lost') {
                    stageUpdate.actualCloseDate = new Date();
                }
                if (newStageName === 'Closed Lost') {
                    stageUpdate.detailedStatus = 'Lost';
                }
                // Track re-estimation iterations (item 7)
                // When Sales sends back to Qualification (re-estimate), increment counter
                const prevStageName = previous?.stage?.name || previous?.currentStage || '';
                if (newStageName === 'Qualification' && (prevStageName === 'Proposal' || prevStageName === 'Negotiation')) {
                    stageUpdate.reEstimateCount = (previous as any)?.reEstimateCount ? (previous as any).reEstimateCount + 1 : 1;
                    stageUpdate.detailedStatus = 'Sent for Re-estimate';
                    stageUpdate.gomApproved = false; // Reset GOM approval on re-estimate
                }
                // When presales submits to sales: first time = 'Estimation Submitted', subsequent = 'Re-estimation Submitted'
                if (newStageName === 'Proposal') {
                    // Block move to Sales unless GOM is approved
                    if (!previous?.gomApproved) {
                        return res.status(400).json({ error: 'GOM must be approved before moving to Sales.' });
                    }
                    const reEstCount = (previous as any)?.reEstimateCount || 0;
                    stageUpdate.detailedStatus = reEstCount > 0 ? 'Re-estimation Submitted' : 'Estimation Submitted';
                }
            }
        }

        // If there's a reEstimate comment, create a Note for audit trail
        if (body.reEstimateComment && newStageName === 'Qualification') {
            await prisma.note.create({
                data: {
                    content: body.reEstimateComment,
                    mentions: '',
                    stage: 'Sales',
                    opportunityId: id,
                    authorId: req.user!.userId,
                },
            });
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
                projectType: body.projectType,
                salesRepName: body.salesRepName || body.salesRep,
                managerName: body.managerName,
                tentativeStartDate: body.tentativeStartDate ? new Date(body.tentativeStartDate) : undefined,
                tentativeEndDate: body.tentativeEndDate ? new Date(body.tentativeEndDate) : undefined,
                tentativeDuration: body.tentativeDuration || body.duration,
                tentativeDurationUnit: body.tentativeDurationUnit || body.durationUnit,
                pricingModel: body.pricingModel,
                expectedDayRate: body.expectedDayRate ? body.expectedDayRate : null,
                adjustedEstimatedValue: body.adjustedEstimatedValue ? body.adjustedEstimatedValue : null,

                // Complex Data
                presalesData: body.presalesData,
                salesData: body.salesData,

                // Relations if changed
                clientId: clientId,
                ...stageUpdate
            }
        });

        // Audit log — capture what actually changed (human-readable)
        const changes: string[] = [];

        const titleVal = body.projectName || body.title;
        if (titleVal && titleVal !== previous?.title)
            changes.push(`Title changed from '${previous?.title || ''}' to '${titleVal}'`);
        if (body.value !== undefined && Number(body.value) !== Number(previous?.value))
            changes.push(`Value changed from '${previous?.value ?? ''}' to '${body.value}'`);
        if (body.description !== undefined && body.description !== (previous?.description || ''))
            changes.push(`Description updated`);
        if (newStageName && newStageName !== (previous?.stage?.name || previous?.currentStage))
            changes.push(`Stage changed from '${previous?.stage?.name || previous?.currentStage || ''}' to '${newStageName}'`);
        if (body.clientName && body.clientName !== previous?.client?.name)
            changes.push(`Client changed from '${previous?.client?.name || ''}' to '${body.clientName}'`);
        if (body.region !== undefined && body.region !== previous?.region)
            changes.push(`Region changed from '${previous?.region || ''}' to '${body.region}'`);
        if (body.practice !== undefined && body.practice !== previous?.practice)
            changes.push(`Practice changed from '${previous?.practice || ''}' to '${body.practice}'`);
        if (body.technology !== undefined && body.technology !== previous?.technology)
            changes.push(`Technology changed from '${previous?.technology || ''}' to '${body.technology}'`);
        if (body.pricingModel !== undefined && body.pricingModel !== previous?.pricingModel)
            changes.push(`Pricing Model changed from '${previous?.pricingModel || ''}' to '${body.pricingModel}'`);
        if (body.presalesData !== undefined) {
            const prevPresales = JSON.stringify(previous?.presalesData || '');
            const newPresales = JSON.stringify(body.presalesData);
            if (prevPresales !== newPresales) {
                const pd = body.presalesData;
                const details: string[] = [];
                if (pd.managerName) details.push(`Manager: ${pd.managerName}`);
                if (pd.proposalDueDate) details.push(`Proposal Due Date: ${pd.proposalDueDate}`);
                if (pd.comments) details.push(`Comments: ${pd.comments}`);
                changes.push(details.length > 0
                    ? `Moved to Presales — ${details.join(', ')}`
                    : 'Presales data updated');
            }
        }
        if (body.salesData !== undefined) {
            const prevSales = JSON.stringify(previous?.salesData || '');
            const newSales = JSON.stringify(body.salesData);
            if (prevSales !== newSales) {
                const sd = body.salesData;
                if (sd.lostRemarks) {
                    changes.push(`Lost Reason: ${sd.lostRemarks}`);
                } else {
                    changes.push('Sales data updated');
                }
            }
        }

        if (changes.length > 0) {
            const action = newStageName && newStageName !== (previous?.stage?.name || previous?.currentStage) ? 'STAGE_CHANGE' : 'UPDATE';
            await prisma.auditLog.create({
                data: {
                    entity: 'Opportunity',
                    entityId: id,
                    action,
                    userId: req.user!.userId,
                    changes: changes.join('; '),
                },
            });
        }

        // Dedicated audit entries for special stage transitions
        const prevStageName2 = previous?.stage?.name || previous?.currentStage || '';
        if (newStageName === 'Qualification' && (prevStageName2 === 'Proposal' || prevStageName2 === 'Negotiation')) {
            // Re-estimate: write a SEND_BACK_REESTIMATE audit entry
            const reEstComment = body.reEstimateComment ? `Re-estimate Comment: ${body.reEstimateComment}` : 'Sent back for re-estimation';
            await prisma.auditLog.create({
                data: {
                    entity: 'Opportunity',
                    entityId: id,
                    action: 'SEND_BACK_REESTIMATE',
                    userId: req.user!.userId,
                    changes: reEstComment,
                },
            });
        }
        if (newStageName === 'Proposal' && prevStageName2 === 'Qualification') {
            // Presales submitted estimation: write ESTIMATION_SUBMITTED entry
            const estDetails: string[] = [];
            if (body.presalesData?.managerName) estDetails.push(`Manager: ${body.presalesData.managerName}`);
            if (body.presalesData?.comments) estDetails.push(`Comments: ${body.presalesData.comments}`);
            await prisma.auditLog.create({
                data: {
                    entity: 'Opportunity',
                    entityId: id,
                    action: 'ESTIMATION_SUBMITTED',
                    userId: req.user!.userId,
                    changes: estDetails.length > 0 ? estDetails.join('; ') : 'Estimation submitted to sales',
                },
            });
        }
        if (body.salesData?.lostRemarks) {
            // Mark as lost: write MARK_LOST audit entry
            await prisma.auditLog.create({
                data: {
                    entity: 'Opportunity',
                    entityId: id,
                    action: 'MARK_LOST',
                    userId: req.user!.userId,
                    changes: `Lost Reason: ${body.salesData.lostRemarks}`,
                },
            });
        }

        // ── Email Notifications (fire-and-forget) ──
        const emailVars: Record<string, string> = {
            opportunityTitle: updatedOpp.title,
            opportunityId: id,
            clientName: previous?.client?.name || '',
            stageName: newStageName || previous?.stage?.name || '',
            previousStage: previous?.stage?.name || previous?.currentStage || '',
            salesRepName: (updatedOpp as any).salesRepName || previous?.owner?.name || '',
            managerName: (updatedOpp as any).managerName || '',
            updatedBy: previous?.owner?.name || 'System',
            comment: body.presalesData?.comment || body.salesData?.notes || '',
        };

        const ownerEmail = previous?.owner?.email;
        const ownerName = previous?.owner?.name || '';

        // Pipeline saved/submitted → salesperson gets notice
        if (!newStageName || newStageName === 'Pipeline' || newStageName === 'Discovery') {
            if (ownerEmail) {
                sendNotificationEmail('pipeline_saved', ownerEmail, ownerName, emailVars);
            }
        }

        // Moved to Presales/Qualification → the assigned manager gets email
        if (newStageName && (newStageName === 'Qualification' || newStageName === 'Presales')) {
            const managerName = body.managerName || (updatedOpp as any).managerName;
            if (managerName) {
                // Try to find a user with that name to get email
                const managerUser = await prisma.user.findFirst({ where: { name: managerName } });
                if (managerUser?.email) {
                    sendNotificationEmail('moved_to_presales', managerUser.email, managerName, emailVars);
                }
            }
            // Also notify the salesperson
            if (ownerEmail) {
                sendNotificationEmail('pipeline_saved', ownerEmail, ownerName, emailVars);
            }
        }

        // Submitted back from Presales (moved to Proposal/Sales) → presales team gets email
        if (newStageName && (newStageName === 'Proposal' || newStageName === 'Sales')) {
            // Notify the salesperson/owner
            if (ownerEmail) {
                sendNotificationEmail('presales_submitted_back', ownerEmail, ownerName, emailVars);
            }
        }

        // ── Notification Rules Engine (fire-and-forget) ──
        if (newStageName && newStageName !== (previous?.stage?.name || previous?.currentStage)) {
            evaluateStageChangeRules({
                opportunityId: id,
                opportunityTitle: updatedOpp.title,
                previousStage: previous?.stage?.name || previous?.currentStage || '',
                newStage: newStageName,
                clientName: previous?.client?.name || '',
                ownerName: ownerName,
                ownerEmail: ownerEmail || '',
                salesRepName: (updatedOpp as any).salesRepName || '',
                managerName: (updatedOpp as any).managerName || '',
                updatedByName: previous?.owner?.name || 'System',
                value: updatedOpp.value ? Number(updatedOpp.value) : null,
                probability: updatedOpp.probability,
                region: updatedOpp.region || undefined,
                technology: updatedOpp.technology || undefined,
            });
        }

        // Evaluate data condition rules on every update
        evaluateDataConditionRules({
            id,
            title: updatedOpp.title,
            value: updatedOpp.value ? Number(updatedOpp.value) : null,
            probability: updatedOpp.probability,
            currentStage: newStageName || previous?.stage?.name || previous?.currentStage,
            region: updatedOpp.region,
            technology: updatedOpp.technology,
            client: previous?.client ? { name: previous.client.name } : null,
            owner: previous?.owner ? { id: previous.owner.id, name: previous.owner.name, email: previous.owner.email } : null,
            salesRepName: (updatedOpp as any).salesRepName,
            managerName: (updatedOpp as any).managerName,
        });

        res.json(updatedOpp);
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: 'Failed to update opportunity' });
    }
}

// PATCH /api/opportunities/:id/approve-gom
export async function approveGom(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { approved, gomPercent } = req.body;

        // If revoking, just revoke
        if (approved === false) {
            const updated = await prisma.opportunity.update({ where: { id }, data: { gomApproved: false } });
            await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: id, action: 'GOM_REVOKED', userId: req.user!.userId, changes: 'GOM Approval Revoked' } });
            return res.json({ gomApproved: false });
        }

        // Get auto-approve threshold from budget assumptions
        const config = await prisma.systemConfig.findUnique({ where: { key: 'budget_assumptions' } });
        const assumptions = (config?.value as any) || {};
        const autoApproveThreshold = assumptions.gomAutoApprovePercent || 0;

        // If GOM% >= threshold (or threshold not set), auto-approve directly
        if (autoApproveThreshold <= 0 || (gomPercent !== undefined && gomPercent >= autoApproveThreshold)) {
            const updated = await prisma.opportunity.update({ where: { id }, data: { gomApproved: true } });
            await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: id, action: 'GOM_APPROVED', userId: req.user!.userId, changes: `GOM Auto-Approved at ${gomPercent?.toFixed(1) || '?'}%` } });
            return res.json({ gomApproved: true });
        }

        // GOM% below threshold — create approval request to reporting manager
        const requester = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, name: true, reportingManagerName: true } });
        let reviewerId: string | null = null;
        if (requester?.reportingManagerName) {
            const manager = await prisma.user.findFirst({ where: { name: requester.reportingManagerName, isActive: true } });
            reviewerId = manager?.id || null;
        }

        // Cancel any existing pending GOM approval for this opportunity
        await prisma.approvalRequest.updateMany({
            where: { opportunityId: id, type: 'GOM_APPROVAL', status: 'Pending' },
            data: { status: 'Cancelled' },
        });

        const approval = await prisma.approvalRequest.create({
            data: {
                type: 'GOM_APPROVAL',
                reason: `GOM is ${gomPercent?.toFixed(1) || '?'}% (below auto-approve threshold of ${autoApproveThreshold}%)`,
                status: 'Pending',
                opportunityId: id,
                requesterId: req.user!.userId,
                reviewerId,
            },
        });

        await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: id, action: 'GOM_APPROVAL_REQUESTED', userId: req.user!.userId, changes: `GOM Approval requested at ${gomPercent?.toFixed(1) || '?'}%. Sent to ${requester?.reportingManagerName || 'unassigned manager'}` } });

        res.json({ gomApproved: false, pendingApproval: true, approvalId: approval.id, reviewer: requester?.reportingManagerName || null });
    } catch (error) {
        console.error("Approve GOM Error:", error);
        res.status(500).json({ error: 'Failed to update GOM approval' });
    }
}

// GET /api/opportunities/:id/gom-approval-status
export async function getGomApprovalStatus(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const pending = await prisma.approvalRequest.findFirst({
            where: { opportunityId: id, type: 'GOM_APPROVAL', status: 'Pending' },
            include: { requester: { select: { name: true } }, reviewer: { select: { name: true } } },
            orderBy: { requestedAt: 'desc' },
        });
        res.json({ pending: pending ? { id: pending.id, requester: pending.requester.name, reviewer: pending.reviewer?.name || null, requestedAt: pending.requestedAt, reason: pending.reason } : null });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch approval status' });
    }
}

// PATCH /api/opportunities/:id/review-gom-approval
export async function reviewGomApproval(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { approved, comments } = req.body;

        const pending = await prisma.approvalRequest.findFirst({
            where: { opportunityId: id, type: 'GOM_APPROVAL', status: 'Pending' },
        });
        if (!pending) return res.status(404).json({ error: 'No pending GOM approval request found' });

        await prisma.approvalRequest.update({
            where: { id: pending.id },
            data: { status: approved ? 'Approved' : 'Rejected', comments, reviewedAt: new Date(), reviewerId: req.user!.userId },
        });

        if (approved) {
            await prisma.opportunity.update({ where: { id }, data: { gomApproved: true } });
        }

        await prisma.auditLog.create({ data: { entity: 'Opportunity', entityId: id, action: approved ? 'GOM_APPROVED' : 'GOM_REJECTED', userId: req.user!.userId, changes: `GOM ${approved ? 'Approved' : 'Rejected'} by manager${comments ? `: ${comments}` : ''}` } });

        res.json({ gomApproved: approved === true, status: approved ? 'Approved' : 'Rejected' });
    } catch (error) {
        console.error("Review GOM Approval Error:", error);
        res.status(500).json({ error: 'Failed to review GOM approval' });
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
                actualCloseDate: new Date(),
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

// GET /api/opportunities/:id/comments
export async function listComments(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const comments = await prisma.note.findMany({
            where: { opportunityId: id },
            include: { author: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(comments);
    } catch (error) {
        console.error('List Comments Error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
}

// POST /api/opportunities/:id/comments
export async function addComment(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { content, stage } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }
        const comment = await prisma.note.create({
            data: {
                content: content.trim(),
                mentions: '',
                stage: stage || null,
                opportunityId: id,
                authorId: req.user!.userId,
            } as any,
            include: { author: { select: { id: true, name: true, email: true } } },
        });

        res.json(comment);
    } catch (error) {
        console.error('Add Comment Error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
}

// GET /api/opportunities/:id/audit-log
export async function getOpportunityAuditLog(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const logs = await prisma.auditLog.findMany({
            where: { entity: 'Opportunity', entityId: id },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { timestamp: 'desc' },
            take: 100,
        });
        res.json(logs);
    } catch (error) {
        console.error('Audit Log Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
}

// ── Attachment endpoints ──

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const UPLOAD_DIR = path.join(PROJECT_ROOT, 'uploads', 'attachments');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// POST /api/opportunities/:id/attachments
export async function uploadAttachment(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const file = (req as any).file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const opp = await prisma.opportunity.findUnique({ where: { id } });
        if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

        // Store relative path from project root for portability
        const relativePath = path.relative(PROJECT_ROOT, file.path);
        const attachment = await prisma.attachment.create({
            data: {
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                filePath: relativePath,
                opportunityId: id,
            },
            select: { id: true, fileName: true, fileType: true, fileSize: true, uploadedAt: true },
        });

        res.status(201).json(attachment);
    } catch (error) {
        console.error('Upload attachment error:', error);
        res.status(500).json({ error: 'Failed to upload attachment' });
    }
}

// GET /api/opportunities/:id/attachments/:attachmentId/download
export async function downloadAttachment(req: Request, res: Response) {
    try {
        const { attachmentId } = req.params;
        const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
        if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

        // Resolve relative path to absolute for file access
        const absPath = path.isAbsolute(attachment.filePath)
            ? attachment.filePath
            : path.join(PROJECT_ROOT, attachment.filePath);

        if (!fs.existsSync(absPath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
        res.setHeader('Content-Type', attachment.fileType);
        fs.createReadStream(absPath).pipe(res);
    } catch (error) {
        console.error('Download attachment error:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
}

// DELETE /api/opportunities/:id/attachments/:attachmentId
export async function deleteAttachment(req: Request, res: Response) {
    try {
        const { attachmentId } = req.params;
        const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
        if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

        // Resolve relative path to absolute for file deletion
        const absPath = path.isAbsolute(attachment.filePath)
            ? attachment.filePath
            : path.join(PROJECT_ROOT, attachment.filePath);

        // Remove file from disk
        if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
        }

        await prisma.attachment.delete({ where: { id: attachmentId } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
}
