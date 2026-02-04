import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Epic 5 Logic: Deal Governance
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { opportunityId, discountPercent, marginPercent, requesterId } = body;

        // Rule: IF Discount > 15% AND Margin < 20% THEN RequireApproval
        const requiresApproval = discountPercent > 15 && marginPercent < 20;

        if (!requiresApproval) {
            return NextResponse.json({
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

        return NextResponse.json({
            status: 'Pending',
            message: 'Request sent to Finance for review.',
            requiresReview: true,
            approvalId: approval.id
        });

    } catch (error) {
        console.error('Approval Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
