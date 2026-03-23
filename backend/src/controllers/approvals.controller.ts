import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Epic 5 Logic: Deal Governance
// POST /api/approvals
export async function createApproval(req: Request, res: Response) {
    try {
        const body = req.body;
        const { opportunityId, discountPercent, marginPercent } = body;
        const requesterId = req.user!.userId;

        // Rule: IF Discount > 15% AND Margin < 20% THEN RequireApproval
        const requiresApproval = discountPercent > 15 && marginPercent < 20;

        if (!requiresApproval) {
            return res.json({
                status: 'Approved',
                message: 'Auto-approved based on policy.',
                requiresReview: false
            });
        }

        // Create Approval Request
        const approval = await prisma.approvalRequest.create({
            data: {
                opportunityId,
                requesterId,
                type: 'Discount',
                status: 'Pending',
                reason: `High Discount (${discountPercent}%) with Low Margin (${marginPercent}%)`,
            }
        });

        // Log to Audit Trail (Epic 5)
        await prisma.auditLog.create({
            data: {
                entity: 'ApprovalRequest',
                entityId: approval.id,
                action: 'CREATE_REQUEST',
                userId: requesterId,
                changes: { discountPercent, marginPercent }
            }
        });

        res.json({
            status: 'Pending',
            message: 'Request sent to Finance for review.',
            requiresReview: true,
            approvalId: approval.id
        });

    } catch (error) {
        console.error('Approval Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
}
