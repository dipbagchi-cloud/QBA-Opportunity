const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const template = await prisma.emailTemplate.update({
        where: { eventKey: 'sent_back_to_reestimate' },
        data: {
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Re-Estimation Required</h2>
<p>Hi {{recipientName}},</p>
<p>The opportunity <strong>{{opportunityTitle}}</strong> for <strong>{{clientName}}</strong> has been sent back for re-estimation.</p>
<p><strong>Reason:</strong> {{comment}}</p>
<p><strong>Adjusted Quote Value:</strong> {{adjustedEstimatedValue}}</p>
<p><strong>Re-estimate Count:</strong> {{reEstimateCount}}</p>
<p><strong>Sent by:</strong> {{updatedBy}}</p>
<p>Please review the estimation and make necessary adjustments.</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`
        }
    });
    console.log("Updated template successfully.");
}

main().finally(() => prisma.$disconnect());
